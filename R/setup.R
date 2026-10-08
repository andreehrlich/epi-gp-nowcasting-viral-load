# Source every module. Run scripts from the repository root, or set EPIGP_ROOT.
local({
  root <- Sys.getenv("EPIGP_ROOT", ".")
  for (f in c("data.R", "wastewater.R", "delay.R", "hsgp.R", "models.R", "stan_data.R", "fit.R", "scores.R")) {
    path <- file.path(root, "R", f)
    if (file.exists(path)) sys.source(path, envir = globalenv())
  }
})
