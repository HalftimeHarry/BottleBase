# BottleBase

BottleBase is a visual reference platform built for bartenders. The primary user flow is fast bottle lookup and learning. Inventory is optional and must never interfere with speed.

## Vision

- Fast bottle identification
- Excellent search experience
- Beautiful bottle imagery
- Multi-bar support
- Optional inventory management
- Mobile-first UX
- Scalable object-oriented TypeScript architecture

## Stack

- SvelteKit 5
- TypeScript (strict)
- PostgreSQL
- Drizzle ORM
- Better Auth
- Zod
- Tailwind CSS 4
- Vitest
- Playwright
- Docker

## Architecture

BottleBase follows a layered architecture:

UI (Svelte)

Application Layer

Domain Layer

Infrastructure Layer

Database

Rules:

- UI never communicates directly with the database.
- Business logic lives in TypeScript classes.
- Routes stay thin.
- Domain rules remain framework-independent.

## Project Structure

```text
src/
	lib/
		domain/
			bottles/
			bars/
			inventory/
			cocktails/
			search/
			users/
			shared/
		application/
		infrastructure/
		components/
		stores/
		utils/
	routes/
```

## Data Model Direction

Global catalog data:

- bottles
- bottle_aliases
- cocktails
- ingredients

Bar-specific data:

- bars
- bar_bottles

Bar bottles reference global bottles and never duplicate catalog attributes.

## Inventory Modes

- `disabled`
- `simple-counts`
- `detailed-tracking`

Simple counts support decimal values, package counts, and configurable par/reorder levels.

Detailed tracking is designed for open bottle state, ml remaining, transfers, waste, and transactions.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start Postgres via Docker:

```bash
npm run db:start
```

3. Generate auth schema and push DB schema:

```bash
npm run auth:schema
npm run db:push
```

4. Run the app:

```bash
npm run dev
```

## Testing

Run unit tests:

```bash
npm run test:unit -- --run
```

Run e2e tests:

```bash
npm run test:e2e
```

Testing focus areas:

- Inventory and par calculations
- Search behavior
- Import services
- Permissions and role rules

## Current Foundation

This repository already includes:

- Layered folder structure
- Core domain classes for bottles, bars, inventory, cocktails, and permissions
- Application services for search, bottle references, imports, and inventory summaries
- Infrastructure entry points for database, auth, search, and import adapters

## Long-Term Goal

BottleBase should become the definitive visual bottle reference platform for bartenders, scaling from individual learning use cases to large hospitality groups managing multiple bars.
