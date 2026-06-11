# Consty

Consty is a Next.js construction operations platform for managing projects, clients, site activity, procurement, payments, invoices, documents, and team workflows from one workspace.

## Stack

- Next.js 16
- React 19
- PostgreSQL / Neon
- Raw SQL migrations in `migrations/`

## Local Setup

1. Create `.env.local` from `.env.example`.
2. Install dependencies:

```bash
npm install
```

3. Run the app:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Database

- Runtime database access uses `DATABASE_URL`.
- Schema artifacts for Consty live in `database/`.
- Existing migration SQL remains in `migrations/` for reference and controlled replay.

## Notes

- `.env*` files are ignored by Git.
- This repository is intended to be a clean, independent Consty project and should not point to the original repository history.
