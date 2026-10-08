// Prequential revision 2 (preq2), 2026-10-02 revision 1. See DIFF_FROM_PARENT.md.
functions {
  matrix hsgp_phi_eq(
    int N_points,
    int M,
    real L,
    vector x
  ) {
    matrix[N_points, M] Phi;
    for (m in 1:M) {
      Phi[, m] = sin(m * pi() * (x + rep_vector(L, N_points)) / (2 * L)) /
        sqrt(L);
    }
    return Phi;
  }

  // Square root of the exponentiated-quadratic spectral density evaluated at
  // the Laplacian frequencies omega_m = m*pi/(2L).  alpha is the marginal SD,
  // matching the dense EQ covariance convention in the exact model30 core.
  vector hsgp_diag_spd_eq(real alpha, real rho, real L, int M) {
    vector[M] spd;
    real factor = alpha * sqrt(sqrt(2 * pi()) * rho);
    for (m in 1:M) {
      real omega = m * pi() / (2 * L);
      spd[m] = factor * exp(-0.25 * square(rho * omega));
    }
    return spd;
  }

  real spectral_radius_nonnegative(matrix A) {
    int K = rows(A);
    vector[K] v = rep_vector(1 / sqrt(K + 0.0), K);
    for (iter in 1:100) {
      vector[K] w = A * v;
      real norm_w = sqrt(dot_self(w));
      if (norm_w < 1e-12) return 0;
      v = w / norm_w;
    }
    return fmax(dot_product(v, A * v) / dot_self(v), 0);
  }

  real death_mean_at_t(
    int t,
    int K_pi,
    vector pi,
    vector CFR_g,
    vector latent_cases_g
  ) {
    real out = 0;
    int kmax = min(t - 1, K_pi);
    if (kmax < 1) return 0;
    for (k in 1:kmax) {
      int source_t = t - k;
      out += CFR_g[source_t] * latent_cases_g[source_t] * pi[k];
    }
    return out;
  }

}

data {
  int<lower=1> N;
  int<lower=0> N_pre;
  int<lower=1> N_fit;
  int<lower=1> H;
  int<lower=1> tau;
  int<lower=1> initialization_days;
  array[N] int ts;
  int<lower=2> G;
  int<lower=0, upper=1> gp_shared_transmission;
  int<lower=0, upper=1> gp_shared_cfr;
  int<lower=0, upper=1> gp_shared_intercepts;
  array[G] int<lower=1> N_age;
  matrix<lower=0>[G, G] contact_matrix_mean;
  array[G, N] int<lower=0> cases;
  array[G, N] int<lower=0> deaths;
  array[G, N] int<lower=0, upper=1> death_observed;
  int<lower=0, upper=1> use_death_prewindow;
  matrix<lower=0>[G, N] death_prewindow_case_exposure;
  matrix<lower=0>[G, N] vl_sum;
  int<lower=1> K_pi;
  vector<lower=0>[K_pi] pi;
  real<lower=0, upper=1> death_lik_min_kernel_mass;
  int<lower=0, upper=1> use_vl;
  int<lower=0, upper=1> age_vl_coefficients;

  int<lower=1> hsgp_M_beta;
  int<lower=1> hsgp_M_cfr;
  real hsgp_domain_start;
  real hsgp_domain_end;
  real hsgp_center;
  real<lower=0> hsgp_L;

  real mu_beta_intercept_hyper_a;
  real<lower=0> mu_beta_intercept_hyper_b;
  real alpha_log_mu_hyper_a;
  real<lower=0> alpha_log_mu_hyper_b;
  real<lower=0> alpha_log_sigma_hyper_b;
  real rho_log_mu_hyper_a;
  real<lower=0> rho_log_mu_hyper_b;
  real<lower=0> rho_log_sigma_hyper_b;

  real<lower=0> cases_coef_hyper_b;
  real<lower=0> vl_coef_prior_sd;
  real vl_power_log_hyper_a;
  real<lower=0> vl_power_log_hyper_b;

  real mu_cfr_intercept_hyper_a;
  real<lower=0> mu_cfr_intercept_hyper_b;
  real alpha_cfr_log_mu_hyper_a;
  real<lower=0> alpha_cfr_log_mu_hyper_b;
  real<lower=0> alpha_cfr_log_sigma_hyper_b;
  real rho_cfr_log_mu_hyper_a;
  real<lower=0> rho_cfr_log_mu_hyper_b;
  real<lower=0> rho_cfr_log_sigma_hyper_b;

  real phi_hyper_a;
  real<lower=0> phi_hyper_b;
  real phi_deaths_hyper_a;
  real<lower=0> phi_deaths_hyper_b;
}

