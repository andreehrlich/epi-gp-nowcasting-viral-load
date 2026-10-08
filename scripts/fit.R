# Fit folds of the prequential comparison.
#
#   Rscript scripts/fit.R dataset=ottawa arm=sgp variant=I=C N=90
#   Rscript scripts/fit.R dataset=brazil arm=sgp,sgpai,mgp,exgp variant=I=C,I=VL+C N=180
#   Rscript scripts/fit.R dataset=ottawa arm=all variant=all N=all implementation=dense
#
# Every argument accepts a comma-separated list or "all"; all combinations are
# fitted in turn. implementation is hsgp (default) or dense. Existing folds are
# skipped. Output: results/<dataset>/<implementation>/<arm>/<C|VLC>/N_###/.
source("R/setup.R")
args <- commandArgs(trailingOnly = TRUE)
kv <- setNames(sub("^[^=]+=", "", args), sub("=.*$", "", args))
get <- function(key, all, default = NULL) {
  v <- if (key %in% names(kv)) kv[[key]] else default
  if (is.null(v)) stop("Missing argument ", key, "=")
  if (identical(v, "all")) all else strsplit(v, ",", fixed = TRUE)[[1]]
}
datasets <- get("dataset", DATASETS)
for (dataset in datasets) {
  grid <- expand.grid(arm = get("arm", ARMS), variant = get("variant", VARIANTS),
                      N = as.integer(get("N", DATASET_SETTINGS[[dataset]]$origins)),
                      implementation = get("implementation", c("hsgp", "dense"), "hsgp"),
                      stringsAsFactors = FALSE)
  for (i in seq_len(nrow(grid))) {
    g <- grid[i, ]
    message(sprintf("[%d/%d] %s %s %s %s N=%d", i, nrow(grid), dataset, g$implementation, g$arm, g$variant, g$N))
    fit_fold(dataset, g$arm, g$variant, g$N, g$implementation)
  }
}
