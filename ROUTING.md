# MULA Routing Map

Use this as the first stop for code routing. `MEMORIES.md` has longer history and regression notes.

## Runtime Shell

- `index.html`: static app shell, modals, tab containers, ordered script tags, asset cache query versions.
- `assets/js/config.js`: local gitignored Firebase/Groq config.
- `assets/js/mula-sw-register.js`: service worker cache key and precache list.
- `firebase.json`: Hosting public root, ignores, rewrites, Database rules target.
- `database.rules.json`: Realtime Database access rules.
- `server.js`: local LAN/demo server only.

## Browser JavaScript Ownership

- `assets/js/01-platform.js`: Firebase wrappers, auth/session, constants, demo wrappers, theme toggle, table URL helpers.
- `assets/js/02-menu-data.js`: built-in menu, categories, kitchen component definitions.
- `assets/js/03-app-state.js`: global state, subscriptions, offline queue, local mirrors, menu CRUD/availability, receipt image loading, app entry.
- `assets/js/04-dashboard.js`: cashier/admin rendering, active tables, pending payments, Keuangan, kitchen completion, admin analysis.
- `assets/js/05-printing.js`: receipt formatting, Android bridge, print fallback.
- `assets/js/06-checkout.js`: manual cashier checkout modal, destination/payment/customer fields, manual order writes.
- `assets/js/07-guest-view.js`: guest QR/table flow, guest cart, payment confirmation, guest search.
- `assets/js/08-ai-analysis.js`: Groq/Neural Agent analysis UI and API call.

## Task Entry Points

- Menu availability / `Tandai Habis`: `03-app-state.js` `menuAvailability` and `setItemOutOfStock`, `04-dashboard.js` item cards, `07-guest-view.js` disabled guest controls, `database.rules.json`.
- Add/edit menu: `03-app-state.js` custom menu handlers, `02-menu-data.js` components, `04-dashboard.js` manage-mode UI, `database.rules.json`.
- Manual cashier order: `06-checkout.js` submit path, `03-app-state.js` offline queue/local mirrors, `04-dashboard.js` active/summary views, `05-printing.js`.
- Guest QR order: `07-guest-view.js`, `01-platform.js` table helpers, `04-dashboard.js` `konfirmasiBayar`.
- Keuangan/history: `04-dashboard.js` `renderKeuangan` and analysis, `03-app-state.js` `subOrders`, `subReceipts`, `subKitchenHistory`.
- Kitchen active orders: `04-dashboard.js` `renderActiveTables`, `completeKitchenOrder`; `03-app-state.js` active-order sync.
- Receipt uploads: `04-dashboard.js` `submitReceipt`/`renderReceipts`, `03-app-state.js` receipt image modal, `database.rules.json` `receiptsImages`.
- Printing: `05-printing.js`, `android-cashier/app/src/main/java/com/mula/cashier/PrinterBridge.kt`, `MainActivity.kt`.
- Android stale UI/cache: `MainActivity.kt` `APP_WEB_VERSION`, `index.html` `?v=NN`, `mula-sw-register.js` `mula-vNN`, CSS `android-lite`.
- Styling/mobile layout: `assets/css/mula.css`, then owning markup in `04-dashboard.js` or `index.html`.

## Data Paths

- `orders/{date}/{financeKey}`: finance transactions.
- `orders/{date}/receipts/{receiptId}`: lightweight receipt-note totals, not food orders.
- `tableOrders/{tid}`: active/pending table and cashier kitchen orders.
- `kitchenHistory/{date}/{orderId}`: completed kitchen snapshots and duration.
- `menuAvailability/{itemId}`: `true` means sold out; missing means available.
- `customMenu/{id}` and `customMenuComps/{id}`: staff-created menu and kitchen composition.
- `priceOverrides/{itemId}`: admin price override.
- `receipts/{id}`: lightweight receipt metadata/thumb.
- `receiptsImages/{id}`: full receipt image data.
- `stock/{id}`: stock items.

## Fast Checks

```powershell
npm run check
```

This verifies JSON config, JS syntax, referenced local assets, Firebase deploy boundary, and cache-version alignment.