transformed data {
  int N_all = N + H;
  int G_vl = age_vl_coefficients == 1 ? G : 1;
  int G_beta = gp_shared_transmission == 1 ? 1 : G;
  int G_cfr = gp_shared_cfr == 1 ? 1 : G;
  int G_beta_int = gp_shared_intercepts == 1 ? 1 : G;
  int G_cfr_int = gp_shared_intercepts == 1 ? 1 : G;
  vector[N_all] hsgp_x;
  matrix[N_all, hsgp_M_beta] hsgp_Phi_beta;
  matrix[N_all, hsgp_M_cfr] hsgp_Phi_cfr;
  array[N_all] real ts_all;
  array[N] int<lower=0, upper=1> death_lik_active = rep_array(0, N);
  vector<lower=0>[G] vl_forecast_mean5 = rep_vector(0, G);

  if (N_pre != 0 || N_fit != N) {
    reject("Model31 requires N_pre=0 and N_fit=N; got N_pre=", N_pre,
           ", N_fit=", N_fit, ", N=", N);
  }
  if (initialization_days != tau || N <= initialization_days) {
    reject("Model31 requires initialization_days=tau and N>tau; got init=",
           initialization_days, ", tau=", tau, ", N=", N);
  }
  if (use_vl == 1 && vl_coef_prior_sd <= 0) {
    reject("Model31 requires a positive data-derived vl_coef_prior_sd.");
  }
  if (gp_shared_transmission != gp_shared_cfr) {
    reject("preq2 requires gp_shared_transmission == gp_shared_cfr.");
  }
  if (gp_shared_transmission == 0 && gp_shared_intercepts == 1) {
    reject("preq2: independent GPs (MGP) require age-specific intercepts.");
  }
  for (g in 1:G) {
    int initial_cases = 0;
    for (t in 1:initialization_days) initial_cases += cases[g, t];
    if (initial_cases > N_age[g]) {
      reject("Initial cases exceed population for age group ", g, ".");
    }
  }
  for (t in 1:N) ts_all[t] = ts[t];
  for (h in 1:H) ts_all[N + h] = ts[N] + h;

  for (t in 1:N_all) hsgp_x[t] = ts_all[t] - hsgp_center;
  if (ts_all[1] < hsgp_domain_start || ts_all[N_all] > hsgp_domain_end) {
    reject("HSGP time range [", ts_all[1], ",", ts_all[N_all],
           "] lies outside fixed domain [", hsgp_domain_start, ",",
           hsgp_domain_end, "].");
  }
  if (max(abs(hsgp_x)) >= hsgp_L) {
    reject("HSGP padded half-width L=", hsgp_L,
           " must exceed max centered time magnitude=", max(abs(hsgp_x)), ".");
  }
  hsgp_Phi_beta = hsgp_phi_eq(N_all, hsgp_M_beta, hsgp_L, hsgp_x);
  hsgp_Phi_cfr = hsgp_phi_eq(N_all, hsgp_M_cfr, hsgp_L, hsgp_x);

  for (g in 1:G) {
    int first_vl_day = max(1, N - 4);
    for (t in first_vl_day:N) vl_forecast_mean5[g] += vl_sum[g, t];
    vl_forecast_mean5[g] /= N - first_vl_day + 1;
  }

  for (t in 1:N) {
    if (use_death_prewindow == 1) {
      death_lik_active[t] = 1;
    } else {
      real pi_mass = 0;
      int kmax = min(t - 1, K_pi);
      if (kmax >= 1) for (k in 1:kmax) pi_mass += pi[k];
      death_lik_active[t] = pi_mass >= death_lik_min_kernel_mass ? 1 : 0;
    }
  }
}

