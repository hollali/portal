# Alban Bagbin Portal

A public digital library and content-management portal for **Rt. Hon. Alban S. K. Bagbin**, Speaker of the Parliament of Ghana. The application pairs an editorial, public-facing website — a searchable archive of speeches, papers, interviews, correspondence, photos, video, audio and news — with a role-based admin CMS used to collect, curate, manage and audit all media content.

Built with **Next.js (App Router)** and **React 19**, backed by **Prisma + Neon (PostgreSQL)**, styled with **Tailwind CSS**, and deployed to **Vercel** via GitHub Actions.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
  - [Running the Development Server](#running-the-development-server)
- [Seeding](#seeding)
- [Authentication & Roles](#authentication--roles)
- [Scripts](#scripts)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)
- [API Routes](#api-routes)
- [Testing & Quality](#testing--quality)
- [Deployment](#deployment)
- [License](#license)

## Overview

The portal has two faces:

1. **Public site** (`/`, `/the-man`, `/archives`, `/media`, `/videos`, `/news`, `/audio`, `/search`, `/ask`, …) — an editorial front end that presents the digitised library to the public: biographical chapters, a timeline of milestones, testimonials, faceted archive collections, a curated photo library, and an AI-style **Ask** assistant that answers from the archive with citations.
2. **Admin CMS** (`/login`, `/dashboard`, `/admin/*`) — a secure, role-based content-management console for ingesting, previewing, editing and deleting images, videos, news and audio, plus duplicate detection, audit logging, user management, notifications, site settings, content-page editing and a storage health dashboard.

Media files are stored on local disk and served through a secured, path-traversal-safe proxy at `/api/media/*`, while metadata lives in a Neon PostgreSQL database.

## Features

**Public digital library**
- Editorial landing page with live archive statistics and latest additions.
- "The Man" chaptered profile (early life, education, career, parliament, themes).
- Faceted archives — speeches, public papers, interviews, notes/letters/memos, milestones, testimonials and curated photos — filterable by `year`, `event`, `location`, `person`, `institution`, `parliament` and `theme`.
- Media library for **photos**, **videos**, **audio** and **news clippings**, including YouTube embeds.
- Full-text **search** across the archive.
- **Ask** assistant: returns cited answers drawn from the live archive (no external LLM dependency).
- CMS-authored pages rendered from sanitised Markdown.

**Admin CMS**
- JWT session auth in an httpOnly cookie with `admin` / `editor` / `viewer` roles.
- Media managers for images, videos, news and audio: list, preview, add, upload, edit, delete.
- **Duplicate detection** by URL and `image_hash`.
- **Audit log** of every admin action.
- Notifications, site content-section editor, dynamic content pages and settings.
- **Health dashboard**: per-type media integrity, missing local files, and storage/DB totals.
- Upload validation (type allow-list, 200 MB limit) and orphaned-file purge on deletion.

**Data tooling**
- One-step DB **seed**: default admin user, homepage sections, digital-library placeholders and migration from a legacy SQLite source database.
- Scraping and migration scripts for external sources (see [Scripts](#scripts)).

## Tech Stack

| Layer           | Technology                                                                 |
|-----------------|-----------------------------------------------------------------------------|
| Framework       | [Next.js](https://nextjs.org) 16 (App Router) + React 19                     |
| Language        | TypeScript (strict)                                                          |
| Styling         | [Tailwind CSS](https://tailwindcss.com) 4                                     |
| Database        | [Prisma](https://www.prisma.io) 7 + [Neon](https://neon.tech) PostgreSQL     |
| DB Driver       | `@prisma/adapter-neon` + `@neondatabase/serverless`                           |
| Auth            | `jsonwebtoken` (httpOnly cookies) + `bcryptjs`                                |
| Markdown        | `marked` + `sanitize-html`                                                    |
| Scraping        | `axios` + `cheerio`                                                           |
| Legacy data     | `better-sqlite3` (SQLite source migration)                                    |
| Icons           | `lucide-react`                                                                |
| Tests           | Vitest + Testing Library (jsdom)                                              |
| Lint / CI       | ESLint (next core-web-vitals + typescript), GitHub Actions, Vercel            |

> **Note:** Prisma generates its client into `src/generated/prisma` (excluded from git) via the `postinstall` script.

## Getting Started

### Prerequisites

- **Node.js ≥ 20.9** (CI runs Node 22)
- **npm**
- A **Neon** (or any PostgreSQL) database URL
- *(Optional)* An existing SQLite media database to migrate from, plus a local media directory

### Installation

```bash
git clone https://github.com/hollali/portal.git
cd portal
npm install
```

`npm install` runs `prisma generate` automatically via the `postinstall` hook.

### Environment Variables

Create a `.env` file in the project root. A template is shown below — never commit real credentials:

```env
# Required — Neon / PostgreSQL connection string
DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?sslmode=require"

# Required in production — used to sign and verify session JWTs.
# In development a random per-boot secret is used if unset.
JWT_SECRET="<long-random-string>"

# Optional — absolute path to the media root. Defaults to an absolute
# development path, so set this explicitly for other machines / deploys.
MEDIA_ROOT="/path/to/media/store"
```

| Variable       | Required | Default                | Description                                                                 |
|----------------|----------|------------------------|-----------------------------------------------------------------------------|
| `DATABASE_URL` | Yes      | —                      | PostgreSQL (Neon) connection string, used by Prisma and the app at runtime. |
| `JWT_SECRET`   | In prod  | Random per-boot (dev)  | Secret for signing/verifying session JWTs. The app **fails fast** in production if unset. |
| `MEDIA_ROOT`   | No       | Hard-coded dev path    | Absolute directory where media files are stored. |

### Database Setup

```bash
# Apply migrations to the configured database
npx prisma migrate dev

# Validate the schema (also runs in CI)
npx prisma validate
```

If this is a fresh schema, you can use `npx prisma db push` instead of `migrate dev`; a `prisma/migrations` directory is used otherwise.

### Seeding

```bash
npm run seed
```

`npm run seed` will:

1. Create the default admin user (**`admin` / `admin123`** — change the password after first login) if it does not exist.
2. Upsert the homepage content sections (`home_hero`, `home_biography`, `home_timeline`, `home_institutions`).
3. If the archive is empty, insert the placeholder digital-library content: speeches, milestones, testimonials and archive occasions.
4. Attempt to migrate legacy rows (`images`, `videos`, `news`, `audio`) from a local SQLite database located at `../WebScrapper/osint_bagbin_enhanced/osint_enhanced.db`. If the file is absent, it is skipped gracefully.

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Command                | Description                                      |
|------------------------|--------------------------------------------------|
| `npm run dev`          | Start the dev server                             |
| `npm run build`        | Production build                                 |
| `npm run start`        | Start the production server                      |
| `npm run lint`         | Run ESLint                                       |
| `npm run seed`         | Seed/migrate the database                        |
| `npx tsc --noEmit`     | Type-check the project                           |
| `npx vitest run`       | Run the test suite                               |

## Authentication & Roles

Authentication is username/password (hashed with `bcryptjs`, cost factor 12). On success a JWT is signed and stored in an httpOnly `session` cookie (7-day expiry, `sameSite=lax`, `secure` in production). The login endpoint additionally enforces a rate limit of 5 failed attempts per 60-second window per username and per IP.

| Role     | Access                                                                 |
|----------|------------------------------------------------------------------------|
| `admin`  | Full access: media management, users, archives, content, notifications, settings, health, audit log, duplicates |
| `editor` | Media management, content, archive, notifications, audit log            |
| `viewer` | Read-only access to the CMS (media browsing, search)                    |
| anonymous | Public site only                                                        |

Gate helpers live in `src/lib/auth.ts` (`canAccessAdmin`, `canManageMedia`, `canManageSystem`).

## Scripts

All scripts run against the database via `DATABASE_URL` loaded from `.env`.

| Script                            | Purpose                                                                                          |
|-----------------------------------|--------------------------------------------------------------------------------------------------|
| `npx tsx scripts/scrape.ts`       | Collect images for "Alban Sumana Kingsford Bagbin" from Bing/Google, download and dedupe them.    |
| `npx tsx scripts/scrape-bagbin-media.ts` | Rate-limited scraper for photos, videos, news and audio into the media root (per-type subdirectories). |
| `npx tsx scripts/migrate-alumni-spotlight.ts` | Migrate the University of Ghana Alumni Spotlight portfolio into the image library. |
| `npx tsx scripts/migrate-cpa-profile.ts`     | Migrate the CPA Africa Region member profile into the news library. |
| `npx tsx scripts/backfill-media.ts`          | Back-fill archive occasions and auto-categorise videos/audio. |
| `npx tsx scripts/backfill-news-html.ts`      | Copy archived news-clipping raw HTML into the database (`raw_html`) and untrack the files. |

## Database Schema

Prisma schema: `prisma/schema.prisma`.

| Model             | Table            | Purpose                                                            |
|-------------------|------------------|--------------------------------------------------------------------|
| `Image`           | `images`         | Photos with source/url/local path, face-detection fields, image hash and curation facets (year, event, location, person, institution, parliament, theme). |
| `Video`           | `videos`         | Videos with platform metadata and category/status facets.          |
| `News`            | `news`           | News clippings, optionally with stored `raw_html`.                 |
| `Audio`           | `audio`          | Audio recordings with artist/duration metadata and facets.         |
| `ArchiveItem`     | `archive_items`  | Digital-library documents (speech, paper, interview, note, letter, memo) with Markdown body, facets and source-type verification. |
| `Testimonial`     | `testimonials`   | Curated quotes with author/role/year.                              |
| `Milestone`       | `milestones`     | Timeline milestones categorised by `early-life`, `education`, `career`, `parliament`. |
| `User`            | `users`          | CMS users with role (`admin`/`editor`/`viewer`) and `isAdmin` flag.|
| `AuditLog`        | `audit_logs`     | Immutable action log (who did what, to which entity, when).        |
| `Setting`         | `settings`       | Key/value site settings.                                           |
| `Notification`    | `notifications`  | User notifications with read state.                                |
| `ContentSection`  | `content_sections` | Editable homepage sections (hero, biography, timeline, institutions). |
| `ContentPage`     | `content_pages`  | CMS-authored public pages rendered from Markdown (`/about`, …).    |

## Project Structure

```
.
├── prisma/
│   ├── schema.prisma          # Data model
│   ├── seed.ts                # Seed + SQLite migration
│   └── migrations/            # SQL migrations
├── scripts/                   # Scraping & migration tooling
├── src/
│   ├── app/
│   │   ├── (public)/          # Public site + public API routes
│   │   ├── (media)/           # Videos / news / audio / images / search
│   │   ├── (portal)/          # Admin CMS pages + admin API routes
│   │   ├── (auth)/            # Login
│   │   └── layout.tsx         # Root layout (fonts, theme init)
│   ├── components/            # Shared + admin UI components
│   ├── lib/                   # Auth, prisma, media, markdown, audit, etc.
│   ├── generated/prisma/      # Prisma client (generated, git-ignored)
│   └── __tests__/             # Vitest component tests
├── public/                    # Static assets (+ media via proxy)
├── vitest.config.ts           # Test configuration
├── eslint.config.mjs          # ESLint configuration
└── next.config.ts             # Next.js configuration (remote image hosts)
```

### Media storage

- Local files live under `MEDIA_ROOT` and are served through `/api/media/[...path]`, which enforces path containment, resolves MIME types and prevents directory traversal.
- Uploads are validated per type (images, videos, news, audio, documents), size-capped at **200 MB**, stored under `MEDIA_ROOT/<type>/`, and removed from disk when their record is deleted.
- `next.config.ts` permits remote images from `bing.com`, `google.com`, `youtube.com`, `ytimg.com` and `githubusercontent.com`.

## API Routes

**Public**
- `/api/media/[...path]` — secured media-file proxy
- `/api/search` — archive full-text search
- `/api/stats` — public archive statistics
- `/api/content` — published content sections
- `/api/ask` — Ask assistant (returns cited archive answers)
- `/api/images`, `/api/videos`, `/api/news`, `/api/audio` (+ `/api/photos`) — paginated public media listings and single-item routes
- `/api/dl` — digital-library listing

**Auth**
- `/api/login`, `/api/logout`, `/api/me` — session handling

**Admin (role-gated)**
- `/api/admin/[type]` — CRUD for images, videos, news and audio
- `/api/admin/media-check`, `/api/admin/duplicates` — media/duplicate inspection
- `/api/admin/library`, `/api/admin/photos`, `/api/admin/pages` — library management
- `/api/admin/users`, `/api/admin/settings`, `/api/admin/notifications`, `/api/admin/content`
- `/api/admin/health`, `/api/admin/stats`, `/api/admin/audit`

## Testing & Quality

```bash
# Lint
npm run lint

# Type-check
npx tsc --noEmit

# Tests
npx vitest run

# Prisma validation
npx prisma validate
```

The CI pipeline (`.github/workflows/ci.yml`) runs Prisma validation, lint, type-check and a production build on every push and pull request, then deploys the `main` branch to Vercel when the `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` secrets are configured. A gated Netlify alternative is included (commented out).

## Deployment

The project is built to deploy on **Vercel** as a serverless Next.js app. Data routes are dynamic (`force-dynamic`), so no database connection is required at build time.

Required production environment variables:

- `DATABASE_URL`
- `JWT_SECRET` (must be set — the app refuses to start critical auth paths without it)
- `MEDIA_ROOT` (e.g. `/mnt/media` or a persistent volume path), or your storage provider mount

Because media is stored on local disk, production deployments should mount persistent storage at `MEDIA_ROOT` so that uploaded assets survive function/instance restarts.

## License

Private project (no license specified). All biographical content belongs to its respective owners; see the source data document in `askbagbin_data.md` for reference sources.