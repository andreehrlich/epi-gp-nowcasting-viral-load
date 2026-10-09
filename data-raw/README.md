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

All contact matrices are the synthetic matrices of Prem et al. (2021,
[doi:10.1371/journal.pcbi.1009098](https://doi.org/10.1371/journal.pcbi.1009098)),
"all locations", from the R package
[`contactdata`](https://cran.r-project.org/package=contactdata) (16 five-year
bands, the last 75+):
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
| Brazil | 2020, [UN World Population Prospects 2019](https://population.un.org/wpp/), via [`Bernadette::age_distribution`](https://cran.r-project.org/package=Bernadette) | 0-18, 18-40, 40-65, 65+ |
| São Paulo | 2020 projection, state 35, [IBGE SIDRA table 7358](https://sidra.ibge.gov.br/tabela/7358) | as Brazil |
| Ottawa | Canada age shares (`contactdata`) scaled to 1,000,000 | as Brazil |
| Toronto | 2021 Census, sum of the 158 [neighbourhood profiles](https://open.toronto.ca/dataset/neighbourhood-profiles/) | 0-19, 20-39, 40-59, 60+ |
| Scotland | NRS [rebased mid-2020 estimates](https://www.nrscotland.gov.uk/publications/rebased-population-estimates-scotland-mid-2011-to-mid-2021/) | 0-19, 20-44, 45-64, 65+ |

## Sources

All links were checked on 2026-10-09.

**Brazil** (2020-04-05 to 2022-05-17).
- Cases: confirmed notifications of COVID-19 (laboratory or clinical criteria)
  in e-SUS Notifica, Ministry of Health of Brazil, counted by notification date
  and age. Retrieved through the e-SUS Notifica API
  ([Notificações de Síndrome Gripal – API ElasticSearch](https://opendatasus.saude.gov.br/dataset/notificacoes-de-sindrome-gripal-api-elasticsearch));
  yearly files:
  [2020](https://opendatasus.saude.gov.br/dataset/notificacoes-de-sindrome-gripal-leve-2020),
  [2021](https://opendatasus.saude.gov.br/dataset/notificacoes-de-sindrome-gripal-leve-2021),
  [2022](https://opendatasus.saude.gov.br/dataset/notificacoes-de-sindrome-gripal-leve-2022).
- Deaths: Mortality Information System
  ([SIM](https://opendatasus.saude.gov.br/dataset/sim)), 2020-2022 records with a
  COVID-19 ICD-10 code (B34.2, U07.1, U07.2, U04, U04.9) as underlying cause,
  counted by date of death and age.
- Viral load: private; see `data/private/README.md`.

**São Paulo state** (2020-04-05 to 2021-05-10). The same sources restricted to
the state. The series stops before 2021-05-11, where the state-level file has
duplicated, conflicting rows.

**Ottawa** (2020-07-29 to 2021-09-06).
- Cases and deaths: City of Ottawa,
  [COVID-19 Cases and Deaths Ottawa (Historical data)](https://open.ottawa.ca/datasets/81a6b8a6d2824ebd8cfddd933ab043c4_0),
  Open Ottawa. Daily totals are allocated to age groups by the daily increments of
  the published cumulative age-specific rates; deaths use the case weights.
- Wastewater: SARS-CoV-2 N1 in primary sludge at the ROPEC treatment plant,
  [SPHERE wastewater data platform](https://sphere.waterpathogens.org/dataset/181308ef-4f17-478e-98ff-29ab7c6b548d).
  The 32 missing days enter the model as 0.

**Toronto** (2021-02-11 to 2021-12-31).
- Cases and deaths: Toronto Public Health,
  [COVID-19 Cases in Toronto](https://open.toronto.ca/dataset/covid-19-cases-in-toronto/)
  (final refresh 2024-02-14). Confirmed and probable cases with a known age band
  are counted by episode date. Deaths are cases with outcome FATAL, dated by the
  same episode date.
- Wastewater: Public Health Agency of Canada N2, solid fraction, four Toronto
  plants, from the PHAC dashboard export archived in
  [emilysomerset/wastewater_paper_code](https://github.com/emilysomerset/wastewater_paper_code).

**Scotland** (2020-09-01 to 2021-12-31).
- Cases and deaths: Public Health Scotland,
  [COVID-19 in Scotland](https://www.opendata.nhs.scot/dataset/covid-19-in-scotland),
  [daily trends by age and sex](https://www.opendata.nhs.scot/dataset/covid-19-in-scotland/resource/9393bd66-5012-4f01-9bc5-e7a10accacf4)
  (`trend_agesex_20231004.csv`).
- Wastewater: SARS-CoV-2 N1 RNA monitoring in Scottish wastewater, gc/L,
  [BioRDM/COVID-Wastewater-Scotland](https://github.com/BioRDM/COVID-Wastewater-Scotland).
  Samples flagged "Analysis Failed" are not usable. Repeated same-day samples at
  a site are averaged.

For Toronto and Scotland the wastewater covariate is rebuilt for each forecast
origin from training samples only (`R/wastewater.R`).
