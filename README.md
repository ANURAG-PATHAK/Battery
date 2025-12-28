# EV Battery Insight Service

## Overview

This repository hosts a TypeScript + Express service that ingests EV telemetry, persists data in SQLite, and surfaces actionable vehicle insights.

## Runtime Requirements

| Tool        | Recommended | Verified locally |
| ----------- | ----------- | ---------------- |
| Node.js     | 20.x LTS    | 25.2.1           |
| npm         | 10.x+       | 11.7.0           |
| sqlite3 CLI | 3.45+       | 3.45.0           |

> Use Node 20 in production environments. Later versions (e.g., 25.x) work for development but are not the target LTS.

## Quickstart

1. Install dependencies: `npm install`.
2. Copy [.env.example](.env.example) to `.env` and customize the values (see Environment Configuration).
3. Apply database migrations: `npm run db:migrate`.
4. Launch the development server: `npm run dev` (watches for changes with hot reload).
5. In a separate terminal, send a telemetry payload (see API Usage) to confirm end-to-end flow.

> Tip: keep the SQLite file under `data/` so migrations and the docker-compose volume share the same location.

## Environment Configuration

All configuration is driven through environment variables loaded via `.env`. Refer to [.env.example](.env.example) for inline documentation.

| Variable | Description | Default | When to adjust |
| -------- | ----------- | ------- | -------------- |
| `PORT` | HTTP port exposed by Express. | `3000` | Change to avoid collisions when running alongside other services. |
| `API_KEY` | Shared secret expected in the `x-api-key` header for every `/api/v1` request. | `demo-api-key` | Replace for non-demo environments to prevent unauthorized access. |
| `DATABASE_PATH` | Filesystem path to the SQLite database. | `./data/battery.sqlite` | Point to an alternate file or `:memory:` during tests. |
| `LOG_LEVEL` | Pino log verbosity. | `info` | Increase to `debug` (local troubleshooting) or decrease to `warn` in production. |
| `SIMULATION_DEFAULT_VEHICLE_ID` | Vehicle identifier used when simulations do not supply one. | `simulated-vehicle` | Provide fleet-specific identifiers for demo accuracy. |
| `RATE_LIMIT_WINDOW_MS` | Duration of the rate-limiter window in milliseconds. | `60000` | Tune for higher/lower request throughput based on deployment needs. |
| `RATE_LIMIT_MAX` | Maximum requests allowed per IP within the window. | `120` | Increase for trusted internal callers or tighten for public-facing deployments. |
| `REQUEST_ID_HEADER` | Correlation ID header propagated through logs and responses. | `x-request-id` | Align with upstream gateways that already stamp request identifiers. |
| `SMARTCAR_CLIENT_ID` | Smartcar application client identifier used during OAuth. | _(required)_ | Copy from the Smartcar dashboard (demo or staging tenant). |
| `SMARTCAR_CLIENT_SECRET` | Smartcar application secret. | _(required)_ | Copy from the Smartcar dashboard; never commit this value. |
| `SMARTCAR_REDIRECT_URI` | OAuth redirect URI accepted by your Smartcar app. | _(required)_ | Use `http://localhost:3000/api/v1/smartcar/callback` for local demos. |
| `SMARTCAR_SCOPES` | Comma-separated Smartcar scopes requested during OAuth. | `read_vehicle_info,read_battery,read_charge,read_odometer,read_location` | Adjust when adding new Smartcar capabilities and re-run Smartcar Connect to grant them. |
| `SMARTCAR_MODE` | Smartcar environment (`test` or `live`). | `test` | Switch to `live` when connecting production vehicles. |
| `SMARTCAR_FORCE_PROMPT` | Forces Smartcar Connect to prompt for approval each visit. | `true` | Set to `false` when reusing existing approvals without user interaction. |

After editing `.env`, restart the server so new values take effect.

## Local Development Workflow

- **Install & migrate:** run `npm install` followed by `npm run db:migrate` whenever migrations change.
- **Serve locally:** `npm run dev` starts Express with ts-node-dev; watch console output for pino log lines containing request IDs.
- **Lint & type-check:** execute `npm run lint` and `npm run build` before committing to ensure code quality.
- **Reset database:** delete the SQLite file under `data/` then re-run migrations; useful between demo scenarios.
- **Run CLI simulations:** `npm run simulate -- --scenario=mixed --persist` seeds deterministic data via the service layer.

## End-to-End Local Demo (Smartcar + API)

