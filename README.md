# Age-stratified GP nowcasting with viral-load data

Replication code for the paper's experiments: Bayesian age-stratified epidemic
models in which the transmission rate and the case fatality ratio (CFR) of each
age group are Gaussian processes (GPs) in time, fitted to daily cases and deaths
with and without viral-load data (PCR viral load in Brazil, wastewater in
Ottawa, Toronto and Scotland).

## What the experiments compare

**GP classes** for the transmission rate \(\beta_{g,t}\) and \(\mathrm{logit}\,\mathrm{CFR}_{g,t}\)
of age group \(g\):

| Arm | Paths | Intercepts |
| --- | --- | --- |
| `sgp` | one GP shared by all ages | shared |
| `sgpai` | one GP shared by all ages | age-specific |
| `mgp` | independent GP per age | age-specific |
| `exgp` | exchangeable GPs: \(\log\theta_g = \mu + \sigma z_g\) for each hyperparameter | age-specific |

**Active sets** (the infectious pressure over the last \(\tau = 6\) days):

- `I=C`: \(I_{g,t} = c \sum_{s=t-\tau+1}^{t} C_{g,s}\)
- `I=VL+C`: \(I_{g,t} = c \sum_s C_{g,s} + b \sum_s \mathrm{VL}_{g,s}^{\,p}\)

Each model is fitted on an expanding window: days \(1..N\) for a grid of forecast
origins \(N\) (leave-future-out). It is then scored on the 14-day forecast of
days \(N+1..N+14\) (CRPS, log score, 90% coverage) and on its in-sample fit
(WAIC). GPs use a Hilbert-space approximation (HSGP); a dense-GP version of each
program serves as the reference for the approximation.

| Dataset | Viral-load source | Forecast origins \(N\) |
| --- | --- | --- |
| `brazil` | PCR Ct values by age (private) | 180, 190, ..., 360 |
| `ottawa` | wastewater N1 | 90, 100, ..., 390 |
| `toronto` | wastewater N2, 4 plants | 90, 104, ..., 300 |
| `scotland` | wastewater N1, site panel | 90, 104, ..., 468 |
| `sp` (São Paulo state) | PCR Ct values by age (private) | 180, 194, ..., 348 |

## Layout

```
R/            data loading, Stan data, priors, HSGP basis, fitting, scores
stan/         the four Stan programs: {gp, exgp} x {hsgp, dense}
data/public/  model inputs (daily counts by age, populations, contact matrices, wastewater)
data/private/ PCR viral load (not distributed; see data/private/README.md)
data-raw/     provenance of every input
scripts/      command-line entry points
results/      fits and scores (created on demand, not tracked)
```

## Requirements

- R >= 4.5 with `cmdstanr` (>= 0.9), `posterior`, `loo` and `jsonlite`.
- CmdStan 2.38.0.

The paper's fits were run with R 4.5.2, cmdstanr 0.9.0 and CmdStan 2.38.0
(stanc3 2.38.0, g++ from Rtools45) on Windows 11, x86-64.

## Running

Run every command from the repository root. Fit one fold:

```bash
Rscript scripts/fit.R dataset=ottawa arm=sgp variant=I=C N=90
```

Fit all GP classes and active sets at the first forecast origin of a dataset:

```bash
Rscript scripts/fit.R dataset=ottawa arm=all variant=all N=90
```

Fit a full grid, or the dense-GP reference:

```bash
Rscript scripts/fit.R dataset=ottawa arm=all variant=all N=all
```

```bash
Rscript scripts/fit.R dataset=ottawa arm=all variant=all N=240 implementation=dense
```

Score all fitted folds (writes `results/forecast_scores.csv` and `results/waic.csv`):

```bash
Rscript scripts/score.R
```

Each fold uses 4 chains, 1500 warmup and 1000 sampling iterations, target
acceptance 0.8, maximum tree depth 12 and seed 1024. A fold takes from minutes
(Ottawa, N = 90) to several hours (Brazil, large N, dense GP).

## Reproducibility

- With the same CmdStan version, compiler and CPU architecture, a fold reproduces
  the paper's draws exactly.
- Each fold directory records the exact CmdStan inputs (`stan_data.json`,
  `init.json`) and their hashes, plus the software versions used (`fit.json`).
- All chains start from the same deterministic initial values (prior centres).
  The seed alone separates them.
- Input doubles are stored with 17 significant digits. They are parsed with a
  correctly rounded parser, because R's `as.numeric` is not correctly rounded
  at that precision.
- Brazil and São Paulo fits with `I=VL+C` need the private PCR series.
  `I=C` fits do not: the Stan program never reads the viral load when
  `use_vl = 0`, so the zeros passed in its place give identical results.
