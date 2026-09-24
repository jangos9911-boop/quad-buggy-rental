# Quad & Buggy UAE Rental Desk

A standalone rental billing and operations dashboard for a UAE quad & buggy tourist-rental business.

## Current modules

- Dashboard: revenue, expenses, net result and outstanding balances
- Bookings / rental invoices
- Vehicles / fleet
- Customers
- Services
- Expenses
- CSV exports
- Full JSON backup
- AED and UAE VAT fields
- Responsive mobile layout

## Current data mode

The standalone browser build stores data in browser localStorage. This makes the app easy to test and deploy as a static site, but localStorage is not suitable as the long-term source of truth for a business.

## Production architecture

Web app -> Cloudflare Workers/Pages -> Cloudflare D1 -> authenticated users

Recommended production tables:

- users
- vehicles
- customers
- services
- rentals
- rental_items
- payments
- expenses
- maintenance
- audit_log
- settings

Production requirements should include authentication, role-based access, server-side validation, database backups, audit history, invoice numbering, payment reconciliation, date-range reports and VAT reporting.

## Deployment

The repository root is intentionally deployable as a static site. wrangler.toml is included for Cloudflare Workers static assets.

Do not put API keys, passwords, database credentials or customer secrets in browser JavaScript.

## Repository

GitHub: https://github.com/jangos9911-boop/quad-buggy-rental


## Production setup

The repository now includes a Cloudflare Worker API in `worker.js`, a D1 migration in `migrations/0001_production.sql`, and API-first UI behavior in `app.js`.

To make it live:
1. Create a Cloudflare D1 database named `quad-buggy-rental`.
2. Apply `migrations/0001_production.sql`.
3. Put the resulting D1 database ID into `wrangler.toml` under the commented `[[d1_databases]]` block, binding it as `DB`.
4. Deploy with Wrangler.
5. Set Worker secrets `AUTH_SECRET` (long random value) and `SETUP_TOKEN` (one-time setup value).
6. Open `/api/setup` once with the setup token to create the first admin account. Setup then permanently closes once a user exists.
7. Sign in through the app. Sessions are HttpOnly, Secure cookies and passwords are stored as PBKDF2 hashes with per-user salts.

The browser app still has an offline local-storage fallback so the interface remains usable before the production database is connected. Once the Worker API is available, the app switches to the cloud database automatically.

### Production modules

Dashboard, bookings/invoices, vehicles, customers, services, expenses, maintenance, reports/CSV export, JSON backup, staff authentication, D1 persistence, and session-based access control are included in the repository foundation.

### Important

A real production deployment cannot be honestly marked live until a Cloudflare account has supplied the D1 database ID and Worker secrets. No credentials or secrets are committed to GitHub.
