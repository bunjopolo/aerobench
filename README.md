# AeroBench

[AeroBench](https://aerobench.vercel.app) is a cycling aerodynamics web app for estimating **CdA** and **Crr** from real ride data using virtual elevation methods.

## What It Does

- Analyzes **FIT ride files** to estimate aerodynamic drag and rolling resistance
- Uses the **Chung virtual elevation workflow** as the primary analysis method
- Lets you crop analysis ranges by chart selection or lap boundaries
- Supports speed source selection (**speed sensor** or GPS) and power offset alignment
- Provides fit diagnostics (RMSE, R², MAE, bias, drift, NRMSE, trend, lag-1 autocorrelation, and observability indicators)

## Analysis Workflows

## Quick Test
For fast, single-file analysis without creating a full study.

## Studies
For structured testing with multiple configurations and repeated runs:
- aggregate results per variation
- baseline comparison
- ranked outcomes and estimated performance deltas

## Setup Analysis
Analyzes a file and saves fitted values back to a setup workflow.

## Environment & Terrain Integration

- Fetches weather from **Open-Meteo** and applies wind/air-density updates
- Shows the exact fetched weather time and location used
- Supports **DEM terrain correction**:
  - manual DEM upload (GeoTIFF / ASCII grid)
  - automatic DEM fetch from **OpenTopography** based on ride GPS bounds

## Course Simulation

- Includes a **Course Simulator** for estimating performance from CdA/Crr and physics inputs
- Supports route-based simulation with GPX terrain profiles

## Built For

Cyclists and testers who want a practical, repeatable way to evaluate:
- position changes
- equipment changes
- setup differences
- real-world aero performance trends
