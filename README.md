# RentalOS — Rental Management Platform

RentalOS is a multi-business rental operations platform for quad, ATV and buggy rentals, rent-a-car companies, and other rental businesses. The production app is hosted as a Cloudflare Worker with Cloudflare D1.

## Production capabilities

- Premium, responsive dashboard and business workspace
- Multi-business signup, staff roles and business-specific data
- Bookings, rental invoices, calendar and fleet management
- Generic rental assets for ATVs, buggies, quads, cars, bikes and other rentable items
- Optional start/end times for quad, buggy and ATV bookings
- Driver/referrer name, purchase/base cost, profit, commission percentage and calculated commission amount
- Deposits, pickup/return inspection, odometer/fuel tracking, late fees, charges and fines
- Vehicle compliance reminders, maintenance and profitability reporting
- Customer records and identity/licence document tracking
- Expenses, payments, cheque tracking, CSV exports, data migration and JSON backup
- AED / VAT support and subscription management with manual bank-transfer payment requests

## Subscription pricing

- Starter — AED 99/month
- Growth — AED 149/month
- Business — AED 249/month

Subscription payments are handled manually by bank transfer and require verification before activation.

## Deployment

The production Worker is named `rentalos` in Cloudflare. Its active source and deployment are managed through the Cloudflare Worker deployment. The repository also contains the original `quad-buggy-rental` Worker/static build for compatibility.

## Database migration

`migrations/0002_rentalos_v2.sql` updates the rentals table to allow null `start_at` and `end_at` values while preserving current booking, business, inspection, deposit and driver commission columns and indexes. It is intended for the RentalOS production schema, not the older standalone schema.

## Repository

GitHub: https://github.com/jangos9911-boop/quad-buggy-rental
