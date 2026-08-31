# OSINT Portal

A media collection & intelligence portal built with [Next.js](https://nextjs.org) (App Router), [Prisma](https://www.prisma.io) + Neon (PostgreSQL), and Tailwind CSS. It collects, stores, searches, and manages images, videos, news, and audio related to a target subject (Rt. Hon. Alban S. K. Bagbin).

## Features

- **Media catalog** — images, videos, news, and audio with local storage under `public/media/`
- **Search** — full-text search across all collected media
- **Duplicates** — detect duplicate records by URL/`image_hash`
- **Admin panel** — view, preview, add, and delete records, plus JSON/CSV export
- **Audit log** — track admin actions
- **Media scraping/migration scripts** — `scripts/` for collecting and migrating external data (e.g. alumni spotlight, CPA Africa Region profile)

## Getting Started

Install dependencies:

```bash
npm install
```

### Environment variables

Copy `.env` with a valid database URL (Neon PostgreSQL):

```
DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?sslmode=require"
```

### Run the database migrations

```bash
npx prisma migrate dev
```

### Seed the database

Creates the default admin user (see [Admin credentials](#admin-credentials)) and optionally migrates media from the local SQLite source database.

```bash
npm run seed
```

### Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Admin credentials

| Username | Password  | Role  |
|----------|-----------|-------|
| `admin`  | `admin123` | Admin |

The default admin user is created by `npm run seed`. Change the password after first login.

## Scripts

- `scripts/scrape.ts` / `scripts/scrape-bagbin-media.ts` — collect media from the web
- `scripts/migrate-alumni-spotlight.ts` — migrate UG Alumni Spotlight data
- `scripts/migrate-cpa-profile.ts` — migrate CPA Africa Region member profile data

## Tech Stack

- [Next.js](https://nextjs.org/docs) — React framework (App Router)
- [Prisma](https://www.prisma.io) + [Neon](https://neon.tech) — ORM / PostgreSQL
- [Tailwind CSS](https://tailwindcss.com) — styling
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — local SQLite source data
- [Prisma Client + @prisma/adapter-neon](https://www.prisma.io/docs/orm/overview/databases/neon) — serverless database access
