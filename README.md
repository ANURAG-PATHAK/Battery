# EV Battery Insight Service

## Overview

This repository hosts a TypeScript + Express service that ingests EV telemetry, persists data in SQLite, and surfaces actionable vehicle insights. The implementation roadmap is tracked in [tasks.md](tasks.md) and detailed in [plan.md](plan.md).

## Runtime Requirements

| Tool        | Recommended | Verified locally |
| ----------- | ----------- | ---------------- |
| Node.js     | 20.x LTS    | 25.2.1           |
| npm         | 10.x+       | 11.7.0           |
| sqlite3 CLI | 3.45+       | 3.45.0           |

> Use Node 20 in production environments. Later versions (e.g., 25.x) work for development but are not the target LTS.

## Getting Started

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and adjust values as needed.
3. Generate build artifacts: `npm run build`
4. Start the service in development mode: `npm run dev`

## Configuration

Environment variables (load via `.env`):

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `PORT` | Port used by the HTTP server. | `3000` |
| `API_KEY` | API key expected in `x-api-key` header for all `/api/v1` routes. | `demo-api-key` |
| `DATABASE_PATH` | SQLite database location. | `./data/battery.sqlite` |
| `LOG_LEVEL` | Pino log level. | `info` |
| `SIMULATION_DEFAULT_VEHICLE_ID` | Vehicle id fallback used by simulation runs. | `simulated-vehicle` |

## npm Scripts

| Script                 | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `npm run build`        | Compile TypeScript to `dist/`.                   |
| `npm run start`        | Run compiled application from `dist/index.js`.   |
| `npm run dev`          | Launch the development server via `ts-node-dev`. |
| `npm run lint`         | Lint all TypeScript sources.                     |
| `npm run lint:fix`     | Lint and auto-fix where possible.                |
| `npm run format`       | Check formatting without applying changes.       |
| `npm run format:write` | Apply Prettier formatting to supported files.    |
| `npm run clean`        | Remove compiled output in `dist/`.               |
| `npm run db:migrate`   | Apply pending SQLite migrations.                 |
| `npm run simulate`     | Run a simulation scenario via `scripts/simulate.ts`. |

## API Overview

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/api/v1/telemetry` | Ingest telemetry, score vehicle health, and persist history. |
| `GET` | `/api/v1/vehicles/{vehicleId}/insights` | Retrieve latest score, alerts, and tips for a vehicle. |
| `GET` | `/api/v1/simulate/scenarios` | List deterministic simulation scenarios. |
| `POST` | `/api/v1/simulate/drive` | Execute a simulated drive; optionally persist telemetry. |

### Example Requests

```bash
# Telemetry ingestion
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  http://localhost:3000/api/v1/telemetry \
  -d '{
    "vehicleId": "demo-vehicle",
    "timestamp": "2024-01-01T08:00:00.000Z",
    "batteryPercentage": 82,
    "speedKmph": 22,
    "engineOn": true,
    "charging": false
  }'

# Insights lookup
curl -H "x-api-key: ${API_KEY}" \
  http://localhost:3000/api/v1/vehicles/demo-vehicle/insights

# Simulation run without persistence
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  http://localhost:3000/api/v1/simulate/drive \
  -d '{ "scenario": "urban", "persist": false }'
```

## Database Operations

The service stores data in a SQLite database located at `./data/battery.sqlite` by default. Adjust the path via the `DATABASE_PATH` environment variable.

- Apply migrations: `npm run db:migrate`
- Reset database (development):
  1. Delete the database file under `data/` (if present).
  2. Re-run migrations with `npm run db:migrate`.

## Contribution Workflow

Before opening a pull request:

1. Run `npm run lint`
2. Run `npm run format:write`
3. Run `npm run build`

See [CONTRIBUTING.md](CONTRIBUTING.md) for more details.
