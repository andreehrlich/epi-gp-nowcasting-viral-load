# Model classes, active sets, priors and per-dataset settings.

# GP classes for the age-specific transmission rate beta[g, t] and CFR[g, t]:
#   sgp   one GP path and one intercept shared by all age groups;
#   sgpai one shared GP path, age-specific intercepts;
#   mgp   independent GP paths and intercepts per age group;
#   exgp  exchangeable age GPs: log hyperparameters drawn around a common
#         location, log theta_g = mu + sigma z_g (stan/exgp_*.stan).
ARMS <- c("sgp", "sgpai", "mgp", "exgp")

# Active sets (infectious pressure I[g, t] over the last tau days):
#   I=C     I = c sum_s C[g, s]
#   I=VL+C  I = c sum_s C[g, s] + b sum_s VL[g, s]^p
VARIANTS <- c("I=C", "I=VL+C")
variant_tag <- function(variant) c("I=C" = "C", "I=VL+C" = "VLC")[[variant]]

stan_file <- function(arm, implementation = c("hsgp", "dense")) {
  implementation <- match.arg(implementation)
  family <- if (arm == "exgp") "exgp" else "gp"
  file.path(repo_root(), "stan", paste0(family, "_", implementation, ".stan"))
}

# Forecast origins N (training days 1..N) and the last origin, which fixes the
# HSGP domain. Brazil and Ottawa use every 10 days; the wastewater case studies
# every 14 days.
DATASET_SETTINGS <- list(
  brazil   = list(origins = seq(180L, 360L, 10L)),
  sp       = list(origins = seq(180L, 348L, 14L)),
  ottawa   = list(origins = seq(90L, 390L, 10L)),
  toronto  = list(origins = seq(90L, 300L, 14L)),
  scotland = list(origins = seq(90L, 468L, 14L))
)
HORIZON <- 14L
TAU <- 6L  # infectious period (days): window of the active set

# Lognormal(mu, s) with a given mean m and CV: s^2 = log(1 + CV^2), mu = log m - s^2 / 2.
lognormal_from_mean_cv <- function(mean, cv) {
  s2 <- log(1 + cv^2)
  c(a = log(mean) - s2 / 2, b = sqrt(s2))
}

# ExGP: log theta_g = mu + sigma z_g with z_g ~ N(0, 1), mu ~ N(a, b) and
# sigma ~ HalfNormal(0, c). The prior of b is chosen so that the marginal prior
# of theta_g matches the SGP/MGP lognormal (same mean, or same median, and same
# CV). With V = log((1 + CV^2) sqrt(1 - 4c^2) / (1 - c^2)):
#   b = sqrt(V),  a = log(mean) - V / 2 + log(1 - c^2) / 2   (mean matched), or
#                 a = log(median)                            (median matched).
exgp_location_prior <- function(cv, scale, mean = NULL, median = NULL) {
  c2 <- scale^2
  V <- log((1 + cv^2) * sqrt(1 - 4 * c2) / (1 - c2))
  a <- if (!is.null(median)) log(median) else log(mean) - V / 2 + log(1 - c2) / 2
  c(a = a, b = sqrt(V))
}

EXGP_POOL_SCALE <- 0.15  # HalfNormal(0, 0.15) on the pooling SDs

