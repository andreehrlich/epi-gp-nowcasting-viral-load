# Stan data for one fold: dataset, GP class (arm), active set (variant),
# forecast origin N and GP implementation (HSGP or dense).
#
# The fold trains on days 1..N (expanding window) and forecasts days N+1..N+H.
build_stan_data <- function(ds, arm, variant, N, implementation = c("hsgp", "dense")) {
  implementation <- match.arg(implementation)
  stopifnot(arm %in% ARMS, variant %in% VARIANTS, N >= 90L, N + HORIZON <= length(ds$dates))
  G <- length(ds$age_groups)
  idx <- seq_len(N)
  use_vl <- as.integer(variant == "I=VL+C")
  if (use_vl && ds$vl_source == "age" && is.null(ds$vl)) {
    stop("I=VL+C for ", ds$name, " needs the private PCR series; see data/private/README.md.")
  }
  cases <- unname(ds$cases[, idx, drop = FALSE])
  deaths <- unname(ds$deaths[, idx, drop = FALSE])
  vl <- vl_matrix(ds, N)
  pi <- onset_to_death_pmf()
  storage.mode(cases) <- "integer"

  d <- list(
    N = as.integer(N), N_pre = 0L, N_fit = as.integer(N), H = HORIZON,
    tau = TAU, initialization_days = TAU, ts = idx, G = as.integer(G),
    N_age = as.integer(round(ds$population)),
    contact_matrix_mean = unname(ds$contact),
    cases = cases,
    deaths = matrix(as.integer(ifelse(is.na(deaths), 0L, deaths)), G, N),
    death_observed = matrix(as.integer(!is.na(deaths)), G, N),  # missing deaths are skipped
    use_death_prewindow = 0L,
    death_prewindow_case_exposure = matrix(0, G, N),
    vl_sum = vl,
    K_pi = length(pi), pi = pi,
    # The death likelihood starts once the delay kernel's cumulative mass covers 95%.
    death_lik_min_kernel_mass = 0.95,
    use_vl = use_vl
  )
  d <- c(d, prior_data(arm), vl_prior_data(ds$name, use_vl, cases, vl))
  if (implementation == "hsgp") {
    b <- hsgp_basis(max(DATASET_SETTINGS[[ds$name]]$origins), HORIZON)
    d <- c(d, list(hsgp_M_beta = b$M, hsgp_M_cfr = b$M, hsgp_domain_start = b$domain_start,
                   hsgp_domain_end = b$domain_end, hsgp_center = b$center, hsgp_L = b$L))
  }
  d
}

# Initial values: every chain starts at the prior centre, with GP weights at 0,
# pooling SDs at 0.1 and the case coefficient at 1. The viral-load coefficient
# starts at its prior scale and its power at 1. Identical across chains, so all
# chain-to-chain variation comes from the seed.
build_init <- function(d, arm, implementation = c("hsgp", "dense")) {
  implementation <- match.arg(implementation)
  G <- d$G
  n_basis <- if (implementation == "hsgp") d$hsgp_M_beta else d$N + d$H
  # vl_coef and vl_power are Stan arrays of size use_vl (empty for I=C).
  G_vl <- if (d$age_vl_coefficients == 1L) G else 1L
  vl <- if (d$use_vl == 1L) {
    list(vl_coef = list(rep(d$vl_coef_prior_sd, G_vl)), vl_power = list(rep(1, G_vl)))
  } else {
    list(vl_coef = list(), vl_power = list())
  }
  if (arm == "exgp") {
    init <- list(
      alpha_log_mu = d$alpha_log_mu_hyper_a, alpha_log_sigma = 0.1,
      eta = matrix(0, G, n_basis),
      mu_cfr_intercept = rep(d$mu_cfr_intercept_hyper_a, G),
      eta_cfr = matrix(0, G, n_basis),
      log_phi = d$phi_hyper_a, log_phi_deaths = d$phi_deaths_hyper_a,
      mu_beta_intercept = rep(d$mu_beta_intercept_hyper_a, G),
      z_alpha_raw = rep(0, G),
      rho_log_mu = d$rho_log_mu_hyper_a, rho_log_sigma = 0.1, z_rho_raw = rep(0, G),
      alpha_cfr_log_mu = d$alpha_cfr_log_mu_hyper_a, alpha_cfr_log_sigma = 0.1,
      z_alpha_cfr_raw = rep(0, G),
      rho_cfr_log_mu = d$rho_cfr_log_mu_hyper_a, rho_cfr_log_sigma = 0.1,
      z_rho_cfr_raw = rep(0, G),
      cases_coef = 1)
  } else {
    G_gp <- if (d$gp_shared_transmission == 1L) 1L else G
    G_int <- if (d$gp_shared_intercepts == 1L) 1L else G
    init <- list(
      eta = matrix(0, G_gp, n_basis),
      mu_cfr_intercept = rep(d$mu_cfr_intercept_hyper_a, G_int),
      eta_cfr = matrix(0, G_gp, n_basis),
      log_phi = d$phi_hyper_a, log_phi_deaths = d$phi_deaths_hyper_a,
      mu_beta_intercept = rep(d$mu_beta_intercept_hyper_a, G_int),
      log_alpha = rep(d$alpha_log_mu_hyper_a, G_gp), log_rho = rep(d$rho_log_mu_hyper_a, G_gp),
      log_alpha_cfr = rep(d$alpha_cfr_log_mu_hyper_a, G_gp),
      log_rho_cfr = rep(d$rho_cfr_log_mu_hyper_a, G_gp),
      cases_coef = 1)
  }
  c(init, vl)
}
