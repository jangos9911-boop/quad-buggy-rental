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