parameters {
  // Direct age-specific log-beta intercepts: deliberately not an R0 transform.
  vector[G_beta_int] mu_beta_intercept;

  vector[G_beta] log_alpha;
  vector[G_beta] log_rho;
  matrix[G_beta, hsgp_M_beta] eta;

  real<lower=0> cases_coef;
  array[use_vl] vector<lower=0>[G_vl] vl_coef;
  array[use_vl] vector<lower=0>[G_vl] vl_power;

  vector[G_cfr_int] mu_cfr_intercept;
  vector[G_cfr] log_alpha_cfr;
  vector[G_cfr] log_rho_cfr;
  matrix[G_cfr, hsgp_M_cfr] eta_cfr;

  real log_phi;
  real log_phi_deaths;
}

transformed parameters {
  vector<lower=0>[G] alpha;
  vector<lower=0>[G] rho;
  vector<lower=0>[G] alpha_cfr;
  vector<lower=0>[G] rho_cfr;
  vector[G] mu_beta_intercept_age;
  vector[G] mu_cfr_intercept_age;
  matrix[G_beta, N + H] f_beta_raw;
  matrix[G_cfr, N + H] f_cfr_raw;
  real<lower=0> phi = exp(log_phi);
  real<lower=0> phi_deaths = exp(log_phi_deaths);

  matrix[G, N + H] f_all;
  matrix[G, N + H] beta_all;
  matrix<lower=0, upper=1>[G, N + H] CFR;
  matrix<lower=0>[G, N + H] latent_cases_all = rep_matrix(0, G, N + H);
  matrix<lower=0>[G, N + H] S_all = rep_matrix(0, G, N + H);
  matrix<lower=0>[G, N + H] I_cases_all = rep_matrix(0, G, N + H);
  matrix<lower=0>[G, N + H] I_vl_all = rep_matrix(0, G, N + H);
  matrix<lower=0>[G, N + H] I_all = rep_matrix(0, G, N + H);
  matrix<lower=0>[G, N + H] infectious_pressure = rep_matrix(0, G, N + H);
  matrix<lower=0, upper=1>[G, N + H] vl_fraction_all = rep_matrix(0, G, N + H);
  matrix<lower=0>[G, N + H] muD = rep_matrix(0, G, N + H);

  matrix[G, N] beta;
  matrix<lower=0>[G, N] I;
  matrix<lower=0>[G, N] S;
  matrix<lower=0>[G, N] mu_C;
  matrix<lower=0>[G, N] p;

  for (j in 1:G_beta) {
    f_beta_raw[j] = (hsgp_Phi_beta *
      (hsgp_diag_spd_eq(exp(log_alpha[j]), exp(log_rho[j]), hsgp_L, hsgp_M_beta) .* to_vector(eta[j])))';
    f_beta_raw[j] = f_beta_raw[j] - mean(f_beta_raw[j, 1:N]);
  }
  for (j in 1:G_cfr) {
    f_cfr_raw[j] = (hsgp_Phi_cfr *
      (hsgp_diag_spd_eq(exp(log_alpha_cfr[j]), exp(log_rho_cfr[j]), hsgp_L, hsgp_M_cfr) .* to_vector(eta_cfr[j])))';
    f_cfr_raw[j] = f_cfr_raw[j] - mean(f_cfr_raw[j, 1:N]);
  }
  for (g in 1:G) {
    int j = gp_shared_transmission == 1 ? 1 : g;
    int k = gp_shared_cfr == 1 ? 1 : g;
    mu_cfr_intercept_age[g] = mu_cfr_intercept[gp_shared_intercepts == 1 ? 1 : g];
    alpha[g] = exp(log_alpha[j]);
    rho[g] = exp(log_rho[j]);
    alpha_cfr[g] = exp(log_alpha_cfr[k]);
    rho_cfr[g] = exp(log_rho_cfr[k]);
    mu_beta_intercept_age[g] = mu_beta_intercept[gp_shared_intercepts == 1 ? 1 : g];
    for (t in 1:(N + H)) {
      f_all[g, t] = mu_beta_intercept_age[g] + f_beta_raw[j, t];
      beta_all[g, t] = exp(f_all[g, t]);
      CFR[g, t] = inv_logit(mu_cfr_intercept_age[g] + f_cfr_raw[k, t]);
    }
    for (t in 1:initialization_days) {
      latent_cases_all[g, t] = cases[g, t];
      if (t == 1) {
        S_all[g, t] = N_age[g] - latent_cases_all[g, t];
      } else {
        S_all[g, t] = S_all[g, t - 1] - latent_cases_all[g, t];
      }
    }
  }

  for (t in 1:(N + H)) {
    int start_t = max(1, t - tau + 1);
    for (g in 1:G) {
      int a = age_vl_coefficients == 1 ? g : 1;
      real cases_component = 0;
      real vl_component = 0;
      for (s in start_t:t) {
        // Condition on every observed source day in the lag window.
        if (s <= N) {
          cases_component += cases[g, s];
        } else {
          cases_component += latent_cases_all[g, s];
        }
        if (use_vl == 1) {
          real vl_s = s <= N ? vl_sum[g, s] : vl_forecast_mean5[g];
          vl_component += pow(vl_s, vl_power[1][a]);
        }
      }
      I_cases_all[g, t] = cases_coef * cases_component;
      if (use_vl == 1) I_vl_all[g, t] = vl_coef[1][a] * vl_component;
      I_all[g, t] = I_cases_all[g, t] + I_vl_all[g, t];
      if (I_all[g, t] > 0) {
        vl_fraction_all[g, t] = I_vl_all[g, t] / I_all[g, t];
      }
    }

    if (t >= initialization_days && t < N + H) {
      for (g in 1:G) {
        real next_cases;
        for (h in 1:G) {
          // Orientation audit: h is the infectious/source group, so N_age[h].
          infectious_pressure[g, t] += contact_matrix_mean[g, h] *
            I_all[h, t] / N_age[h];
        }
        next_cases = beta_all[g, t] * S_all[g, t] * infectious_pressure[g, t];
        // Incidence cannot exceed the remaining susceptible population.
        if (next_cases > S_all[g, t]) next_cases = S_all[g, t];
        latent_cases_all[g, t + 1] = next_cases;
        S_all[g, t + 1] = S_all[g, t] - next_cases;
      }
    }
  }

  for (g in 1:G) {
    vector[N + H] CFR_g = to_vector(CFR[g, :]);
    vector[N + H] latent_cases_g = to_vector(latent_cases_all[g, :]);
    for (t in 1:(N + H)) {
      muD[g, t] = death_mean_at_t(t, K_pi, pi, CFR_g, latent_cases_g);
      if (use_death_prewindow == 1 && t <= N) {
        muD[g, t] += CFR[g, 1] * death_prewindow_case_exposure[g, t];
      }
    }
    for (t in 1:N) {
      beta[g, t] = beta_all[g, t];
      I[g, t] = I_all[g, t];
      S[g, t] = S_all[g, t];
      // Compatibility output: predictor-time mean for observation t+1.
      mu_C[g, t] = latent_cases_all[g, t + 1];
      p[g, t] = S_all[g, t] > 0 ? mu_C[g, t] / S_all[g, t] : 0;
    }
  }
}

