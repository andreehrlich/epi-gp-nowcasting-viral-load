# Forecast scores and WAIC for one fold.
#
# A fold with origin N gives S posterior predictive draws of daily cases and
# deaths, y_rep[g, N + h], h = 1..H, per age group g and for their total. Each
# forecast is scored against the observed count y:
#   CRPS(F, y) = E|X - y| - E|X - X'| / 2, estimated from the sorted draws
#     x_(1) <= ... <= x_(S) as  mean|x_i - y| - (2 / S^2) sum_i (i - 1/2) x_(i) + mean(x);
#   log score = log of a Gaussian kernel density of the draws at y, bandwidth
#     max(bw.nrd0(draws), 0.5) (counts are discrete, so the bandwidth is >= 0.5);
#   90% coverage = 1{q_0.05 <= y <= q_0.95}; error = median - y.
# In-sample fit is the WAIC of the pointwise log-likelihood (cases, deaths) on
# days 1..N; columns with a non-finite draw (days outside the likelihood) are dropped.

crps_sample <- function(x, y) {
  x <- sort(x[is.finite(x)])
  n <- length(x)
  if (!n || !is.finite(y)) return(NA_real_)
  mean(abs(x - y)) - (2 * sum((seq_len(n) - 0.5) * x) / n^2 - mean(x))
}

log_score_sample <- function(x, y) {
  x <- x[is.finite(x)]
  if (!length(x) || !is.finite(y)) return(NA_real_)
  bw <- tryCatch(stats::bw.nrd0(x), error = function(e) NA_real_)
  if (!is.finite(bw) || bw <= 0) bw <- stats::sd(x)
  if (!is.finite(bw) || bw <= 0) bw <- 0.5
  bw <- max(bw, 0.5)
  ld <- stats::dnorm((y - x) / bw, log = TRUE) - log(bw)
  ld <- ld[is.finite(ld)]
  if (!length(ld)) return(log(.Machine$double.xmin))
  m <- max(ld)
  m + log(mean(exp(ld - m)))
}

score_row <- function(x, y) {
  q <- stats::quantile(x, c(0.05, 0.25, 0.5, 0.75, 0.95), names = FALSE)
  data.frame(observed = y, pred_mean = mean(x), pred_median = q[3], q05 = q[1], q25 = q[2],
             q75 = q[4], q95 = q[5], error_median = q[3] - y, sq_error = (q[3] - y)^2,
             covered_90 = y >= q[1] & y <= q[5], crps = crps_sample(x, y), log_score = log_score_sample(x, y))
}

# Score the forecasts of one fold; returns one row per outcome, age group
# (and "Total") and horizon.
score_fold <- function(dataset, arm, variant, N, implementation = "hsgp", root = results_root()) {
  out <- fold_dir(dataset, arm, variant, N, implementation, root)
  draws <- posterior::as_draws_matrix(readRDS(file.path(out, "draws.rds")))
  ds <- load_dataset(dataset)
  G <- length(ds$age_groups)
  rows <- list()
  for (outcome in c("cases", "deaths")) {
    observed <- ds[[outcome]]
    for (h in seq_len(HORIZON)) {
      t <- N + h
      sims <- sapply(seq_len(G), function(g) as.numeric(draws[, sprintf("y_rep_%s[%d,%d]", outcome, g, t)]))
      for (g in seq_len(G)) {
        rows[[length(rows) + 1L]] <- cbind(
          data.frame(outcome = outcome, age_group = ds$age_groups[g], horizon = h, date = ds$dates[t]),
          score_row(sims[, g], observed[g, t]))
      }
      rows[[length(rows) + 1L]] <- cbind(
        data.frame(outcome = outcome, age_group = "Total", horizon = h, date = ds$dates[t]),
        score_row(rowSums(sims), sum(observed[, t], na.rm = TRUE)))
    }
  }
  cbind(data.frame(dataset = dataset, arm = arm, variant = variant, N = N, implementation = implementation),
        do.call(rbind, rows))
}

waic_fold <- function(dataset, arm, variant, N, implementation = "hsgp", root = results_root()) {
  draws <- readRDS(file.path(fold_dir(dataset, arm, variant, N, implementation, root), "draws.rds"))
  do.call(rbind, lapply(c("cases", "deaths"), function(outcome) {
    ll <- as.matrix(posterior::as_draws_matrix(posterior::subset_draws(draws, variable = paste0("log_lik_", outcome))))
    ll <- ll[, apply(ll, 2L, function(z) all(is.finite(z))), drop = FALSE]
    w <- suppressWarnings(loo::waic(ll))
    pw <- w$pointwise[, "elpd_waic"]
    data.frame(dataset = dataset, arm = arm, variant = variant, N = N, implementation = implementation,
               outcome = outcome, n_points = length(pw), elpd_waic = sum(pw),
               se_elpd_waic = sqrt(length(pw) * stats::var(pw)), p_waic = sum(w$pointwise[, "p_waic"]))
  }))
}
