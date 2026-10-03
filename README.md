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
| `npx tsx scripts/ask-eval.ts`               | Retrieval eval for `/ask`: recall@k, MRR, duplicate and refusal rates against the live archive. `report` (default), `snapshot` or `replay`. |

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
- `/api/news/[id]/original` — a clipping as the scraper captured it, served sandboxed; `?download=1` for the file
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

### Retrieval eval for /ask

`/ask` is the one feature whose quality is not visible in the unit tests: they assert that the SQL covers every collection and that a partial answer says so, not that a good question returns the right record. The eval closes that gap.

```bash
npm run eval:ask              # measure against the live archive
npm run eval:ask -- --keys    # same, and print what each failing case returned
npm run eval:ask -- replay    # measure against the frozen snapshot, no database
npm run eval:ask -- snapshot  # re-freeze the snapshot after changing the queries
```

- `src/__tests__/fixtures/askGolden.ts` — 66 questions a reader would plausibly type, each naming the records a good answer has to contain. Expectations were written by reading the records, never by recording what the search returns. Six of them name a window of years or a collection, and the harness reads both the same way `/api/ask` does, so a filtered question is measured through the path a reader's takes.
- `src/lib/askEval.ts` — the metrics. Pure; no database.
- `src/__tests__/askRetrieval.test.ts` — the CI gate, replaying `src/__tests__/fixtures/askSnapshot.json` through `rankCandidates`. The thresholds are floors at the measured baseline, so raise them as defects are fixed.
- `scripts/ask-eval.ts` — the runner. `report` is the honest number; the replay cannot see a change to the candidate queries, only to the ranking.

Baseline at the time of writing, against the live archive: recall@1 88.1%, recall@5 100%, recall@10 100%, MRR 0.929, no duplicates, pass rate 100%, ~208ms p50 per question. The frozen replay measures the same figures to three decimal places, which is what it is for.

`recall@1` is the one number that fell when dated questions were added, and it fell for an honest reason: a question about a five-year window is answered with a chronology, so the card on top is whichever record sorts first rather than whichever is most relevant to a subject nobody named. The window cases are the misses. `pass rate` — at least one named record actually reaching the reader — stayed at 100%, which is the claim that matters.

| Metric                    | Was      | Now    | Defect, and the fix                                                                                                                                                                                                                                            |
|---------------------------|----------|--------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `no duplicates`           | 79.7%    | 100%   | `normaliseTitle` kept the scraper's provenance suffix, so a clipping stored with and without it survived dedupe and was shown twice — thirteen of the 59 cases. A publisher suffix now comes off only when the row's own URL host vouches for it, and a date or byline comes off regardless, because `… - 12 Jun` is metadata whoever fetched it. |
| `video-fourth-republic`  | fail     | pass   | "fourth" did not reach a headline that writes the ordinal as "4th", and the answer degraded to an unrelated document. The ordinals `first`…`tenth` now reach their numerals and back.                                                                                                                          |

Both fixes came out of the eval rather than out of reading the code, which is the argument for keeping it. It also found that the pipeline had no minimum-relevance threshold — every candidate is by definition a record that matched a term, so the archive answered *anything*, including "quantum computing policy" with the Water Resources ministry milestone, matched on the word "policy" in its description. `rankCandidates` now drops a partial match that covers less than half the question's terms or that only ever matched inside a description rather than a title or caption, which took `empty accuracy` from 50% to 100%. It also showed a card's excerpt was the first 150 characters of a record rather than the part the reader asked about; `bestPassage` now windows the record's own words around the match.

### Dated questions

A question that names years is answered from those years. `parsePeriod` reads ranges (`between 2019 and 2021`), open windows (`since 2020`), decades (`the 1990s`) and bare years; the years are then removed from the search terms, because a filter on a date column is not a topic word and "what happened in 2026?" was being answered by searching for the string `2026`.

- The window is applied in SQL, per collection, against the column that collection actually dates itself by: `year` for documents and testimonials, the free-text `year` of a milestone, and the first four-digit run of a clipping's `date`, which is ISO on some rows and RFC 2822 on others. The card's year is read the same way, so a record cannot be filtered by one year and labelled with another.
- `news` and the curated documents order a window-only question oldest first, because that is the order the period happened in. A relevance question inside a window keeps its ranking.
- **Videos and audio are left out and named.** Every one of the 430 video rows and 254 audio rows has a null `year`, so filtering them would answer a question about 2019–2021 with a 2023 recording and call it evidence. The answer says which collections it left out, because "nothing before 2020" and "684 recordings, none of them dated" are different facts.
- `buildCandidateSql` refuses a window it cannot honour rather than ignoring it — the same failure the file's header describes, where a bad query is caught and turned into a silently empty collection.