model {
  mu_beta_intercept ~ normal(
    mu_beta_intercept_hyper_a, mu_beta_intercept_hyper_b
  );

  log_alpha ~ normal(alpha_log_mu_hyper_a, alpha_log_mu_hyper_b);
  log_rho ~ normal(rho_log_mu_hyper_a, rho_log_mu_hyper_b);
  to_vector(eta) ~ std_normal();

  cases_coef ~ normal(0, cases_coef_hyper_b);
  if (use_vl == 1) {
    vl_coef[1] ~ normal(0, vl_coef_prior_sd);
    vl_power[1] ~ lognormal(vl_power_log_hyper_a, vl_power_log_hyper_b);
  }

  mu_cfr_intercept ~ normal(
    mu_cfr_intercept_hyper_a, mu_cfr_intercept_hyper_b
  );
  log_alpha_cfr ~ normal(
    alpha_cfr_log_mu_hyper_a, alpha_cfr_log_mu_hyper_b
  );
  log_rho_cfr ~ normal(rho_cfr_log_mu_hyper_a, rho_cfr_log_mu_hyper_b);
  to_vector(eta_cfr) ~ std_normal();

  log_phi ~ normal(phi_hyper_a, phi_hyper_b);
  log_phi_deaths ~ normal(phi_deaths_hyper_a, phi_deaths_hyper_b);
  for (g in 1:G) {
    for (t in (initialization_days + 1):N) {
      cases[g, t] ~ neg_binomial_2(
        latent_cases_all[g, t] + 1e-12,
        phi
      );
    }
    for (t in 1:N) {
      if (death_lik_active[t] == 1 && death_observed[g, t] == 1) {
        deaths[g, t] ~ neg_binomial_2(
          muD[g, t] + 1e-12,
          phi_deaths
        );
      }
    }
  }
}

