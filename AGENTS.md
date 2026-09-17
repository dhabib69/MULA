# MULA Agent Guide

This repo is a no-build vanilla JavaScript Firebase app. Before changing code, read this file, then `ROUTING.md`, then the relevant section in `MEMORIES.md`.

## Current Product Boundary

- Hosted app: Firebase Hosting at `https://mula-eatery.web.app`.
- Data store: Firebase Realtime Database project `mula-eatery`.
- Deploy scope: Hosting + Realtime Database rules only, via `npm run deploy`.
- Payment model: manual cashier / physical QRIS. Do not add Cloud Functions, Midtrans, or paid Firebase assumptions unless the user explicitly asks.
- Browser app: ordered classic scripts in `index.html`; there is no bundler or framework.
- Android app: `android-cashier/` wraps the hosted URL in WebView and exposes native Bluetooth printing through `window.MulaPrinter`.

## First Commands

Run these before meaningful code edits:

```powershell
git status --short --branch
npm run check
```

Use `rg` for code search. Start from `ROUTING.md` instead of scanning every file.

## Change Discipline

- Keep app script order in `index.html`: `config.js`, `01-platform`, `02-menu-data`, `03-app-state`, `04-dashboard`, `05-printing`, `06-checkout`, `07-guest-view`, optional feature scripts, then `mula-sw-register`.
- When touching browser JS/CSS for deployed behavior, keep `index.html` `?v=NN`, `assets/js/mula-sw-register.js` `mula-vNN`, and Android `APP_WEB_VERSION` aligned.
- `assets/js/config.js` is intentionally gitignored; it must exist locally for Firebase config and optional Groq key.
- Do not remove offline queue/local mirror logic unless replacing the full offline behavior.
- Do not process `orders/{date}/receipts` as order transactions.
- Avoid broad UI rewrites in `assets/css/mula.css`; use the routing map to find the owning markup/function first.

## Verification Levels

- Small JS/rules/docs change: `npm run check`.
- Guest/cashier flow change: `npm run check`, then test the exact table/manual order path.
- Android WebView or printer change: `npm run check`, then build APK with the existing Gradle command pattern.
- Deploy request: run `npm run check`, deploy with `npm run deploy`, then verify live HTML and changed JS/rules behavior.

## Memory Updates

After a meaningful execution, update `MEMORIES.md` with a short dated note if the repo behavior or workflow changed. For external Codex memory, add a small note under `C:\Users\habib\.codex\memories\extensions\ad_hoc\notes\`.
