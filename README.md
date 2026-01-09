# AeroBench

A web application for analyzing cycling aerodynamics using the **Chung Method** (Virtual Elevation). Upload your GPX files from cycling workouts and calculate your CdA (coefficient of drag area) and Crr (coefficient of rolling resistance) to optimize your position and equipment.

## What It Does

AeroBench helps cyclists and triathletes measure and track their aerodynamic performance:

### Virtual Elevation Analysis
Upload a GPX file from a cycling computer (with power data) and the app calculates your "virtual elevation" - what the elevation profile would look like if all your power went into overcoming gravity. By matching this to the actual GPS elevation, the solver finds your CdA and Crr values.

### Two Solving Modes
- **Global Solver**: Fits a single CdA/Crr pair across your entire ride
- **Segmented Solver**: Breaks the ride into segments, calculates values for each, and provides weighted averages with confidence intervals - better for variable conditions

### Equipment Setup Tracking
Save different equipment configurations (bikes, wheels, positions) and track how your aerodynamics change over time. Each setup maintains its own analysis history.

### Anomaly Detection
Identifies sections of your ride where the data doesn't fit the model well - useful for finding coasting, drafting, or data quality issues.

### Speed/Power Estimator
Model how changes in CdA, Crr, weight, or gradient affect your speed. Includes sensitivity analysis to see which factors matter most for your target conditions.

### Dashboard Analytics
- Track your CdA progress over time
- Compare speeds across different setups
- View your best measured values

## The Physics

The Chung Method works by solving the power balance equation:

```
P = P_aero + P_rolling + P_gravity + P_acceleration
```

Where:
- **P_aero** = 0.5 × ρ × CdA × v³ (air resistance)
- **P_rolling** = m × g × Crr × v (rolling resistance)
- **P_gravity** = m × g × v × sin(slope)
- **P_acceleration** = m × a × v

By rearranging and integrating, we get a "virtual elevation" that should match GPS elevation when CdA and Crr are correct.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **Charts**: Plotly.js + Recharts
- **Auth**: Google and GitHub OAuth

## Getting Started

1. Clone the repo
2. Copy `.env.example` to `.env` and add your Supabase credentials
3. Run `npm install`
4. Run `npm run dev`

## Database Setup

Run the migration in `supabase/migrations/001_initial_schema.sql` to create the required tables:
- `profiles` - User profiles
- `setups` - Equipment configurations
- `analyses` - Saved analysis results

## License

MIT
