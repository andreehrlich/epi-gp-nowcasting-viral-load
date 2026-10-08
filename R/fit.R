# Fitting one fold with CmdStan.

# Sampler settings used for every fit in the paper.
SAMPLER <- list(seed = 1024, chains = 4L, iter_warmup = 1500L, iter_sampling = 1000L,
                adapt_delta = 0.8, max_treedepth = 12L, refresh = 50L)

results_root <- function() Sys.getenv("EPIGP_RESULTS", file.path(repo_root(), "results"))

fold_dir <- function(dataset, arm, variant, N, implementation = "hsgp", root = results_root()) {
  file.path(root, dataset, implementation, arm, variant_tag(variant), sprintf("N_%03d", N))
}

# Fit one fold and write to fold_dir():
#   stan_data.json, init.json  exact CmdStan inputs
#   cmdstan/                   CmdStan CSV output
#   draws.rds, summary.rds     posterior draws (draws_array) and summary
#   fit.json                   settings, input hashes, software versions, run time
fit_fold <- function(dataset, arm, variant, N, implementation = "hsgp",
                     root = results_root(), overwrite = FALSE) {
  out <- fold_dir(dataset, arm, variant, N, implementation, root)
  if (file.exists(file.path(out, "draws.rds")) && !overwrite) {
    message("Fold exists, skipping: ", out)
    return(invisible(out))
  }
  dir.create(file.path(out, "cmdstan"), recursive = TRUE, showWarnings = FALSE)

  ds <- load_dataset(dataset)
  d <- build_stan_data(ds, arm, variant, N, implementation)
  init <- build_init(d, arm, implementation)
  data_file <- file.path(out, "stan_data.json")
  init_file <- file.path(out, "init.json")
  cmdstanr::write_stan_json(d, data_file)
  cmdstanr::write_stan_json(init, init_file)

  exe_dir <- Sys.getenv("EPIGP_BUILD", file.path(repo_root(), "build"))
  dir.create(exe_dir, recursive = TRUE, showWarnings = FALSE)
  model <- cmdstanr::cmdstan_model(stan_file(arm, implementation), dir = exe_dir)

  started <- Sys.time()
  # Data and inits go in as R lists (cmdstanr writes its own JSON); the files
  # above are the same content, kept as a record of the inputs.
  fit <- model$sample(
    data = d, init = replicate(SAMPLER$chains, init, simplify = FALSE),
    seed = SAMPLER$seed, chains = SAMPLER$chains, parallel_chains = SAMPLER$chains,
    iter_warmup = SAMPLER$iter_warmup, iter_sampling = SAMPLER$iter_sampling,
    adapt_delta = SAMPLER$adapt_delta, max_treedepth = SAMPLER$max_treedepth,
    refresh = SAMPLER$refresh, output_dir = file.path(out, "cmdstan"), output_basename = "sample"
  )
  draws <- fit$draws()
  saveRDS(draws, file.path(out, "draws.rds"))
  saveRDS(fit$summary(), file.path(out, "summary.rds"))

  md5 <- function(f) unname(tools::md5sum(f))
  meta <- list(
    dataset = dataset, arm = arm, variant = variant, N = N, implementation = implementation,
    horizon = HORIZON, sampler = SAMPLER,
    stan_file = basename(stan_file(arm, implementation)), stan_md5 = md5(stan_file(arm, implementation)),
    stan_data_md5 = md5(data_file), init_md5 = md5(init_file),
    diagnostics = fit$diagnostic_summary(quiet = TRUE),
    elapsed_seconds = as.numeric(difftime(Sys.time(), started, units = "secs")),
    cmdstan = cmdstanr::cmdstan_version(), cmdstanr = as.character(utils::packageVersion("cmdstanr")),
    r = R.version.string, platform = R.version$platform, os = utils::sessionInfo()$running
  )
  jsonlite::write_json(meta, file.path(out, "fit.json"), auto_unbox = TRUE, pretty = TRUE, digits = NA)
  invisible(out)
}
