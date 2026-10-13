# Historical Rut Timing — Source and Accuracy Rules

Status: research foundation only; not a live feature and not a verified nationwide dataset.

## Alabama primary source
Alabama Wildlife and Freshwater Fisheries (WFF), "The Alabama Rut":
https://www.eregulations.com/alabama/hunting/the-alabama-rut

WFF describes a regional map based on data from 282 sites in 66 counties collected since 1995. Breeding timing may differ by weeks even within a county. Do not infer a single precise county peak date from a state-level legend.

Official WFF map (regional color bands):
https://www.eregulations.com/assets/docs/resources/AL/25ALAB_LR_2025-07-17-211124_buca.pdf

Published legend windows:
- November 10–23
- November 24–December 8
- December 9–24
- December 25–January 8
- January 9–24
- January 25–February 8

These are map legend bins, NOT six statewide simultaneous predictions. Geographic mapping must be validated before use.

## Data model requirements
- source title, publisher, URL, published/reviewed date, source type
- geographic coverage: polygon or verified region identifier (not guessed county)
- annual date window with year-wrap support
- evidence level and explicit limitations
- separate layer and legend from real hunter reports
- unmapped regions labeled "Historical timing unavailable"
- never infer current activity from historical breeding timing
- no invented reports or simulated map activity on the public layer

## Release gate
Do not enable historical colors until region-to-window assignments have been independently checked against the source map and map display tested on mobile.
