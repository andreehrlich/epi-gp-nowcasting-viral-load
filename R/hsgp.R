# Hilbert-space GP (HSGP) basis.
#
# On the domain t = 1..T (T = last forecast origin + H), centred at
# c = (T + 1) / 2 with half-width S = (T - 1) / 2, the exponentiated-quadratic
# kernel k(t, t') = alpha^2 exp(-(t - t')^2 / (2 rho^2)) is approximated by
#   f(t) = sum_{m=1}^M sqrt(S(omega_m)) phi_m(t) eta_m,   eta_m ~ N(0, 1),
#   phi_m(t) = sin(m pi (t - c + L) / (2L)) / sqrt(L),   omega_m = m pi / (2L),
#   S(omega) = alpha^2 sqrt(2 pi) rho exp(-(rho omega)^2 / 2),
# on [-L, L] with L = b S. The basis is fixed per dataset (it depends on the
# last origin, not on N), so all folds share one approximation.
#
# Choice of b and M for length scales rho in [2, 150] days, with tail
# probability eps = 1e-5:
#   b = ceil_0.01(1 + rho_max sqrt(log(2 / eps) / 2) / S)  (the kernel at
#       distance S has decayed below eps/2 relative to the boundary),
#   M = ceil(2 L z_{1 - eps/2} / (pi rho_min))         (the spectral density
#       beyond omega_M carries less than eps of its mass at rho_min).
hsgp_basis <- function(max_N, H = 14L, rho_bounds = c(2, 150), eps = 1e-5) {
  half <- (max_N + H - 1) / 2
  boundary <- ceiling(100 * (1 + rho_bounds[2] * sqrt(log(2 / eps) / 2) / half)) / 100
  L <- boundary * half
  M <- ceiling(2 * L * stats::qnorm(1 - eps / 2) / (pi * rho_bounds[1]))
  domain_end <- max_N + H
  list(M = as.integer(M), boundary_factor = boundary, domain_start = 1, domain_end = domain_end,
       center = (1 + domain_end) / 2, L = boundary * (domain_end - 1) / 2)
}

# Error of the rank-M basis against the exact unit-amplitude kernel (plus the
# 1e-6 diagonal jitter of the dense model) at the given length scales.
hsgp_kernel_error <- function(rho, M, L, center, t) {
  d2 <- outer(t, t, "-")^2
  omega <- seq_len(M) * pi / (2 * L)
  Phi <- sin(outer(t - center + L, omega)) / sqrt(L)
  t(vapply(rho, function(r) {
    w <- sqrt(2 * pi) * r * exp(-0.5 * (r * omega)^2)
    approx <- tcrossprod(sweep(Phi, 2L, sqrt(w), "*"))
    exact <- exp(-d2 / (2 * r^2))
    diag(exact) <- diag(exact) + 1e-6
    c(rho = r, max_abs_error = max(abs(approx - exact)),
      rel_frobenius_error = sqrt(sum((approx - exact)^2) / sum(exact^2)))
  }, numeric(3)))
}
