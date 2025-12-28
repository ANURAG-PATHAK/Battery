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
