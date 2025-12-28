# EV Battery Insight Service – Rules Catalog

This document summarizes the rules, deductions, and driver guidance used by the scoring engine. All thresholds originate from `src/rules/rules.config.ts` and can be tuned without code changes.

## Scoring Overview

- Base score: 100 points.
- Status bands:
  - `GOOD` when score ≥ 80.
  - `MODERATE` when 60 ≤ score < 80.
  - `POOR` when score < 60.
- Rule impacts subtract points (down to a floor of 0) or emit alerts/tips without deductions.

## Rule Reference

| Rule ID | Trigger Condition | Deduction | Alert Summary | Driver Tip |
| ------- | ----------------- | --------- | ------------- | ---------- |
| deep_discharge_warning | Battery percentage drops below 20%. | −5 | Warns about accelerated degradation from deep discharge. | Charge before the pack falls under 20%.
| deep_discharge_critical | Battery percentage drops below 10%. | −10 | Critical alert advising immediate charge to avoid shutdown. | Schedule charging stops earlier to prevent deep discharge.
| idle_drain | Vehicle is on, stationary, and idle for ≥10 minutes. Deduction repeats every additional 10 minutes. | −3 per interval | Highlights unnecessary drain while idling. | Turn the vehicle off or enable eco-idle features when stopped.
| rapid_drop | Current snapshot is ≥15% lower than any snapshot taken in the last 15 minutes. | −4 | Flags rapid depletion indicative of aggressive driving or heavy load. | Adopt smoother acceleration/braking to stabilize consumption.
| slow_charge | Charger active for ≥20 minutes but SoC increase is <5%. | 0 | Informational alert about underperforming charge sessions. | Inspect charger equipment and prefer faster chargers when possible.
| temperature_high | Ambient temperature exceeds 40 °C. | −2 | Warns that extreme heat accelerates degradation. | Park in shade and avoid fast charging in high heat.
| temperature_low | Ambient temperature below 0 °C. | −1 | Notes that cold weather reduces performance and range. | Pre-condition the vehicle while plugged in before driving.

## Evaluation Context Inputs

During each ingestion request the service enriches telemetry with historical context to supply the rules above.

- Idle duration: Computed from the latest stationary snapshots until motion resumes.
- Charging duration and delta: Tracks the ongoing charge session length and percentage gain.
- Rapid drop window: Compares the current state of charge to the last five snapshots within the previous 15 minutes.

## Alert and Tip Mapping

- Alerts combine a human-readable title, message, and severity (`info`, `warning`, or `critical`) for UI surfaces.
- Tips provide concise remediation steps aligned with each alert to assist drivers and fleet operators.

## Telemetry Payload Expectations

Incoming payloads (validated via Zod in `src/models/telemetry.ts`) must include:

- `vehicleId`: Unique identifier for the vehicle.
- `timestamp`: ISO-8601 string in UTC.
- `batteryPercentage`: Integer 0–100.
- `speedKmph`: Current speed.
- `engineOn`: Boolean indicating propulsion system active state.
- `charging`: Boolean indicating if the vehicle is connected to a charger.
- Optional: `ambientTemperature` (°C) and `odometerKm` for richer analytics.

Failure to provide required fields results in a `BAD_REQUEST` response describing validation errors.

## Smartcar Payload Mapping (Example)

| Smartcar field | Internal field | Notes |
| -------------- | -------------- | ----- |
| `vehicle.id` | `vehicleId` | Canonical identifier provided by the API caller. |
| `data.collected_at` | `timestamp` | Convert to an ISO-8601 UTC string before ingestion. |
| `data.battery.percentRemaining` | `batteryPercentage` | Expressed as a whole-number percentage. |
| `data.driveState.speed` | `speedKmph` | Convert mph to km/h when required. |
| `data.vehicleState.isOn` | `engineOn` | Indicates drivetrain activation instead of ICE engine. |
| `data.chargeState.isCharging` | `charging` | True while actively charging or maintaining charge. |
| `data.environment.outsideTempC` | `ambientTemperature` | Optional enrichment used for thermal alerts. |
| `data.odometerKm` | `odometerKm` | Optional field tracked for future trend analytics. |
