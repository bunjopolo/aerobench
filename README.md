# AeroBench

A web application for analyzing cycling aerodynamics using virtual elevation methods. Upload GPX files from your power meter and calculate your CdA (coefficient of drag area) and Crr (coefficient of rolling resistance).

## Features

### Quick Test
Analyze a single GPX file without saving. Supports three analysis methods:
- **Chung Method** - Standard virtual elevation analysis for loop courses
- **Shen Method** - Two acceleration runs on flat ground to separate CdA from Crr
- **Climb Method** - Two runs up the same climb at different speeds

### Studies
Organize and track your aero testing:
- **Averaging Mode** - Collect multiple runs to get reliable average values
- **Comparison Mode** - Test different configurations (helmets, positions, wheels) side-by-side

### Estimator
Predict speed and time based on your measured values:
- Manual mode for quick calculations
- Route file mode for realistic terrain simulation
- Power sensitivity analysis

### Physics Presets
Save your tested CdA, Crr, mass, efficiency, and air density values. Load them instantly in the Estimator.

### Air Density Calculator
Calculate air density from temperature, elevation or pressure, and humidity.

## The Physics

The virtual elevation method solves the power balance equation:

```
P = P_aero + P_rolling + P_gravity + P_acceleration
```

By rearranging and integrating, we calculate a "virtual elevation" that should match GPS elevation when CdA and Crr are correct. The solver optimizes these values to minimize the difference.

## Requirements

- Power meter (dual-sided preferred)
- Wheel-based speed sensor (GPS speed is too noisy)
- Head unit recording at 1-second intervals

## Tech Stack

- React + Vite + Tailwind CSS
- Supabase (PostgreSQL + Auth)
- Plotly.js for charts
