# AGENTS.md

## Project Overview

Hospital IT hardware outsourcing team scheduling system (智能排班系统 v2). Next.js 15 + React 19 + TypeScript + Tailwind CSS v4. PostgreSQL (remote) with raw SQL via `pg` driver — no ORM.

## Key Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build (includes static copy step)
npm run db:init      # Initialize database tables + seed data
npm run db:migrate   # Run migrations
```

## Architecture

- **Framework**: Next.js App Router (API routes in `src/app/api/`)
- **Database**: PostgreSQL via `pg` driver, connection pool in `src/lib/db.ts`
- **Auth**: JWT (jose) + bcryptjs, tokens in httpOnly cookies
- **Styling**: Tailwind CSS v4 with PostCSS plugin

### Key Files

- `src/lib/db.ts` — Database connection pool and query helpers
- `src/lib/auth.ts` — JWT sign/verify, password hash/compare
- `src/lib/staff.ts` — Team member definitions, shift configs, scheduling rules
- `src/lib/staff-db.ts` — Load staff/rules from DB with fallback to hardcoded data
- `src/lib/db-init.ts` — Database initialization script (creates tables, seeds users/rules)
- `src/app/api/schedule/route.ts` — Schedule CRUD + generation algorithm

### Data Flow

- Staff data: `users` table → `loadStaff()` → fallback to `FALLBACK_STAFF` in `staff.ts`
- Rules: `rules` table → `loadRules()` → fallback to `DEFAULT_RULES` in `staff.ts`
- Holidays: Hardcoded 2026 calendar in `schedule/route.ts`

## Environment Variables

Required in `.env.local` (or `.env`):
```
POSTGRES_HOST=your_host
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DATABASE=scheduling-system
JWT_SECRET=your_jwt_secret
```

## Notes

- ESLint is configured but **ignored during builds** (`next.config.ts`)
- Standalone output mode enabled — `npm run build` includes a static assets copy step
- Path alias: `@/*` → `./src/*`
- No test suite configured
- Default admin password: `123456` (change in production)
