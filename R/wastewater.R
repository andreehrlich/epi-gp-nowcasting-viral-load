# Training-only wastewater proxy for Toronto and Scotland.
#
# At forecast origin N only samples with t <= N are used, so no information
# from the forecast window leaks into the covariate:
#   1. usable values: finite, non-negative, not flagged as a failed analysis;
#   2. repeated samples of a site on one day: their mean (Scotland) or an error
#      (Toronto, which has none);
#   3. a fixed coverage panel, chosen by sampling rules only: a site is kept if it
#      has >= min_samples sampled days, its first sample is within edge_days of
#      day 1, its last within edge_days of N, and no gap exceeds max_gap days;
#   4. per site, linear interpolation between sampled days, carrying the nearest
#      sampled value to the edges;
#   5. W_t = mean over the selected sites (equal weights).
# No scaling, smoothing or log transform is applied.

site_panel_repeat_rule <- function(dataset) {
  switch(dataset, scotland = "mean", toronto = "error", stop("No site panel for ", dataset))
}

site_panel_proxy <- function(samples, N, repeat_rule = c("error", "mean"),
                             min_samples = 12L, max_gap = 21L, edge_days = 7L) {
  repeat_rule <- match.arg(repeat_rule)
  x <- samples[samples$t <= N, , drop = FALSE]
  x <- x[as.logical(x$usable) & is.finite(x$value), , drop = FALSE]
  if (any(x$value < 0)) stop("Negative wastewater concentration.")

  key <- paste(x$site, x$t)
  if (anyDuplicated(key) && repeat_rule == "error") {
    stop("Repeated site/day samples need an explicit repeat rule.")
  }
  site_days <- do.call(rbind, lapply(split(x, key, drop = TRUE), function(d)
    data.frame(site = d$site[1], t = d$t[1], value = mean(d$value), stringsAsFactors = FALSE)))

  panel <- do.call(rbind, lapply(split(site_days, site_days$site), function(d) {
    tt <- sort(d$t)
    data.frame(site = d$site[1], n = length(tt), first = min(tt), last = max(tt),
               max_gap = if (length(tt) > 1) max(diff(tt)) else Inf)
  }))
  panel$selected <- panel$n >= min_samples & panel$first <= 1L + edge_days &
    panel$last >= N - edge_days & panel$max_gap <= max_gap
  sites <- panel$site[panel$selected]
  if (!length(sites)) stop("No wastewater site meets the coverage rule at N = ", N, ".")

  per_site <- sapply(sites, function(s) {
    d <- site_days[site_days$site == s, , drop = FALSE]
    d <- d[order(d$t), , drop = FALSE]
    stats::approx(d$t, d$value, xout = seq_len(N), rule = 2)$y
  })
  # Row sums in site order, as in the published fits (rowsum over long format).
  ww <- as.numeric(rowsum(as.vector(per_site), rep(seq_len(N), times = length(sites)))) / length(sites)
  list(ww = ww, panel = panel, sites = sites)
}
