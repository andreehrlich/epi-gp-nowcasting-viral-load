# Provenance of the model inputs

Every dataset in `data/public/<dataset>/` has the same files:

| File | Content |
| --- | --- |
| `counts.csv` | daily cases and deaths by age group (empty = not observed) |
| `population.csv` | population by age group |
| `contact_matrix.csv` | mean daily contacts \(C_{gh}\) of a person in group \(g\) with group \(h\) |

The wastewater datasets also have `wastewater.csv` (Ottawa) or
`wastewater_samples.csv` (Toronto, Scotland: one row per site and sample day).

## Contact matrices and populations

All contact matrices are the synthetic matrices of Prem et al. (2021), "all
locations", from the R package `contactdata` (16 five-year bands, the last 75+):
Brazil (for Brazil and São Paulo), Canada (Ottawa, Toronto) and the UK
(Scotland). They are aggregated to the four model age groups:

- Brazil, São Paulo and Ottawa use block means (Bernadette's rule). Each
  off-diagonal block of the 16 x 16 matrix becomes its mean. A diagonal block
  becomes the mean of its diagonal plus the mean of its off-diagonal entries.
- Toronto and Scotland use population-weighted row sums:
  \(C_{gh} = \sum_{i\in g} n_i \sum_{j\in h} C_{ij} / n_g\).

The 4 x 4 matrix is then made reciprocal:
\(C \leftarrow \mathrm{diag}(n)^{-1}\,(\mathrm{diag}(n)C + C^\top\mathrm{diag}(n))/2\).

| Dataset | Population | Age groups |
| --- | --- | --- |
| Brazil | UN WPP 2020 (`Bernadette::age_distribution`) | 0-18, 18-40, 40-65, 65+ |
| São Paulo | IBGE SIDRA table 7358, 2020 projection, state 35 | as Brazil |
| Ottawa | Canada age shares scaled to 1,000,000 | as Brazil |
| Toronto | 2021 Census, sum of the 158 neighbourhood profiles | 0-19, 20-39, 40-59, 60+ |
| Scotland | NRS rebased mid-2020 estimates | 0-19, 20-44, 45-64, 65+ |

## Sources

**Brazil** (2020-04-05 to 2022-05-17).
- Cases: e-SUS Notifica notifications by symptom-onset date and age, Ministry of
  Health (opendatasus.saude.gov.br).
- Deaths: SIM mortality records 2020-2022 (opendatasus.saude.gov.br/dataset/sim).
- Viral load: private; see `data/private/README.md`.

**São Paulo state** (2020-04-05 to 2021-05-10). The same sources restricted to
the state. The series stops before 2021-05-11, where the state-level file has
duplicated, conflicting rows.

**Ottawa** (2020-07-29 to 2021-09-06).
- Cases and deaths: City of Ottawa open data. Daily totals are allocated to age
  groups by the daily increments of the published cumulative age-specific
  rates; deaths use the case weights.
- Wastewater: SARS-CoV-2 N1 in primary sludge, Ottawa wastewater surveillance
  (SPHERE, sphere.waterpathogens.org). The 32 missing days enter the model as 0.

**Toronto** (2021-02-11 to 2021-12-31).
- Cases and deaths: Toronto Public Health, "COVID-19 Cases in Toronto"
  (open.toronto.ca, final refresh 2024-02-14). Confirmed and probable cases with
  a known age band are counted by episode date. Deaths are cases with outcome
  FATAL, dated by the same episode date.
- Wastewater: PHAC N2, solid fraction, four Toronto plants (the PHAC export kept
  in github.com/emilysomerset/wastewater_paper_code).

**Scotland** (2020-09-01 to 2021-12-31).
- Cases and deaths: Public Health Scotland, daily trends by age and sex
  (opendata.nhs.scot, `trend_agesex_20231004.csv`).
- Wastewater: Scottish Government N1 RNA monitoring, gc/L
  (github.com/BioRDM/COVID-Wastewater-Scotland). Samples flagged
  "Analysis Failed" are not usable. Repeated same-day samples at a site are
  averaged.

For Toronto and Scotland the wastewater covariate is rebuilt for each forecast
origin from training samples only (`R/wastewater.R`).
