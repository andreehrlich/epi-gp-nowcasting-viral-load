# Case-to-death delay.
#
# Deaths on day t are modelled as CFR-weighted past cases convolved with the
# onset-to-death delay pi_k = P(delay = k days), k = 1..K. The delay is
# Gamma with mean 17.8 days and coefficient of variation 0.45, so
# shape = 1 / CV^2 and rate = shape / mean. It is discretised to whole days:
#   pi_1 = F(1.5) - F(0),  pi_k = F(k + 0.5) - F(k - 0.5) for k >= 2,
# truncated at K = ceil(F^{-1}(0.999)) + 2 = 55 days and renormalised to sum to 1.
onset_to_death_pmf <- function(mean = 17.8, cv = 0.45, tail = 0.999) {
  shape <- 1 / cv^2
  rate <- shape / mean
  K <- ceiling(stats::qgamma(tail, shape = shape, rate = rate)) + 2
  p <- numeric(K)
  p[1] <- stats::pgamma(1.5, shape, rate) - stats::pgamma(0, shape, rate)
  for (k in 2:K) p[k] <- stats::pgamma(k + 0.5, shape, rate) - stats::pgamma(k - 0.5, shape, rate)
  p / sum(p)
}
