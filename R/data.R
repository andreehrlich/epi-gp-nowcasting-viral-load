# Reading the model inputs.
#
# Every dataset is a daily, age-stratified panel with G = 4 age groups:
#   data/public/<dataset>/counts.csv          date, age_group, cases, deaths
#   data/public/<dataset>/population.csv      age_group, population
#   data/public/<dataset>/contact_matrix.csv  4 x 4 mean daily contacts C[g, h]
# plus one viral-load source, which differs by dataset (see vl_source below).

DATASETS <- c("brazil", "sp", "ottawa", "toronto", "scotland")

repo_root <- function() {
  root <- Sys.getenv("EPIGP_ROOT", "")
  if (nzchar(root)) return(normalizePath(root, mustWork = TRUE))
  normalizePath(".", mustWork = TRUE)
}
data_path <- function(kind, dataset, file) file.path(repo_root(), "data", kind, dataset, file)

read_csv_exact <- function(path) {
  # Doubles are stored with 17 significant digits, which identify each double
  # uniquely. R's own decimal parser (as.numeric, read.csv) is not correctly
  # rounded at that precision, so numeric columns are parsed with jsonlite, which
  # uses the C library's correctly rounded strtod. Inputs then match bit for bit.
  x <- utils::read.csv(path, colClasses = "character", check.names = FALSE, na.strings = "")
  for (k in names(x)) {
    v <- x[[k]]
    ok <- !is.na(v)
    if (!any(ok) || !all(grepl("^-?[0-9.]+([eE][-+]?[0-9]+)?$", v[ok]))) next
    if (!any(grepl("[.eE]", v[ok]))) {
      x[[k]] <- as.integer(v)
    } else {
      num <- rep(NA_real_, length(v))
      num[ok] <- jsonlite::parse_json(paste0("[", paste(v[ok], collapse = ","), "]"), simplifyVector = TRUE)
      x[[k]] <- num
    }
  }
  if ("usable" %in% names(x)) x$usable <- as.logical(x$usable)
  x
}

# How viral load enters each dataset:
#   "age"        Brazil, Sao Paulo: PCR-derived sum of normalised viral loads per age
#                group and day (private, data/private/<dataset>/viral_load.csv);
#   "series"     Ottawa: one wastewater N1 series, used for every age group;
#   "site_panel" Toronto, Scotland: one wastewater proxy built for each forecast
#                origin from training samples only (R/wastewater.R).
vl_source <- function(dataset) {
  switch(dataset, brazil = "age", sp = "age", ottawa = "series",
         toronto = "site_panel", scotland = "site_panel",
         stop("Unknown dataset: ", dataset))
}

# Load one dataset as G x T matrices (rows = age groups, columns = days).
# The private PCR viral load (Brazil, Sao Paulo) is read when present. Without
# it only I = C can be fitted; the Stan program then never reads the viral-load
# values (use_vl = 0), so the zeros passed in their place give identical fits.
load_dataset <- function(dataset) {
  stopifnot(dataset %in% DATASETS)
  counts <- read_csv_exact(data_path("public", dataset, "counts.csv"))
  counts$date <- as.Date(counts$date)
  pop <- read_csv_exact(data_path("public", dataset, "population.csv"))
  cm <- read_csv_exact(data_path("public", dataset, "contact_matrix.csv"))
  age_groups <- pop$age_group
  contact <- as.matrix(cm[, age_groups])
  dimnames(contact) <- list(age_groups, age_groups)
  stopifnot(identical(cm$age_group, age_groups))

  dates <- sort(unique(counts$date))
  to_matrix <- function(col, d = counts) {
    m <- matrix(NA, length(age_groups), length(dates), dimnames = list(age_groups, format(dates)))
    m[cbind(match(d$age_group, age_groups), match(d$date, dates))] <- d[[col]]
    m
  }
  out <- list(
    name = dataset, dates = dates, age_groups = age_groups,
    cases = to_matrix("cases"), deaths = to_matrix("deaths"),
    population = stats::setNames(pop$population, age_groups), contact = contact,
    vl_source = vl_source(dataset), vl = NULL, ww_samples = NULL
  )
  stopifnot(!anyNA(out$cases))

  if (out$vl_source == "age") {
    path <- data_path("private", dataset, "viral_load.csv")
    if (!file.exists(path)) return(out)
    v <- read_csv_exact(path)
    v$date <- as.Date(v$date)
    out$vl <- to_matrix("vl_sum", v)
  } else if (out$vl_source == "series") {
    w <- read_csv_exact(data_path("public", dataset, "wastewater.csv"))
    n1 <- w$N1[match(dates, as.Date(w$date))]
    out$vl <- matrix(n1, length(age_groups), length(dates), byrow = TRUE,
                     dimnames = list(age_groups, format(dates)))
  } else if (out$vl_source == "site_panel") {
    s <- read_csv_exact(data_path("public", dataset, "wastewater_samples.csv"))
    s$date <- as.Date(s$date)
    s$t <- match(s$date, dates)
    stopifnot(!anyNA(s$t))
    out$ww_samples <- s
  }
  out
}

# Viral-load matrix for training days 1:N. Missing values enter Stan as 0.
vl_matrix <- function(ds, N) {
  G <- length(ds$age_groups)
  v <- if (ds$vl_source == "site_panel") {
    w <- site_panel_proxy(ds$ww_samples, N, repeat_rule = site_panel_repeat_rule(ds$name))$ww
    matrix(w, G, N, byrow = TRUE)
  } else if (is.null(ds$vl)) {
    matrix(0, G, N)
  } else {
    ds$vl[, seq_len(N), drop = FALSE]
  }
  v[!is.finite(v)] <- 0
  unname(v)
}
