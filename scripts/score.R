# Score every fitted fold under results/ and write
#   results/forecast_scores.csv   one row per fold, outcome, age group and horizon
#   results/waic.csv              one row per fold and outcome
#
#   Rscript scripts/score.R
source("R/setup.R")
root <- results_root()
folds <- list.files(root, "^draws[.]rds$", recursive = TRUE)
parts <- do.call(rbind, strsplit(dirname(folds), "/", fixed = TRUE))
folds <- data.frame(dataset = parts[, 1], implementation = parts[, 2], arm = parts[, 3],
                    variant = c(C = "I=C", VLC = "I=VL+C")[parts[, 4]],
                    N = as.integer(sub("N_", "", parts[, 5])), stringsAsFactors = FALSE)
message(nrow(folds), " folds")
run <- function(f) do.call(rbind, lapply(seq_len(nrow(folds)), function(i)
  with(folds[i, ], f(dataset, arm, variant, N, implementation, root))))
utils::write.csv(run(score_fold), file.path(root, "forecast_scores.csv"), row.names = FALSE)
utils::write.csv(run(waic_fold), file.path(root, "waic.csv"), row.names = FALSE)
