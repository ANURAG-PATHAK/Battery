# EV Battery Insight Service – Demo Script

Use this guide to walk stakeholders through the ingestion, insight retrieval, and simulation flows.

## 0. Prep

1. Install dependencies: `npm install`
2. Configure environment: copy `.env.example` to `.env` and adjust `API_KEY` if required.
3. Initialize the database: `npm run db:migrate`
4. Start the API: `npm run dev`

Keep the `x-api-key` header aligned with `API_KEY`.

## 1. Telemetry Ingestion

1. Send live telemetry (update `vehicleId` if needed):

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

2. Highlight the JSON response: score, status band, triggered rule IDs, alerts, and driver tips.
3. Mention that each ingestion logs to SQLite (`telemetry_snapshots`, `insights_log`) and updates the `vehicles` table.

## 2. Insight Retrieval

1. Fetch the aggregated insight:

   ```bash
   curl -H "x-api-key: ${API_KEY}" \
     http://localhost:3000/api/v1/vehicles/demo-vehicle/insights
   ```

2. Note the payload sections:
   - `telemetry`: last snapshot used for scoring.
   - `evaluation`: base score, final score, and rule impacts.
   - `alerts` and `tips`: driver-facing guidance.
   - `history`: recent persisted insight entries for audit.

## 3. Simulation Showcase

### API-driven simulation

1. Enumerate scenarios:

   ```bash
   curl -H "x-api-key: ${API_KEY}" http://localhost:3000/api/v1/simulate/scenarios
   ```

2. Run the mixed scenario without persistence to preview analytics:

   ```bash
   curl -X POST \
     -H "Content-Type: application/json" \
     -H "x-api-key: ${API_KEY}" \
     http://localhost:3000/api/v1/simulate/drive \
     -d '{ "scenario": "mixed", "persist": false }'
   ```

3. Re-run the same call with `"persist": true` to seed the database, then repeat the insights request to demonstrate updated history.

### CLI helper

1. Execute `npm run simulate -- --scenario=urban --persist` to insert a full scenario quickly.
2. Share the CLI output summary (battery delta, final score, alert counts) and mention the same telemetry is available via the insights endpoint.

## 4. Reset Between Runs

For a clean demo reset:

```bash
time rm -f data/battery.sqlite
npm run db:migrate
```

## 5. Smartcar Integration (Optional)

Showcase the official Smartcar OAuth handshake and live vehicle data:

1. Populate `.env` with `SMARTCAR_CLIENT_ID`, `SMARTCAR_CLIENT_SECRET`, and `SMARTCAR_REDIRECT_URI` (use the local callback URL for demos).
2. Request a Connect URL: `curl http://localhost:3000/api/v1/smartcar/connect` and open the returned `data.url` in a browser.
3. Approve the Smartcar consent screen. The browser redirects to `/api/v1/smartcar/callback`, which returns the Smartcar `userId`, scope list, and discovered vehicles while persisting tokens to SQLite.
4. Pull telemetry: `npm run smartcar:import -- --dry-run` to preview normalized snapshots, then rerun without `--dry-run` to persist through the ingestion pipeline.
5. Demonstrate live data via API: `curl -H "x-api-key: ${API_KEY}" http://localhost:3000/api/v1/smartcar/vehicles/${VEHICLE_ID}/battery` (and the matching `charge`, `odometer`, `engine`, `location` routes).
6. Query insights for the Smartcar vehicle ID to tie external telemetry back to scoring and alerting.

This ensures subsequent runs start from an empty state while keeping migrations consistent.