generated quantities {
  matrix[G, N] log_lik_cases = rep_matrix(negative_infinity(), G, N);
  matrix[G, N] log_lik_deaths = rep_matrix(negative_infinity(), G, N);
  array[G, N + H] int<lower=0> y_rep_cases = rep_array(0, G, N + H);
  array[G, N + H] int<lower=0> y_rep_deaths = rep_array(0, G, N + H);
  array[N] int<lower=0, upper=1> case_lik_included = rep_array(0, N);
  array[N] int<lower=0, upper=1> death_lik_included = death_lik_active;
  array[G, N] int<lower=0, upper=1> death_lik_included_age_time =
    rep_array(0, G, N);
  // Andersson & Britton (2000, ch. 6) multitype reproduction numbers, frozen at time t.
  // K[g,h]: expected new reported cases in group g (infectee) per infective in group h
  // (infector) over tau days. Spectral radius via power iteration (K is nonnegative).
  //   naive : each reported case is one infective (unit weight).
  //   case  : cases_coef * naive (case channel of the active set).
  //   vlapp : source weight q_h = I_all[h,t] / (cases in h's tau-day source window),
  //           i.e. VL-signalled pressure apportioned to current cases; equals case for I=C.
  //   R_t_* uses S = N_age (fully susceptible); R_eff_* uses S = S_all.
  vector[N + H] R_t_naive;
  vector[N + H] R_eff_naive;
  vector[N + H] R_t_case;
  vector[N + H] R_eff_case;
  vector[N + H] R_t_vlapp;
  vector[N + H] R_eff_vlapp;

  for (t in (initialization_days + 1):N) case_lik_included[t] = 1;

  for (g in 1:G) {
    for (t in 1:(N + H)) {
      real case_obs_mean = latent_cases_all[g, t] + 1e-12;
      real death_obs_mean = muD[g, t] + 1e-12;
      y_rep_cases[g, t] = neg_binomial_2_rng(case_obs_mean, phi);
      if (muD[g, t] > 0) {
        y_rep_deaths[g, t] = neg_binomial_2_rng(death_obs_mean, phi_deaths);
      }
      if (t <= N) {
        if (t > initialization_days) {
          log_lik_cases[g, t] = neg_binomial_2_lpmf(
            cases[g, t] | case_obs_mean, phi
          );
        }
        if (death_lik_active[t] == 1 && death_observed[g, t] == 1) {
          death_lik_included_age_time[g, t] = 1;
          log_lik_deaths[g, t] = neg_binomial_2_lpmf(
            deaths[g, t] | death_obs_mean, phi_deaths
          );
        }
      }
    }
  }

  for (t in 1:(N + H)) {
    int start_t = max(1, t - tau + 1);
    matrix[G, G] K_full;
    matrix[G, G] K_susc;
    vector[G] q;
    for (h in 1:G) {
      real window_cases = 0;
      for (s in start_t:t) {
        if (s <= N) {
          window_cases += cases[h, s];
        } else {
          window_cases += latent_cases_all[h, s];
        }
      }
      q[h] = window_cases > 0 ? I_all[h, t] / window_cases : cases_coef;
    }
    for (g in 1:G) {
      for (h in 1:G) {
        K_full[g, h] = tau * beta_all[g, t] * N_age[g] * contact_matrix_mean[g, h] / N_age[h];
        K_susc[g, h] = tau * beta_all[g, t] * S_all[g, t] * contact_matrix_mean[g, h] / N_age[h];
      }
    }
    R_t_naive[t] = spectral_radius_nonnegative(K_full);
    R_eff_naive[t] = spectral_radius_nonnegative(K_susc);
    R_t_case[t] = cases_coef * R_t_naive[t];
    R_eff_case[t] = cases_coef * R_eff_naive[t];
    R_t_vlapp[t] = spectral_radius_nonnegative(K_full * diag_matrix(q));
    R_eff_vlapp[t] = spectral_radius_nonnegative(K_susc * diag_matrix(q));
  }
}