### Where a record can be read

131 of the archive's 134 news rows store an aggregator's address rather than the paper's: 85 through Google News, 46 through Bing. Bing's redirect carries the publisher's address in a query parameter, so `sourceAccess` unwraps it exactly and the citation links the paper, named by its hostname. Google's address is a signed blob with no readable address inside it, so those links stay as stored and are labelled *via Google News* — presenting an aggregator as the publication of a speech would be a lie a reader cannot check.

Dedupe runs against the unwrapped host, so one clipping fetched twice — once through Bing, once from the paper — collapses to one card instead of two.

A citation card is no longer itself a single link. It is a container with the archive's own page as the title's link, the original beside it, and — where the scraper kept the page it fetched — *as captured*, served from `/api/news/[id]/original`. That route hands back third-party markup, so it sets `Content-Security-Policy: sandbox` (the document leaves this origin entirely: no scripts, no cookies, no storage), `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`; `?download=1` serves the same bytes as an attachment under a filename derived from the stored title with control characters stripped.

One limit worth stating plainly: `normaliseTitle`'s host check only works for rows whose URL names the paper. The 85 rows reached through Google News keep their suffix, because nothing in the row says which paper wrote it. Guessing there would invent headlines, so those rows are left alone — see the `normaliseTitle` tests in `src/__tests__/askSearch.test.ts` for both halves of that bargain.

### A collection named in the question

A reader who types a word this site uses as a page name — milestones, testimonials, news, clippings, videos, audio, documents, photographs — is pointing at a collection, not at a subject to be found across all of them. `collectionFilter` splits those words out of the search and hands them to the query builder as the set of collections to look in.

Read as a subject, "what are the milestones from the 1990s?" searched every record for the *word* "milestones". The archive holds four milestones from that decade and not one of them contains the word, so the answer was empty — and the empty answer was indistinguishable from the archive having no record of the decade at all. The restriction is also stated, in the summary and above the cards, because a narrowing the reader cannot see reads as the archive's whole contents.

- The word list is deliberately short and consists of words that name a collection on this site and are not ordinary subject matter. "Speeches", "statements", "press" and "recordings" are absent: "what is his position on press freedom?" is a real question, and filtering it to clippings would answer a different one.
- A collection on its own is a question, not a missing subject: "any videos?" returns the videos, in the order the videos page lists them, and says "the first 3 in the collection shown" rather than claiming to have ranked them.
- **Photographs are refused with a reason and a page.** All 283 rows of the photo library are uncaptioned and undated, so the only text a match could come from is the scrape query its own subject's name was typed into, and the card would be titled with a search string rather than with anything about the picture. "Show me any photographs" is answered with that sentence and `/archives/photos`; naming photographs alongside a subject searches the rest and says where the pictures are not coming from.
- Every refusal carries the restriction too. "Nothing published in the archive mentions “humility”" is a claim about the whole archive, and under a collection filter it is a claim about one page of it.

### Known gaps

- `AskResult.reading` exists as a typed boundary for a future generated interpretation and is always absent. Nothing sends it; when something does, the client renders it labelled *Generated reading — not his words*, outside the persona paragraph, because every other word on that page is read verbatim from a stored record.
- A window or a collection on its own returns as many records as the card cap allows — two milestones, three clippings — and says how many matched. A reader who wants all of them has to visit the collection's own page, which is where the full list lives.


## Deployment

The project is built to deploy on **Vercel** as a serverless Next.js app. Data routes are dynamic (`force-dynamic`), so no database connection is required at build time.

Required production environment variables:

- `DATABASE_URL`
- `JWT_SECRET` (must be set — the app refuses to start critical auth paths without it)
- `MEDIA_ROOT` (e.g. `/mnt/media` or a persistent volume path), or your storage provider mount

Because media is stored on local disk, production deployments should mount persistent storage at `MEDIA_ROOT` so that uploaded assets survive function/instance restarts.

## License

Private project (no license specified). All biographical content belongs to its respective owners; see the source data document in `askbagbin_data.md` for reference sources.