1. **Create Smartcar credentials:** from the Smartcar developer dashboard (or simulator), note the client ID, secret, and allowed redirect URI.
2. **Populate `.env`:** set `SMARTCAR_CLIENT_ID`, `SMARTCAR_CLIENT_SECRET`, and `SMARTCAR_REDIRECT_URI` (use `http://localhost:3000/api/v1/smartcar/callback` while running locally). Leave the default scope list unless you added additional permissions in Smartcar.
3. **Start the service:** run `npm run dev` and confirm the console logs indicate the server is listening.
4. **Request a Connect URL:** execute `curl http://localhost:3000/api/v1/smartcar/connect` (optionally append `?state=demo`). Copy the `data.url` value from the response and open it in a browser to launch Smartcar Connect.
5. **Complete OAuth:** log into the Smartcar simulator, approve the requested scopes, and allow the redirect back to the service. The callback responds with JSON summarizing the connected user, token expiry timestamps, and discovered vehicles. Tokens are persisted automatically in SQLite.
6. **Pull vehicle telemetry:** run `npm run smartcar:import -- --dry-run` to confirm telemetry retrieval, then rerun without `--dry-run` to persist snapshots through the ingestion pipeline. The importer automatically uses the stored Smartcar tokens.
7. **Inspect insights:** call `curl -H "x-api-key: ${API_KEY}" http://localhost:3000/api/v1/vehicles/<vehicleId>/insights` (replace `<vehicleId>` with an id returned by the callback or importer) to review scoring, alerts, and tips.
8. **Explore live Smartcar data:** use the `/api/v1/smartcar/vehicles/:vehicleId/...` routes (documented below) to fetch battery, charge, odometer, engine, or location data on demand.

## API Usage

All API calls require the `x-api-key` header set to the configured `API_KEY`.

### Ingest Telemetry

Endpoint: `POST /api/v1/telemetry`

1. Send a payload (example below) with ISO timestamps and state-of-charge percentages.
2. The response includes score, status band, rule impacts, alerts, tips, and the persisted telemetry snapshot.

```bash
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
```

### Retrieve Vehicle Insights

Endpoint: `GET /api/v1/vehicles/{vehicleId}/insights`

- Returns the latest snapshot, recalculated evaluation, active alerts/tips, and recent history from the insights log.
- Responds with `404` if the vehicle has not ingested telemetry yet.

```bash
curl -H "x-api-key: ${API_KEY}" \
  http://localhost:3000/api/v1/vehicles/demo-vehicle/insights
```

### Explore Simulation Scenarios

Endpoints:

- `GET /api/v1/simulate/scenarios` lists the built-in urban, highway, and mixed profiles.
- `POST /api/v1/simulate/drive` executes a scenario, optionally persisting each sample through the ingestion pipeline.

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  http://localhost:3000/api/v1/simulate/drive \
  -d '{ "scenario": "urban", "persist": false }'
```

When `persist` is true, the returned `alerts`, `tips`, and final `score` reflect the same telemetry stored in SQLite.

## Simulation Toolkit

- **API-first demos:** use the simulation endpoints to seed data and immediately query insights, as outlined in [docs/DemoScript.md](docs/DemoScript.md).
- **CLI automation:** invoke `npm run simulate -- --scenario=urban --persist` to populate data without issuing manual HTTP requests.
- **Custom timestamps:** pass `baseTimestamp` in the simulation request to shift the generated drive timeline.

## Smartcar Integration

### OAuth handshake

1. `GET /api/v1/smartcar/connect` returns a Connect URL and the exact scopes being requested.
2. Visiting that URL launches Smartcar Connect; approving access redirects the browser to `/api/v1/smartcar/callback`.
3. The callback response includes the Smartcar `userId`, scope list, token expiry timestamps, and discovered vehicle metadata. Tokens are persisted in SQLite and refreshed automatically when they near expiration.

Sample `connect` response:

```bash
curl http://localhost:3000/api/v1/smartcar/connect
# {
#   "data": {
#     "url": "https://connect.smartcar.com/oauth/authorize?...",
#     "scope": ["read_vehicle_info", "read_battery", ...]
#   }
# }
```

Sample `callback` response (triggered by the browser redirect):

```json
{
  "data": {
    "userId": "smartcar-user-123",
    "scope": ["read_vehicle_info", "read_battery", "read_charge", "read_odometer", "read_location"],
    "expiresAt": "2025-01-01T12:34:56.000Z",
    "refreshExpiresAt": "2025-04-01T12:34:56.000Z",
    "vehicles": [
      {
        "id": "498a9f34-5f3c-4090-a4b4-...",
        "make": "SMARTCAR",
        "model": "Simulated",
        "year": 2024
      }
    ]
  }
}
```

### Smartcar API endpoints

All endpoints below require the standard `x-api-key` header. An optional `userId` query parameter lets you target a specific Smartcar connection when multiple users have been linked.

```bash
# List vehicles for the stored Smartcar user
curl -H "x-api-key: ${API_KEY}" \
  http://localhost:3000/api/v1/smartcar/vehicles