# Prior hyperparameters passed to Stan.
#   GP amplitude alpha (log beta): lognormal, mean 0.5, SD 0.25;
#   GP amplitude alpha (logit CFR): lognormal, mean 0.25, SD 0.125;
#   GP length scale rho (both): lognormal, median 14 days, CV 0.35;
#   transmission intercept ~ N(-3, 1.2); CFR intercept ~ N(logit 0.02, 1.25);
#   case coefficient c ~ HalfNormal(0, 2);
#   NB dispersion: log phi_cases ~ N(log 3, 1), log phi_deaths ~ N(log 100, 1).
prior_data <- function(arm) {
  alpha <- lognormal_from_mean_cv(0.5, 0.5)
  alpha_cfr <- lognormal_from_mean_cv(0.25, 0.5)
  rho <- c(a = log(14), b = sqrt(log(1 + 0.35^2)))
  if (arm == "exgp") {
    alpha <- exgp_location_prior(0.5, EXGP_POOL_SCALE, mean = 0.5)
    alpha_cfr <- exgp_location_prior(0.5, EXGP_POOL_SCALE, mean = 0.25)
    rho <- exgp_location_prior(0.35, EXGP_POOL_SCALE, median = 14)
  }
  p <- list(
    mu_beta_intercept_hyper_a = -3, mu_beta_intercept_hyper_b = 1.2,
    alpha_log_mu_hyper_a = unname(alpha["a"]), alpha_log_mu_hyper_b = unname(alpha["b"]),
    alpha_log_sigma_hyper_b = EXGP_POOL_SCALE,
    rho_log_mu_hyper_a = unname(rho["a"]), rho_log_mu_hyper_b = unname(rho["b"]),
    rho_log_sigma_hyper_b = EXGP_POOL_SCALE,
    cases_coef_hyper_b = 2,
    mu_cfr_intercept_hyper_a = stats::qlogis(0.02), mu_cfr_intercept_hyper_b = 1.25,
    alpha_cfr_log_mu_hyper_a = unname(alpha_cfr["a"]), alpha_cfr_log_mu_hyper_b = unname(alpha_cfr["b"]),
    alpha_cfr_log_sigma_hyper_b = EXGP_POOL_SCALE,
    rho_cfr_log_mu_hyper_a = unname(rho["a"]), rho_cfr_log_mu_hyper_b = unname(rho["b"]),
    rho_cfr_log_sigma_hyper_b = EXGP_POOL_SCALE,
    phi_hyper_a = log(3), phi_hyper_b = 1,
    phi_deaths_hyper_a = log(100), phi_deaths_hyper_b = 1
  )
  # The *_log_sigma_hyper_b entries are read only by the ExGP program.
  if (arm == "exgp") {
    p$pool_sd_prior_distr <- 1L  # half-normal pooling SDs
    p$pool_sd_prior_df <- 4L     # unused with the half-normal
  } else {
    flags <- switch(arm, sgp = c(1L, 1L), sgpai = c(1L, 0L), mgp = c(0L, 0L))
    p$gp_shared_transmission <- flags[[1]]
    p$gp_shared_cfr <- flags[[1]]
    p$gp_shared_intercepts <- flags[[2]]
  }
  p
}

# Viral-load term b_g sum_s VL[g, s]^{p_g}.
#   Brazil, Sao Paulo (age-specific PCR series): one coefficient and power per age
#     group; log p ~ N(0, 1); b ~ HalfNormal(0, s_b), with s_b the median over
#     training days 6..90 and age groups of sum_{s=t-5}^t C[g, s] / sum VL[g, s],
#     i.e. the scale on which b converts viral load into case equivalents.
#   Ottawa, Toronto, Scotland (one wastewater series): shared coefficient and
#     power; log p ~ N(0, sqrt 2); s_b = 10.
vl_prior_data <- function(dataset, use_vl, cases, vl) {
  age_specific <- vl_source(dataset) == "age"
  list(
    age_vl_coefficients = as.integer(age_specific),
    vl_power_log_hyper_a = 0,
    vl_power_log_hyper_b = if (age_specific) 1 else sqrt(2),
    vl_coef_prior_sd = if (!use_vl) 1 else if (age_specific) vl_case_scale(cases, vl) else 10
  )
}

vl_case_scale <- function(cases, vl, tau = TAU, reference_days = 90L) {
  roll <- function(x) t(apply(x[, seq_len(reference_days), drop = FALSE], 1, function(r)
    vapply(seq_along(r), function(t) sum(r[max(t - tau + 1L, 1L):t], na.rm = TRUE), numeric(1))))
  cols <- tau:reference_days
  ratio <- as.numeric(roll(cases)[, cols, drop = FALSE] / roll(vl)[, cols, drop = FALSE])
  stats::median(ratio[is.finite(ratio) & ratio > 0])
}
