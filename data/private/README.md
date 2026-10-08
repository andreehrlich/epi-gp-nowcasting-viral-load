# Private data: PCR viral load (Brazil, São Paulo)

The Brazil and São Paulo viral-load series come from individual SARS-CoV-2 RT-PCR
results (cycle threshold, Ct) from a clinical laboratory in São Paulo. The
records are not public and are not distributed with this repository.

Researchers with access place the derived daily series here:

```
data/private/brazil/viral_load.csv   date, age_group, vl_sum
data/private/sp/viral_load.csv       date, age_group, vl_sum
```

`vl_sum` is the sum over the day's positive tests in the age group of the
normalised viral load \(1 - (\mathrm{Ct} - \mathrm{Ct}_{\min}) / (\mathrm{Ct}_{\max} - \mathrm{Ct}_{\min})\),
with limit of detection Ct = 40. Days without tests are empty (they enter the
model as 0). Store values with 17 significant digits.

Without these files the `I=C` fits for Brazil and São Paulo still run and
reproduce the paper exactly. The `I=VL+C` fits stop with an error.
