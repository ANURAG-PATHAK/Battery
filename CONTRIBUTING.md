# Contributing

Thank you for helping build the EV Battery Insight Service!

## Pre-commit Checklist

- Run `npm run lint`
- Run `npm run format:write`
- Run `npm run build`

## Branch & Commit Guidelines

- Use feature branches (e.g., `feature/telemetry-service`)
- Follow conventional commit prefixes (e.g., `feat:`, `fix:`, `chore:`)
- Keep commits focused and descriptive.

## Code Style

- TypeScript strict mode is enforced via `tsconfig.json`
- ESLint (Airbnb TypeScript) and Prettier manage formatting
- Prefer pure services and avoid DB calls in controllers

## Testing

- Add tests for new logic when the test harness is available.
- Ensure integration endpoints include fixtures under `fixtures/`.

## Documentation

- Update [plan.md](plan.md) and [tasks.md](tasks.md) when scope or sequencing changes.
- Document new environment variables in the README `Getting Started` section.