# Fetch battery status for a vehicle
curl -H "x-api-key: ${API_KEY}" \
  http://localhost:3000/api/v1/smartcar/vehicles/${VEHICLE_ID}/battery

# Retrieve charge state, odometer, engine status, or location similarly
curl -H "x-api-key: ${API_KEY}" \
  http://localhost:3000/api/v1/smartcar/vehicles/${VEHICLE_ID}/location
```

Responses mirror the Smartcar SDK output (for example, `battery.percentRemaining`, `charge.state`, `odometer.distance`, `location.latitude/longitude`).

### CLI importer

- Run `npm run smartcar:import` to pull the latest Smartcar telemetry, convert it to the normalized schema, and optionally persist it.
- Pass `--vehicleId=<smartcarVehicleId>` to target a specific vehicle or omit it to ingest every vehicle returned by `GET /api/v1/smartcar/vehicles`.
- Include `--dry-run` to preview normalized payloads without writing to SQLite; each run logs the vehicle id, inferred battery percentage, and score outcomes when persisted.

## Health, Readiness, and Logging

- `GET /health` verifies the process is alive.
- `GET /ready` performs a database connectivity check and reports pending migrations; it responds with `503` until the service is fully ready. Responses include the correlation ID echoed in the `requestId` field.
- Pino logging attaches correlation IDs from the `REQUEST_ID_HEADER` or generates new UUIDs. Sensitive headers (`x-api-key`, `authorization`, `cookie`) are redacted automatically.

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
| `GET` | `/api/v1/smartcar/connect` | Generate Smartcar Connect URL (no API key required). |
| `GET` | `/api/v1/smartcar/callback` | Handle Smartcar OAuth redirect and persist tokens. |
| `GET` | `/api/v1/smartcar/vehicles` | List vehicles linked to the stored Smartcar user. |
| `GET` | `/api/v1/smartcar/vehicles/{vehicleId}/battery` | Retrieve battery state-of-charge and range information. |
| `GET` | `/api/v1/smartcar/vehicles/{vehicleId}/charge` | Fetch active charging status and plug state. |
| `GET` | `/api/v1/smartcar/vehicles/{vehicleId}/odometer` | Return odometer readings in kilometers. |
| `GET` | `/api/v1/smartcar/vehicles/{vehicleId}/engine` | Report whether the engine is currently running. |
| `GET` | `/api/v1/smartcar/vehicles/{vehicleId}/location` | Provide the latest GPS coordinates (requires location scope). |
| `GET` | `/health` | Basic liveness probe. |
| `GET` | `/ready` | Readiness probe that verifies SQLite connectivity and migration state. |

## Documentation Assets

- Rules and scoring details: [docs/Rules.md](docs/Rules.md)
- Demo walkthrough: [docs/DemoScript.md](docs/DemoScript.md)
- OpenAPI contract: [docs/openapi.yaml](docs/openapi.yaml)
- Postman collection: [docs/postman_collection.json](docs/postman_collection.json)

## Database Operations

The service stores data in a SQLite database located at data/battery.sqlite by default. Adjust the path via the `DATABASE_PATH` environment variable.

- Apply migrations: `npm run db:migrate`
- Reset database (development):
  1. Delete the database file under `data/` (if present).
  2. Re-run migrations with `npm run db:migrate`.

## Operations

- Rate limiting defaults to 120 requests per minute per IP. Tune via `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX`.
- Request/response logs include correlation ids sourced from `x-request-id` (configurable) and automatically redact API keys and cookies.
- Health endpoints:
  - `GET /health` returns a minimal liveness payload.
  - `GET /ready` returns readiness details or `503` with structured error codes when dependencies are unavailable.

## Container Usage

Build and run the service using the provided Docker assets:

```bash
docker build -t battery-service .
docker run --rm -p 3000:3000 \
  -e API_KEY=demo-api-key \
  -e DATABASE_PATH=/data/battery.sqlite \
  -v $(pwd)/data:/data \
  battery-service
```

For local orchestration with SQLite persistence, use `docker compose up` (see [docker-compose.yml](docker-compose.yml)).

## Continuous Integration

The workflow at [.github/workflows/ci.yml](.github/workflows/ci.yml) validates pull requests by running linting, compiling TypeScript, and ensuring the Docker image builds on Node 18.x and 20.x runners.

## Contribution Workflow

Before opening a pull request:

1. Run `npm run lint`
2. Run `npm run format:write`
3. Run `npm run build`

See [CONTRIBUTING.md](CONTRIBUTING.md) for more details.

## Future Work

- Migrate persistence to PostgreSQL for concurrency at scale.
- Expose historical telemetry timelines with pagination.
- Ship dashboard visualizations and CI/CD automation for demo environments.
