# MULA Eatery — Project Memory

Project memory for the MULA restaurant POS/ordering app. Read this file first whenever starting work in this folder.

---

## Agent Quick Start

- Read `AGENTS.md` first for the active product boundary and change discipline.
- Use `ROUTING.md` as the compact first-pass map before broad code search.
- Run `npm run check` before meaningful edits and before any deploy.
- Keep `index.html` `?v=NN`, `assets/js/mula-sw-register.js` `mula-vNN`, and Android `APP_WEB_VERSION` aligned.
- After a meaningful execution, append a dated note here and add an external Codex memory note if the workflow changed.

---

## Hosting & Deployment

- **Hosted on Firebase Hosting** (NOT Netlify — MEMORIES.md was outdated)
- Deploy command: `firebase deploy` or `npm run deploy` (Blaze-free: deploys hosting + database only)
- Firebase project: `mula-eatery` (region: `asia-southeast1`)
- Firebase RTDB: `https://mula-eatery-default-rtdb.asia-southeast1.firebasedatabase.app`
- Android cashier app loads `index.html` from Firebase Hosting URL via WebView
- Cloud Functions are intentionally not configured in `firebase.json`; old Midtrans function code is dormant and ignored by Hosting.
- Local dev server: `node server.js` (serves over LAN for local testing only)
- `DEMO_MODE = false` in code — always uses Firebase RTDB, not local demo state

---

## What this project is

A **no-build vanilla JS SPA** for an Indonesian restaurant called **MULA Eatery**. Uses Firebase Realtime Database (no framework). Indonesian language throughout.

- **No build step, no framework, no package.json dependency for the browser app.** `index.html` is now a thin shell that loads `assets/css/mula.css` and ordered classic scripts under `assets/js/`.
- PWA with service worker cache versioned through `assets/js/mula-sw-register.js` + ESC/POS thermal printer support
- Android wrapper: `android-cashier/` — WebView app with native Bluetooth print bridge

---

## Task routing workflows

Use this section before broad `rg` scans. Start with the listed files/functions, then expand only if the first pass does not explain the bug.

### Menu availability / `Tandai Habis`

Start here:
- `assets/js/03-app-state.js`: `menuAvailability`, `subAll()`, `setItemOutOfStock()`, `getSection()`
- `assets/js/04-dashboard.js`: `renderOrders()`, `itemHTML()`, `.availability-btn` click binding
- `assets/js/07-guest-view.js`: guest `menuAvailability` listener, `outOfStock` rendering, disabled guest quantity buttons
- `database.rules.json`: `menuAvailability` read/write rules
- `index.html` and `assets/js/mula-sw-register.js`: cache-busting version after JS/rules-facing changes

Expected behavior:
- `menuAvailability/{itemId}=true` means the item is habis.
- Removing `menuAvailability/{itemId}` means the item is available again.
- Admin and karyawan can use `Mode Kelola` for `Tandai Habis` / `Tersedia`.
- Add menu is available to authenticated staff in `Mode Kelola`; edit price, delete menu, stock, and finance remain admin-only.

Verification:
- `node --check assets/js/03-app-state.js`
- `node --check assets/js/04-dashboard.js`
- Parse `database.rules.json`
- Deploy Hosting + Database rules when rules change: `npm run deploy`
- Live-check HTML asset version and `/menuAvailability.json` read access.

### Staff cashier ordering / manual orders

Start here:
- `assets/js/04-dashboard.js`: `renderOrders()`, `itemHTML()`, `renderOrderSummary()`, `getCookOrders()`
- `assets/js/06-checkout.js`: order summary modal, destination selector, `prosesManualBtn`, offline queue writes
- `assets/js/03-app-state.js`: `orders`, `dailyOrders`, `tableOrders`, `syncOfflineQueue()`, local durable stores
- `assets/js/05-printing.js`: `autoPrint()` if order submit/receipt behavior is involved

Expected data writes:
- Finance: `orders/{curDate}/{finKey}`
- Kitchen queue: `tableOrders/{tid}` with `status:'active'`, `financeKey`, `dateKey`
- Offline support: `mula_offline_queue`, `mula_local_daily_orders`, `mula_local_active_orders`

Verification:
- Syntax check changed scripts.
- For behavior, create one manual order and confirm it appears in finance, kitchen active orders, and print path.

### Guest table ordering / QR flow

Start here:
- `assets/js/07-guest-view.js`: `initGuestView()`, `renderGuest()`, guest cart, payment states
- `assets/js/01-platform.js`: `TABLE_IDS`, `tableUrl()`, `getTableParamFromUrl()`
- `assets/js/04-dashboard.js`: `renderPendingPayments()`, `konfirmasiBayar()`
- `server.js` and Firebase Hosting rewrites if clean `/tableN` routes fail locally/hosted

Expected statuses:
- `pending_payment` after guest submits order
- `waiting_verification` after guest confirms at cashier
- `active` after staff confirms payment and kitchen owns the order
- `paid` / cleared only after the flow is complete

Verification:
- Test both `/table1` clean route and legacy `?table=1`.
- Confirm guest unavailable items are disabled when `menuAvailability` says habis.

### Keuangan / order history / payment method

Start here:
- `assets/js/04-dashboard.js`: `renderKeuangan()`, `renderAdminAnalysis()`, payment method edit/delete handlers
- `assets/js/03-app-state.js`: `subOrders()`, `subReceipts()`, `dailyOrders`, local daily order merge
- `assets/js/06-checkout.js`: manual order finance payload fields
- `assets/js/04-dashboard.js`: `konfirmasiBayar()` for guest-to-finance payloads

Expected row details:
- Type badge: Dine-in or Takeaway
- Payment badge
- Time badge from `tx.time`
- Table/customer label
- Total and print action
- Admin delete/edit controls only under the current admin gates

Verification:
- Switch date with `dateInput` and confirm `orders/{date}` drives rows.
- If cache bugs are suspected, bump script query versions and service-worker cache.

Recent regression guard:
- UI/UX edits must preserve `renderKeuangan()` order rows as newest-first by `tx.time`, keep a visible time badge on every non-legacy transaction row, and keep `renderAdminAnalysis()` calling `ensureGroqBtn()` so the Neural Agent / Groq analysis button remains available after loading states and rerenders.
- If `emptyStateHTML()` is used by dashboard views, it must have a real implementation; a missing body breaks `assets/js/04-dashboard.js` before finance/history can render.

### Kitchen active orders / timers / selesai

Start here:
- `assets/js/04-dashboard.js`: `renderActiveTables()`, `completeKitchenOrder()`, `formatKitchenElapsed()`, `notifyActiveKitchenOrders()`
- `assets/js/03-app-state.js`: `tableOrders`, `syncOfflineQueue()`, local active order persistence
- `android-cashier/app/src/main/java/com/mula/cashier/KitchenAlertService.kt` when native Android notifications are involved

Expected data flow:
- Active orders live in `tableOrders/{tid}` with `status:'active'`.
- Completing writes to `kitchenHistory/{date}/{tid}` and removes `tableOrders/{tid}`.
- Finance rows should already exist; `Selesai` should not duplicate finance.

Verification:
- Confirm active panel, timer, kitchen history, and finance duration field if touched.

### Printing / receipts / Android bridge

Start here:
- `assets/js/05-printing.js`: `autoPrint()`, `buildReceipt()`, `fallbackPrint()`
- `android-cashier/app/src/main/java/com/mula/cashier/MainActivity.kt`: WebView setup and bridge registration
- Android printer bridge classes under `android-cashier/app/src/main/java/com/mula/cashier/`
- `assets/css/mula.css`: `@media print`, `.receipt-print`

Expected print order:
- Android native bridge first: `window.MulaPrinter.printBase64(base64)`
- Web Bluetooth fallback
- Browser `window.print()` fallback

Verification:
- Syntax check browser JS.
- For Android bridge changes, build APK with the existing Gradle/JDK command pattern from prior notes.

### Android WebView cache / stale UI

Start here:
- `android-cashier/app/src/main/java/com/mula/cashier/MainActivity.kt`: `APP_WEB_VERSION`, `LOAD_NO_CACHE`, service worker/cache cleanup, reload action
- `index.html`: `?v=NN` script/css query strings
- `assets/js/mula-sw-register.js`: `CACHE = 'mula-vNN'`
- `MEMORIES.md` 2026-05-12 stale WebView notes

Expected fix pattern:
- Bump hosted asset query strings.
- Bump service-worker cache name.
- For APK/WebView issues, bump `APP_WEB_VERSION` and rebuild APK.
- Use Android **Reload paksa** after deploy when testing on device.

### Firebase deployment / rules

Start here:
- `firebase.json`: Hosting + Database only unless user explicitly restores paid Functions architecture
- `database.rules.json`: RTDB permissions
- `package.json`: `npm run deploy` deploys `hosting,database`
- Avoid deploying functions on Spark/free-tier work unless the user explicitly changes architecture.

Verification:
- `node -e "JSON.parse(require('fs').readFileSync('database.rules.json','utf8'))"`
- `npm run deploy`
- Live HTTP check for asset version or RTDB read path relevant to the task.

### Styling / mobile cashier UI

Start here:
- `assets/css/mula.css`: global layout, mobile media queries, print CSS
- `assets/js/03-app-state.js`: injected cashier UX styles in `injectCashierUxStyles()`
- `assets/js/04-dashboard.js`: markup shape for order/menu/finance panels
- `index.html`: fixed shell markup for header/tabs/panels

Verification:
- Check desktop and narrow Android-like widths.
- Pay special attention to header buttons, sticky search/category bars, finance rows, and bottom checkout bar.

---

## Current flow: Payment-First Self-Service (as of 2026-04-30)

### Guest flow (table orders)
1. Guest scans table QR → `https://mula-eatery.web.app/table3`
2. Guest picks items, taps **"Pesan Sekarang"** → status = `pending_payment`
3. App shows payment screen — guest pays via physical QRIS sticker on table
4. Guest taps **"Konfirmasi Pesanan"** → status = `waiting_verification`
5. Admin hears beep, sees **"💳 Verifikasi Pembayaran"** panel
6. Admin taps **"✅ Konfirmasi Bayar"** → `konfirmasiBayar()`:
   - Merges items into `orders/{today}` (finance)
   - Auto-prints receipt via native bridge or BT fallback
   - Converts `tableOrders/${tableId}` to `status:'active'` with `kitchenQueuedAt`
   - Kitchen keeps ownership until staff taps **Selesai**
7. Guest sees "Pembayaran Dikonfirmasi" screen

### Staff / Kasir flow (takeaway/walk-in manual orders)
1. Staff picks items in **"Order Kasir (Manual)"** panel
2. Taps **"Proses ke Dapur"** → confirm modal → **"✓ Kirim ke Dapur"**:
   - Writes **immediately** to `orders/${curDate}` (finance updates at once)
   - Also writes `tableOrders/KASIR-{tid}` as `status:'active'` (kitchen queue)
   - Stores `financeKey` in tableOrder (for reversal on cancel)
   - Auto-prints receipt
   - Clears local cart
3. **"🍽 Meja Aktif"** panel appears (admin only) with 3 buttons per order:
   - **✕ Batal** → removes finance entry (`orders/${date}/${financeKey}`) + removes tableOrder
   - **🖨 Print Lagi** → reprints receipt (no finance effect)
   - **✓ Selesai** → writes `kitchenHistory/{date}/{orderId}` with `durationMs`, then removes tableOrder from kitchen queue (finance already counted)

### Kitchen (Yang Dimasak)
- `getCookOrders()` aggregates: local cart `orders` variable + `tableOrders` with `status:'active'`
- `pending_payment` / `waiting_verification` table orders are EXCLUDED from kitchen
- Kitchen only sees confirmed/active orders

---

## Firebase data model

```
orders/{YYYY-MM-DD}/{pushId}    → {time, tableLabel, total, items: {itemId: {qty, note, tanpaNasi}}}
tableOrders/{tableId}           → {items, status, total, tableLabel, createdAt, kitchenQueuedAt?, dateKey, financeKey?, paidAt?}
   status: 'pending_payment' | 'waiting_verification' | 'paid' | 'active'
   'active' = manual kasir order in kitchen queue
   financeKey = push key in orders/{date} for reversal if cancelled
kitchenHistory/{YYYY-MM-DD}/{orderId} → completed kitchen snapshot with durationMs, durationMinutes, kitchenStartedAt, kitchenCompletedAt
customMenu/{pushId}             → {id, name, price, cat}
customMenuComps/{itemId}        → {contribs: [...compIds], newRows: [...rowNames]}
priceOverrides/{itemId}         → number
menuAvailability/{itemId}       → boolean (true = out of stock)
stock/{stockId}                 → {name, jumlah, satuan}
receipts/{receiptId}            → {img, thumb, note, items, total, date, by}
```

- `TABLE_IDS = ['1'..'9']` (whitelist — URL param validated)
- `NASI_IDS` — items that include rice; `tanpaNasi` deducts `NASI_PRICE = 5000`

---

## Key JS functions

| Function | Purpose |
|---|---|
| `renderOrders()` | Renders staff takeaway menu + cook list |
| `itemHTML(item, isAdmin, idx)` | Staff menu item template |
| `getCookOrders()` | Kitchen queue: active tableOrders + local cart `orders` |
| `renderPendingOrders()` | Legacy `waiting_confirmation` panel (unused in current flow) |
| `renderActiveTables()` | "🍽 Meja Aktif" panel — shows active kasir orders with Batal/Print Lagi/Selesai |
| `renderPendingPayments()` | "💳 Verifikasi Pembayaran" panel for guest table payments |
| `konfirmasiBayar(tableId)` | Confirms guest payment → merges finance, prints, removes tableOrder |
| `mergeItemsIntoDaily(dateKey, items, total, tableLabel)` | Pushes transaction to `orders/{date}` |
| `renderKeuangan()` | Renders finance tab: income, expenses, order list with type badges |
| `autoPrint(items, total, tableLabel)` | Native bridge → Web BT → fallback window.print() |
| `buildReceipt(...)` | ESC/POS bytes with dashed separators between items |
| `fallbackPrint(...)` | HTML receipt with dashed rows (browser print fallback) |
| `subOrders()` | Firebase listener on `orders/${curDate}` → updates `dailyOrders` → `renderKeuangan()` |
| `subAll()` | Sets up all Firebase listeners on login |
| `openQrModal()` | Admin QR code generator for table stickers |
| `initGuestView()` | IIFE — full guest self-service logic |
| `esc(s)` | HTML escape — applied to ALL user/DB data before innerHTML |

### Firebase listener wiring
```js
unsubAllTables = onValue('tableOrders', s => {
  tableOrders = s.val()||{};
  renderPendingOrders();    // legacy, no-ops if no waiting_confirmation
  renderActiveTables();     // shows active kasir orders
  renderPendingPayments();  // shows guest payment verification
  notifyWaitingVerification();
  scheduleRender();         // re-renders orders/cook list
});
```

---

## Keuangan tab

- Shows: Pemasukan (income), Pengeluaran Nota (expenses), Estimasi Profit
- **Detail Order** list: each row has type badge (**Dine-in** gold / **Takeaway** grey), tableLabel, time, total
- Admin gets 🗑 delete button per order row to remove false/accidental transactions
- Updates in real-time via `subOrders()` listener → `dailyOrders` → `renderKeuangan()`

---

## Receipt printing

- **Primary path (Android cashier app):** `window.MulaPrinter.printBase64(base64)` — native Bluetooth SPP bridge
- **Fallback 1:** Web Bluetooth (`connectPrinter` / `sendToPrinter`)
- **Fallback 2:** `window.print()` via `fallbackPrint()`
- Both ESC/POS (`buildReceipt`) and HTML (`fallbackPrint`) now have `--------` dashed lines between each item row
- Printer: RP022N / RPP02N thermal via Android classic Bluetooth

---

## Android cashier app (`android-cashier/`)

- WebView wrapper loading Firebase Hosting URL
- Native JS bridge: `window.MulaPrinter.printBase64(base64Receipt)`
- `PrinterBridge.kt` — classic Bluetooth SPP writer
- Manifest allows cleartext for LAN URL (`http://192.168.x.x:8080/`)
- Build output redirected to `C:\tmp\mula-cashier-build` (avoids OneDrive lock issues)
- To rebuild: open `android-cashier/` in Android Studio, run on device
- No APK rebuild needed for web-only changes — just reload the WebView

---

## Security

- `esc(s)` — applied to all `innerHTML` insertions
- `tableParam` validated against `TABLE_IDS` whitelist
- Admin password: `PASS = "mula2024"` (hardcoded — migrate to Firebase Auth later)
- Role: `admin` → sees Keuangan tab, price edits, menu add/delete, QR generator, Meja Aktif panel
- `karyawan` → sees Orders/Stock/Control only

---

## What NOT to break

- Admin login flow & role-based UI gating (`.admin-only`, `.admin-tab`)
- Menu editing (custom menu + price overrides + composition/yang-dimasak)
- Menu availability toggle (`menuAvailability/{itemId}`)
- Stock tab (receipts upload + stock list)
- Keuangan tab (daily income/expense/profit + order type badges)
- Bluetooth thermal printer (`connectPrinter`, `sendToPrinter`, `buildReceipt`)
- Native Android print bridge (`window.MulaPrinter.printBase64`)
- QR generator (admin → Control → QR Meja)
- Service worker / PWA (cache name: `mula-v15`)
- Date picker — viewing past days
- `esc()` applied to all innerHTML — do not remove
- `financeKey` stored in tableOrder — needed for Batal to reverse finance entry

---

## How to work on this codebase

1. **Always read this file first.**
2. Frontend assets now live in `assets/`: keep script load order from `index.html`, and read `assets/README.md` before moving code.
3. Use surgical edits, not full rewrites.
4. Test locally: `node server.js` → open `http://localhost:8080/` (staff) or `http://localhost:8080/table3` (guest)
5. **Deploy:** `firebase deploy --only hosting`
6. After deploy: reload Android WebView (Tools → Reload in cashier app)
7. Keep tight inline style (compact CSS/JS) — don't reformat existing code.
8. Indonesian language for all user-facing strings.
9. Always use `esc()` when inserting any user/DB data into innerHTML.

---

## History

### 2026-05-06 - Dashboard UI/UX Phase 2 continuation

- Continued Advanced Phase 2 dashboard work in `index.html`.
- Cashier order menu now has reusable category rail styling, stronger responsive grid rules, and section counts.
- `Mode Kelola` is wired: everyday cashier cards stay focused on ordering, while add/edit price/delete/availability actions are exposed from manage mode.
- Search filtering now works with the Phase 2 category grid DOM by hiding/showing `.menu-grid` sections instead of assuming a flat `.menu-item` list.
- `Rangkuman Order` now renders as a compact responsive summary grid.
- Follow-up polish added an `Order Aktif` strip above the menu, selected-card highlighting, quantity badges on category chips, and a one-tap `Kosongkan` cart action.
- Admin `Keuangan` now includes `Analisis Operasional`: local daily insights for top items, average basket, dine-in/kasir mix, payment mix, margin notes, and stale-order signals.
- Verified inline script parsing and a bounded `jsdom` smoke test for menu grids, manage toggle, availability controls, and search filtering.
- 2026-05-07 deploy: hosting deployed successfully to `https://mula-eatery.web.app`; functions deploy failed because project `mula-eatery` is not on Firebase Blaze, so `cloudbuild.googleapis.com` / `artifactregistry.googleapis.com` cannot be enabled yet.
- 2026-05-07 follow-up: Cloud ML was removed by request. Admin analytics is local-only in `index.html`; `functions.analyzeMulaData` and Cloud ML API calls were removed from source. Hosting was redeployed successfully.
- 2026-05-07 refactor: monolithic `index.html` split into `assets/css/mula.css` plus ordered classic scripts `assets/js/01-platform.js` through `07-guest-view.js`; service worker cache bumped to `mula-v17`; `package.json` pkg assets now include `assets/**/*`; `assets/README.md` documents the layout. Behavior should remain unchanged.
- 2026-05-07 bugfix: mixed `tanpa nasi` orders now support split quantities on a single menu item. Order data uses `tanpaNasiQty` instead of a single all-or-nothing flag, and the cashier UI, guest UI, finance strings, print flow, and Firebase normalization were updated to preserve combinations like `2 nasi + 2 tanpa nasi` for the same menu.
- 2026-05-07 deploy: hosting redeployed successfully after the `tanpaNasiQty` split-order fix. Live URL remains `https://mula-eatery.web.app`.
- 2026-05-09 offline hardening pass: cashier flow now persists unsynced finance entries and active kitchen orders in local durable storage before Firebase sync, merges those local entries back into active order / finance views while offline, and caches menu/config snapshots (`customMenu`, `priceOverrides`, `customMenuComps`, `menuAvailability`, `stock`) for offline reloads. Service worker cache bumped to `mula-v18`. This improves cashier resilience and direct printing during Wi-Fi drops, but guest full-offline still needs a reachable local/LAN app origin, not just Firebase hosting.
- 2026-05-11 kitchen timer pass: active kitchen orders now show a running timer and a single **Selesai** button. Tapping **Selesai** stops the timer by writing a completed snapshot to `kitchenHistory/{date}/{orderId}` with `durationMs`/`durationMinutes`, then removes the active queue item. Kitchen sound can be enabled from the active-order panel and is stored in localStorage as `mula_kitchen_sound`. Guest QRIS orders confirmed by cashier now become `status:'active'` kitchen orders instead of disappearing after payment confirmation. Service worker cache bumped to `mula-v19`.
- 2026-05-11 Android native kitchen alerts: `android-cashier` version bumped to 1.2 / versionCode 3. Added `KitchenAlertService.kt`, a foreground native service that initializes Firebase manually, signs in anonymously, listens to RTDB `tableOrders`, and posts high-importance sound/vibration notifications when new `status:'active'` kitchen orders appear. `MainActivity` now requests `POST_NOTIFICATIONS` on Android 13+ and starts the foreground service. Debug build succeeded; APK: `C:\tmp\mula-cashier-build\app\outputs\apk\debug\app-debug.apk`. No hosting/database deploy was run.
- 2026-05-11 predeploy polish: guest checkout/payment cards now use a lightweight CSS conic-gradient shader surface with reduced-motion fallback. Long text inside guest done icons was replaced with CSS-drawn status marks to prevent mobile overflow. Native `KitchenAlertService` now checks Android 13+ notification permission before posting, runs `START_STICKY`, and baselines already-active kitchen orders on first install so the APK does not alert for old orders during a busy service.
- 2026-05-11 cashier table selector: manual cashier checkout now includes a horizontal destination selector for `Takeaway` plus `Meja 1` through `Meja 9`. Cashier-created dine-in orders use queue IDs like `MEJA-3-1234` to avoid colliding with guest QR sessions at `tableOrders/3`, while finance/receipt labels use `Meja N`. `TABLE_IDS` expanded to 9, so QR generation and guest URL validation now cover tables 1-9.
- 2026-05-11 clean table URLs: guest QR codes now generate `https://mula-eatery.web.app/table1` through `/table9` instead of `?table=1`. Guest route parsing accepts both clean paths and legacy `?table=N`, so old QR stickers keep working until replaced. Service worker cache bumped to `mula-v21`.
- 2026-05-11 local polish and deploy hygiene: Firebase hosting ignore list now excludes loose subtitles/PDFs/order JSON/temp test outputs from root deploys. Local `server.js` now falls back to `index.html` for clean routes like `/table3`, matching Firebase Hosting rewrites. Staff app has a subtle shader-style background treatment, kitchen timers use tabular numerals, and mobile checkout/kitchen card layout was tightened.
- 2026-05-11 reference design pass: guest table ordering was restyled toward the supplied dark/gold mobile reference, with a MULA hero, dark premium menu cards, circular menu badges, gold category chips, dark checkout/payment states, and a refreshed bottom order bar. Fixed guest category chips by adding real section ids/data targets, disabled sold-out guest item controls, corrected payment-first copy, and explicitly shows the payment container for `pending_payment` / `waiting_verification`.
- 2026-05-11 predeploy bug sweep: fixed the later guest `openQrModal()` override so it keeps the QR library guard from the print module, preventing a crash if the QR CDN is not ready. Kitchen completion now queues `kitchen_done` jobs when `kitchenHistory/{date}/{orderId}` cannot be written immediately, so cooking duration data is preserved for later sync instead of being lost when staff taps **Selesai** during network issues.
- 2026-05-12 Blaze-free deployment decision: MULA is no longer using Midtrans or dynamic QRIS Cloud Functions. Guest app is only for table self-checkout/menu ordering to reduce cashier queueing; payment remains manual at the cashier. `firebase.json` no longer configures a Functions target, so plain `firebase deploy` stays on Firebase free-tier targets: Hosting + Realtime Database rules.
- 2026-05-12 manage/delete and Android chrome pass: finance `Detail Order` rows render a **Hapus** transaction button only for admin while `Mode Kelola` is active; the handler also removes matching local offline order/queue entries before deleting Firebase. Android cashier layout no longer shows the native black MULA Cashier banner; WebView is full-screen with a small top-right **Settings** button for URL/reload/printer tools.
- 2026-05-12 mobile UI repair after device screenshots: native Android Settings control moved to a small bottom-right floating button so it no longer blocks the web header. Android WebView forces MULA back to dark theme on page load to avoid the pale service UI. Mobile cashier CSS was tightened for clipped headers, `Rangkuman Order`, menu grids, and finance row action buttons. Admin finance rows now always show **Hapus** with confirmation for test cleanup.
- 2026-05-12 APK hosting safety: installable APK copies such as `MULA-Cashier-v24.apk` may live in the repo root for Panda/manual install, but Firebase Hosting must ignore `*.apk` because Spark plan forbids executable files in Hosting uploads.
- 2026-05-12 finance delete visibility fix: admin `Keuangan > Detail Order` delete action moved out of the cramped top-right action cluster into a full-width red **Hapus Transaksi Ini** button under each order row, so it remains visible on narrow Android screens.

### 2026-05-04 — Offline-First Architecture, Cash Change & Payment Methods

**Offline-First & Resilience:**
- Implemented `mula_offline_queue` using `localStorage` for fire-and-forget cashier orders.
- Removed `await` dependencies on Firebase push/set operations to prevent UI/printing freezing when WiFi drops.
- Added `syncOfflineQueue()` background loop to automatically sync queued orders when connection returns.
- Added connection status dot in header (Green = synced, Red = offline, Orange = syncing).

**Cashier & Checkout UX:**
- Added "Uang Tunai" input and "Kembalian" auto-calculation to Order Summary Modal.
- Added fast cash shortcut buttons (Uang Pas, 50k, 100k, 150k, 200k).
- Added "Metode Bayar" selector (Tunai, QRIS, Dana, GoPay, Transfer) for tracking.
- Cash/Change details now print on both ESC/POS BT receipts and browser fallback receipts.
- "Konfirmasi Bayar" (dine-in) auto-tags transactions as `paymentMethod: 'QRIS'`.

**Role & Permissions:**
- Karyawan role can now see the "Meja Aktif" panel (previously admin only).
- Karyawan sees "Print Lagi" and "✓ Selesai".
- Admin sees "✕ Batal", "Print Lagi", and "✓ Selesai".
- Keuangan tab detail rows now include colored badges for the payment method.
- Admin can click the edit icon (✎) on payment method badges in Keuangan to cycle/correct them.

**Service worker:** bumped through `mula-v15`

---

### 2026-05-04 - Cashier POS layout refactor

- Staff order screen now uses a wider menu column and smaller sticky `Rangkuman Order` side panel on tablet/desktop.
- `Proses ke Dapur` moved from the top header into a viewport-fixed bottom checkout bar with the total, so it stays visible while the menu scrolls.
- Manual order tap targets are larger for tablet use, and the submit button disables when cart quantity is zero.
- Service worker cache bumped to `mula-v15` for fresh deployed UI.
- Full-day admin `Reset` button removed entirely from the UI and role setup path to prevent destructive order wipes.

### 2026-05-03 — Finance realtime, print improvements, cashier UX

### 2026-05-04 - Daily order summary panel

- Staff/admin order right panel renamed from `Yang Dimasak` to `Rangkuman Order`.
- `renderOrderSummary()` now aggregates `dailyOrders` from `orders/{curDate}` by menu item, showing quantity ordered today plus subtotal.
- The old `getCookOrders()` / component-count logic remains for compatibility but is no longer the visible right-panel source.

### 2026-05-04 - Finance order count KPI

- Keuangan header now includes a `Jumlah Order` KPI card.
- The value is driven from `orderRows.length` inside `renderKeuangan()`, so admins can see transaction count immediately without scanning the detail list.
- The cashier checkout dock was hardened so `Proses ke Dapur` floats independently of the order panel; `#orderPanel` now uses `overflow:visible` and extra bottom padding so the fixed dock stays visible while scrolling.

### 2026-05-02 — Native cashier bridge + menu availability + receipt sizing + cashier shell polish

- `android-cashier/` Android WebView wrapper with `window.MulaPrinter.printBase64` native bridge
- `menuAvailability/{itemId}` — per-item habis toggle (admin + karyawan)
- Receipt print CSS fixed for 58mm paper width
- Android cashier shell polished (MULA branding, Tools button)

### 2026-04-30 — Free-plan revert (static QRIS + manual verification)

- Guest flow: `pending_payment` → `waiting_verification` → `paid`
- Admin confirms payment manually via "💳 Verifikasi Pembayaran" panel
- Local demo mode: `node server.js` (DEMO_MODE = false in prod)

### 2026-04-29 — Payment-first flow + security hardening

- Removed `waiting_confirmation` status
- `getCookOrders()` excludes `pending_payment` orders (kitchen bug fix)
- `esc()` helper added, applied everywhere
- `tableParam` URL whitelist validation

### 2026-04-28 — Guest UI refresh

- Guest view restyled with cream editorial surface + `MULAFINAL.png` hero

### 2026-04-19 — Flow pivot

- Full interactive guest menu with cart, rounds, payment
- `konfirmasiBayar()` + pending payments panel added

---

## Future work

- **Auto payment confirmation** via Midtrans/Xendit QRIS Dynamic (Firebase Functions, Blaze plan)
- **Firebase Auth** for admin password (replace hardcoded `PASS`) -> DONE (2026-05-06)
- **Firebase Security Rules** — restrict write paths per role -> DONE (2026-05-06)
- **Guest cart persistence** (localStorage)
- **Item images** on guest menu
- **Multi-language** (English toggle for tourists)

### Upcoming UI/UX Improvements (Phase 2 & 3)
*   **Phase 2: Modern Layout & Structure**
    *   **P2.1 Grid System:** Convert `menuList` and `cookList` to modern CSS Grids (`grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))`) to utilize tablet/desktop screen real estate efficiently.
    *   **P2.2 Category Layout:** Replace the current flat list with horizontally scrollable or distinctly grouped category sections to reduce vertical scrolling.
    *   **P2.3 Unified Admin Actions:** Combine "Tambah", "Hapus", "Edit Harga", and "Tandai Habis" into a cohesive "Manage Mode" or a unified `⋮` dropdown menu to declutter the item cards.
*   **Phase 3: Visual Polish & Interactions**
    *   **P3.1 Theming:** Apply a cohesive "Glassmorphism" effect to modals (using `backdrop-filter: blur()`).
    *   **P3.2 Feedback:** Enhance micro-interactions (ripple effects on buttons, smooth scale transitions on category selection).
    *   **P3.3 Typography:** Ensure consistent `font-weight` hierarchies across all price and quantity displays.

### 2026-05-09 - Finance payment-method edit fix

- `Keuangan` rows now preserve `paymentMethod` in the rendered model so the admin edit control is stateful instead of always showing `?`.
- Clicking `Edit` now updates the local UI immediately; if the row is still coming from the local offline cashier store, that payment-method edit is also persisted locally before Firebase sync returns.

### 2026-05-12 - Android stale WebView delete-button fix

- Hosted shell now loads CSS/JS with `?v=26`, and the service-worker cache was bumped to `mula-v26`, so old cached `04-dashboard.js` cannot hide the finance delete button.
- Android cashier app version bumped to 1.3 / versionCode 4. WebView uses `LOAD_NO_CACHE`, appends `app_v=26` on load, clears WebView HTTP cache, and unregisters old service workers / CacheStorage after page load without deleting localStorage.
- Settings menu reload action is now `Reload paksa`; APK copied to `C:\Users\habib\OneDrive\Desktop\MULA\MULA-Cashier-v26.apk`.

### 2026-05-15 - Menu availability toggle repair

- `Tandai Habis` now persists through `menuAvailability/{itemId}` again. `database.rules.json` explicitly allows public reads and authenticated writes for `menuAvailability`, so guest ordering can see sold-out items and staff can save availability changes.
- `setItemOutOfStock()` now updates local `menuAvailability` optimistically, clears the active cart quantity when an item is marked habis, re-renders immediately, writes `true` for habis, and removes the flag when set back to tersedia.
- Karyawan now sees `Mode Kelola` and can use `Tandai Habis` / `Tersedia`; as of v64 they can also add new custom menu items, while edit price, delete menu, stock, and finance remain admin-gated.
- Hosted shell was bumped to `?v=34`, service worker cache to `mula-v34`, and Hosting + Realtime Database rules were deployed successfully.

### 2026-05-20 - Order history timestamp / AI analysis deploy

- Restored the Keuangan order-history regression after a UI/UX pass: `renderKeuangan()` keeps rows newest-first by `tx.time`, renders a visible `keu-time-badge` for each transaction, keeps legacy rows marked as `Legacy`, and `renderAdminAnalysis()` reattaches the Groq / Neural Agent analysis button after rerenders.
- `emptyStateHTML()` now has a real implementation again so dashboard render paths do not break before finance/history loads.
- Hosted assets were bumped to `?v=38`, service-worker registration cache to `mula-v38`, and `npm run deploy` completed successfully for Firebase Hosting + Realtime Database rules.
- Live checks confirmed `https://mula-eatery.web.app/` serves `04-dashboard.js?v=38`, `mula-sw-register.js?v=38`, `mula.css?v=38`, the deployed dashboard contains `keu-time-badge` / `orderRows.sort` / `ensureGroqBtn`, and the deployed service worker registration contains `mula-v38`.

### 2026-05-20 - Active order detail duration badge deploy

- Active order detail modal now prepends an `orderDetailTimingHTML()` header with Order time, Masuk Dapur time, and live Durasi. The duration uses the same `.kitchen-timer[data-start]` updater as the active order card, so it keeps ticking while the modal is open.
- Hosted assets were bumped to `?v=39`, service-worker registration cache to `mula-v39`, and `npm run deploy` completed successfully for Firebase Hosting + Realtime Database rules.
- Live checks confirmed `https://mula-eatery.web.app/` serves v39 assets, the deployed dashboard contains `orderDetailTimingHTML` / `Masuk Dapur` / `Durasi`, and the service-worker registration contains `mula-v39`.

### 2026-05-26 - Android performance and Tambah Menu v59

- Mid-low Android smoothing pass: `MainActivity.kt` now injects `body.android-lite`, and `assets/css/mula.css` removes heavy shadows, backdrop filters, lock-screen shaders, and long animations in the Android WebView while keeping the normal browser UI intact.
- Cashier menu quantity changes now update the touched menu card through `updateItemDOM()` instead of rerendering the full order grid on every tap; full rerender is kept only for nasi/tanpa-nasi boundary changes that affect grouped rows.
- `Tambah Menu` UX now resets cleanly, focuses the name field, validates name/price inline, disables the save button while writing, explains the `Yang Dimasak` checklist, supports Enter on new custom rows, and renders pending rows with remove buttons before save.
- Hosted assets were bumped to `?v=59`, service-worker registration cache to `mula-v59`, and Android `APP_WEB_VERSION` to `59`. Syntax checks passed for `assets/js/*.js`, and `firebase.json` / `database.rules.json` parsed successfully.
- Firebase Hosting ignore rules were tightened so root Hosting deploy scanned 818 files instead of the whole repo. `npm run deploy` completed successfully for Hosting + Realtime Database rules, and live checks confirmed v59 HTML, dashboard JS, CSS `android-lite`, and service-worker cache. The stale `functions` target was removed from `firebase.json` afterward so future plain deploys stay Blaze-free.
- Debug APK build succeeded after Gradle downloaded the missing Android `aapt2` artifact once. Installable APK copied to `C:\Users\habib\OneDrive\Desktop\MULA\MULA-Cashier-v59.apk`.

### 2026-05-26 - Meja Aktif checklist partial completion v60

- `Meja Aktif` kitchen cards now render each order line with a checkbox plus `Pilih semua`. Staff can check only finished lines and tap the single `Selesai` button; unchecked items stay in the same `tableOrders/{tid}` active order.
- `completeKitchenOrder(tid, lineKeys)` now splits selected lines into a partial `kitchenHistory/{date}/{tid}-part-{timestamp}` snapshot and writes the remaining items back to `tableOrders/{tid}`. Full completion still removes the active order and patches finance duration.
- Mixed nasi/tanpa-nasi rows split safely by line key (`rice`, `no_rice`, `all`), so finishing normal nasi does not accidentally finish `tnp nasi` for the same menu item.
- Offline kitchen-done queue handling now supports partial completion by replaying both the history snapshot and the remaining active-order payload when reconnecting.
- Hosted assets were bumped to `?v=60` and service-worker registration cache to `mula-v60`; `npm run deploy` completed successfully for Hosting + Realtime Database rules. Verification included JS syntax checks, a focused split-logic probe confirming selected lines go to history while remaining lines stay active, and live checks for v60 HTML/dashboard/state/CSS/service-worker assets.
- Follow-up v61: removed the separate `Selesai Pilihan` button. The single `Selesai` button now completes checked lines when any checklist rows are selected, otherwise it confirms and completes the whole active order.

### 2026-05-26 - Mobile viewport clipping fix v63

- Phone screenshots showed the staff cashier UI chopped on the right because the page hid horizontal overflow while fixed/min-width grids, panels, and header controls could still exceed the native viewport.
- `assets/css/mula.css` now constrains `html`, `body`, `.app`, panels, menu grids, menu cards, order grids, header rows, search, tab rails, and category rails to `100%` / `100dvw` with `min-width:0`; narrow screens use `minmax(0,1fr)` and category chips wrap inside the viewport.
- `assets/js/03-app-state.js` injected cashier styles now use dynamic menu grid sizing (`minmax(min(100%,280px),1fr)`) instead of the previous fixed `340px` minimum.
- Follow-up v63 stopped the phone header, top tabs, and menu category chips from opening half-cut on the right edge: mobile header controls wrap inside the native viewport, tabs divide across the viewport, and category chips wrap instead of relying on horizontal scroll.
- Hosted assets were bumped to `?v=63` and service-worker registration cache to `mula-v63`. Local Puppeteer checks at 360, 390, and 412 px showed document scroll width equal to viewport width, with no non-scroller elements extending past the right edge.

### 2026-05-27 - Mode Kelola manual add menu v64

- `Mode Kelola` now shows a `Tambah Menu Manual` toolbar plus per-category `+ Tambah` buttons for any authenticated staff role. The modal keeps the category dropdown active, so a new item like `Soto Ayam` can be saved directly into `Main Course`.
- `database.rules.json` now allows authenticated writes to `customMenu` and `customMenuComps`, matching the staff/karyawan add-menu workflow; `priceOverrides`, delete controls, stock, and finance remain admin/password-gated in UI/rules.
- Mobile add-menu modal now opens top-aligned with its own scroll and sticky action buttons, so name, price, category, and `Simpan` remain reachable on 360px Android screens.
- Hosted assets were bumped to `?v=64` and service-worker registration cache to `mula-v64`. Local Puppeteer verification confirmed karyawan `Mode Kelola` shows `Tambah Menu Manual`, opens the modal with `Main Course` selected, and has zero page-width overflow at 360px.

### 2026-05-27 - Kitchen customer name label v65

- Kitchen/customer labels now use a shared `orderDisplayLabel()` helper in `assets/js/04-dashboard.js`, combining `tableLabel` and `customerName` so `Meja 1` with customer `Andi` renders as `Meja 1 Andi` in Meja Aktif and payment verification rows.
- Guest payment confirmation now preserves `customerName` into finance payloads and active kitchen payloads, and active/pending/finance print paths pass the customer name into `autoPrint()` instead of accidentally treating payment method as the receipt name.
- Hosted assets were bumped to `?v=65` and service-worker registration cache to `mula-v65`; `npm run deploy` completed successfully and live Puppeteer verification confirmed a `Meja 1` order with customer `Andi` renders as `Meja 1 Andi` in Meja Aktif with zero page-width overflow at 360px.

### 2026-05-27 - Order identity, menu components, checkout scroll, signature v66

- Order rows now render table/order identity and customer identity as separate visual elements through `orderIdentityHTML()`, so `Meja 1` and `Pelanggan Andi` are distinguishable in Meja Aktif, pending/payment rows, and Keuangan history rows.
- `Tambah Menu` composition now supports existing built-in components plus custom kitchen components. Example verified: `Nasi Rendang` saves `customMenuComps/{id}` as `contribs:["nasi_putih"]` and `newRows:["Rendang"]`, while the kitchen summary counts both `Nasi Putih` and `Rendang`.
- The order confirmation modal after `Proses ke Dapur` is scrollable on 360px Android widths: modal and main body use vertical overflow, the box is capped to the dynamic viewport, and the confirm footer stays reachable.
- App signature added in the Control tab: GitHub `dhabib69` and email `habib.khairul32@gmail.com`.
- Hosted assets were bumped to `?v=66` and service-worker registration cache to `mula-v66`; `npm run deploy` completed successfully for Hosting + Realtime Database rules. Live checks confirmed v66 assets and a 360px Chrome probe verified separated `Meja 1` / `Andi`, `Nasi Rendang = Nasi Putih + Rendang`, checkout modal scrollability, no horizontal overflow, and the signature links.

### 2026-05-27 - Tambah Menu composition builder v67

- The `Tambah Menu Manual` modal no longer renders the full `COMPS` array as a long checkbox wall. It now opens at the top with name, price, category, selected composition, new component input, and a compact searchable existing-component picker.
- Component selection is tracked through hidden selected inputs instead of relying on all checkboxes being visible, so filtered/search results do not drop selected components before save.
- The `addRowBtn` path now calls `addPendingRowFromInput()` and refreshes the selected composition chips, preventing stale/duplicated legacy row rendering.
- Local Chrome verification at 360px and desktop widths confirmed the modal title/name/price/category/new-component/search are visible, no horizontal overflow occurs, sticky actions no longer cover the component search, and the test save payload for `Nasi Rendang` remains `contribs:["nasi_putih"]` plus `newRows:["Rendang"]`.

### 2026-05-28 - Multi-device order sync hardening

- Local order mirrors now only render while their matching `mula_offline_queue` job is still pending. `mergedDailyOrders()` and `mergedActiveOrders()` prune stale `mula_local_daily_orders` / `mula_local_active_orders` entries once Firebase has the remote record or the queue no longer owns the local copy.
- Cashier submit and guest payment confirmation still show the order immediately on the submitting device, but they queue a fallback job first and then clear the local mirror + queue entry after both `orders/{date}/{finKey}` and `tableOrders/{tid}` writes confirm.
- Kitchen completion no longer writes remote duration patches back into local daily-order storage unless a queued offline replay needs it, preventing one device from resurrecting stale finance/history rows after another device completes or deletes an order.
- Web assets were bumped to `?v=68`, service-worker cache to `mula-v68`, and Android `APP_WEB_VERSION` to `68` so device WebViews request the fixed sync code after deploy.
- `npm run deploy` completed successfully for Hosting + Realtime Database rules. Live HTTPS verification confirmed v68 HTML, `mula-v68` service-worker registration, and deployed `03-app-state.js` / `06-checkout.js` contain the pending-queue cleanup logic.

### 2026-05-31 - Receipts decoupling and Keuangan loading crash fix v75

- **Decoupled Receipt Images**: Receipts previously loaded extremely slowly in the Keuangan tab due to embedding heavy Base64 image data directly in the `receipts/${id}` database node. Receipt image data was moved to `/receiptsImages/${id}` and nulled in `/receipts/${id}/img`. Decoupled note details are now stored in `orders/${dateKey}/receipts/${receiptId}` = `{note, total}` for lightweight rendering.
- **Fixed Keuangan Crash & Restored Stats**: Tapping the Keuangan tab threw a `ReferenceError: subKitchenHistory is not defined` crash which caused the tab to show 0 orders. Fixed by implementing `subKitchenHistory()` inside [03-app-state.js](file:///c:/Users/habib/OneDrive/Desktop/MULA/assets/js/03-app-state.js) to subscribe to kitchen durations.
- **Added Receipt Iteration Guards**: Added guards `if(txId === 'receipts') return;` in `getDailyOrderSummary()`, `buildLocalAnalysis()`, and `renderKeuangan()` inside [04-dashboard.js](file:///c:/Users/habib/OneDrive/Desktop/MULA/assets/js/04-dashboard.js) to prevent the receipts subkey from being processed as order transactions.
- **Cache Bump and Deployment**: Bumped assets cache version to `v=75` in [index.html](file:///c:/Users/habib/OneDrive/Desktop/MULA/index.html) and `mula-v75` in [mula-sw-register.js](file:///c:/Users/habib/OneDrive/Desktop/MULA/assets/js/mula-sw-register.js). Deployed to Firebase Hosting successfully.

### 2026-06-01 - Offline queue helper functions missing bugfix v76

- **Fixed Missing Offline Helpers**: Addressed the `ReferenceError: queueOfflineJob is not defined` crash which occurred during cashier manual checkouts (`06-checkout.js`) and guest payment confirmations (`04-dashboard.js`).
- **Implemented Queue Utilities**: Defined `readOfflineQueue()`, `writeOfflineQueue(q)`, `queueOfflineJob(job)`, and `removeQueuedOrder(tid, finKey)` directly in `assets/js/03-app-state.js` so all calls to offline queue logic have a concrete implementation.
- **Cache Bump & Deployment**: Bumped asset cache versions to `v=76` in `index.html` and `mula-v76` in `mula-sw-register.js` and successfully deployed to Firebase Hosting.

### 2026-06-03 - Agent routing and check workflow v79

- Added `AGENTS.md` as the first-read agent guide for product boundaries, deploy scope, version discipline, and verification levels.
- Added `ROUTING.md` as a compact map from task families to owner files/functions and Firebase data paths, so future agents do not need broad scans before routine changes.
- Added `tools/check-mula.js` and `npm run check` to validate JSON, browser JS syntax, local asset references, Firebase Hosting/Database-only deploy boundary, cache-version alignment, local `config.js`, and known Keuangan/receipt regression guards.
- Aligned current cache markers to v79: `index.html` asset query strings, `assets/js/mula-sw-register.js` `mula-v79`, and Android `APP_WEB_VERSION = 79`.
- Replaced a NUL-corrupted `.gitignore` line that Git interpreted as broad `*`, so new routing/check files are no longer hidden from `git status`.
- Verification: `npm run check` passed locally.

### 2026-06-03 - Guest checkout and payment verification v80

- `menuAvailability` now resets once per local date through a shared remote `_resetDate` marker. The first app/device that opens after midnight writes `menuAvailability = {_resetDate: today}`, clearing all `Tandai Habis` flags without relying on Cloud Functions or a paid scheduler.
- Guest self-checkout routing now accepts `/tableN`, `/mejaN`, `/selfcheckout-N`, `/guest/N`, `?table=N`, `?meja=N`, `?t=N`, and hash table links. Valid table routes hide the staff lock screen and open the guest web app directly.
- Guest search now filters menu rows using item name, category, and id, shows a clear button, preserves the filter across rerenders, and displays a `Menu tidak ditemukan` empty state when no items match.
- Guest pending-payment screens now include clearer cashier instructions plus `Ubah Pesanan` and `Batalkan` actions before staff confirmation. Editing loads the pending order back into the guest cart and removes the unconfirmed `tableOrders/{table}` record; cancelling removes it.
- Staff `Verifikasi Pembayaran` rows are larger/readable and now include `Konfirmasi Bayar`, `Edit`, `Batal`, and `Print Lagi` while status is `waiting_verification`. Edit returns the order to `pending_payment`; Batal removes it before it reaches finance or kitchen. Confirmed payment still writes finance and active kitchen payloads through `konfirmasiBayar()`.
- Cache markers were bumped to v80: `index.html ?v=80`, `assets/js/mula-sw-register.js` `mula-v80`, and Android `APP_WEB_VERSION = 80`.
- Verification: `npm run check` passed, a route parser probe covered table/selfcheckout URL variants, and a bounded jsdom smoke confirmed guest self-checkout opens instead of staff login, guest search works, a guest order reaches `pending_payment` then `waiting_verification`, and staff Edit/Batal buttons render.

### 2026-06-03 - Guest pending-payment edit preservation v82

- `assets/js/07-guest-view.js` now uses a local `gvEditingOrder` mode for `Ubah Pesanan` so the guest menu edits the existing `tableOrders/{table}` draft in place instead of removing the order first.
- Staff `Verifikasi Pembayaran` `Edit` still returns `waiting_verification` to `pending_payment`, but saving changes preserves the existing table order identity, `createdAt`, `dateKey`, and other fields while replacing only the editable item/customer/total payload.
- The explicit cancel path is still the only guest-side path that removes `tableOrders/{table}` before payment confirmation.
- Cache markers were bumped to v82: `index.html ?v=82`, `assets/js/mula-sw-register.js` `mula-v82`, and Android `APP_WEB_VERSION = 82`.
- Verification: `npm run check` passed, then `npm run deploy` completed successfully for Hosting + Realtime Database rules.

### 2026-06-04 - Verifikasi Pembayaran dual edit flow v83

- `assets/js/04-dashboard.js` now offers two staff actions in `Verifikasi Pembayaran`: `Edit Tamu` sends the same pending order back to the guest/table screen, while `Edit Kasir` opens a compact cashier-side editor inside the payment card.
- Cashier editing updates the same `tableOrders/{table}` record in place with plus/minus item controls and an add-menu selector, recalculating totals with the shared menu pricing helpers before payment confirmation.
- The order remains in `waiting_verification` during cashier edits, so staff can correct items and press `Konfirmasi Bayar` without forcing the guest back through confirmation.
- `assets/css/mula.css` adds the pending cashier editor layout. Cache markers were bumped to v83 in `index.html`, `assets/js/mula-sw-register.js`, and Android `APP_WEB_VERSION`.
- Verification: `npm run check` passed, then `npm run deploy` completed successfully for Hosting + Realtime Database rules.

### 2026-06-04 - Guest save undefined editedAt fix v84

- Fixed the guest table save path in `assets/js/07-guest-view.js` so `editedAt` is only written when it has a real value. Firebase rejects `undefined`, which caused `set failed: value argument contains undefined in property 'tableOrders.9.editedAt'` on new guest orders.
- Cache markers were bumped to v84 in `index.html`, `assets/js/mula-sw-register.js`, and Android `APP_WEB_VERSION`.
- Verification: `npm run check` passed, then `npm run deploy` completed successfully for Hosting + Realtime Database rules.

### 2026-06-04 - Android cashier URL guest-route fix v85

- Fixed `assets/js/01-platform.js` `getTableParamFromUrl()` so Android cashier cache-buster URLs like `/?app_v=85&t=...` no longer get interpreted as guest table routes. The parser now accepts exact `table`/`meja` query values and ignores legacy `t` when `app_v` is present.
- Clean QR paths like `/table9` and explicit `?table=9` still open the guest app normally.
- Cache markers were bumped to v85 in `index.html`, `assets/js/mula-sw-register.js`, and Android `APP_WEB_VERSION`.
- Verification: `npm run check` passed, a direct parser probe confirmed cashier root returns no table while `/table9` returns `9`, then `npm run deploy` completed successfully.

### 2026-06-04 - Conservative C drive cache cleanup helper

- Added `clean-c-drive-cache.bat` for repeatable conservative C: cleanup: user temp older than 1 day, Windows temp older than 1 day, Chrome/Edge cache and code cache, Windows INetCache, Delivery Optimization cache, and npm cache.
- The default cleanup intentionally skips Recycle Bin and Gradle caches. Run `clean-c-drive-cache.bat --gradle` only when disk pressure is high and redownloading Android/Gradle dependencies is acceptable.
- Initial run freed about 559.82 MB. Post-cleanup sizes were user temp ~9.86 MB, npm cache ~7.18 MB, Chrome/Edge caches near 0 MB, and Gradle caches still ~1.5 GB by design.
- Verification: `npm run check` passed before the cleanup/script change.

### 2026-06-04 - Expanded C drive cache cleanup coverage

- Expanded `clean-c-drive-cache.bat` beyond the first-pass targets to include browser profile caches across Chrome/Edge/Brave, browser GPU caches, service-worker cache storage, Puppeteer temp profiles, Explorer thumbnail/icon caches, Windows WebCache, DirectX shader cache, Windows Error Reporting/crash caches, Windows Update download cache, and pip/Yarn/pnpm/npm cache locations.
- The default run still skips risky or dependency-heavy buckets: Recycle Bin, Gradle caches, and `C:\ProgramData\Package Cache`. Use `--gradle` to reclaim the Android/Gradle dependency cache, or `--packages` only if installer repair/uninstall redownload prompts are acceptable.
- Expanded default cleanup freed another ~7.47 MB after the earlier cleanup. Remaining large opt-ins were Gradle caches at ~1.5 GB and installer package cache at ~578 MB; Windows WebCache remained ~45 MB because active Windows services can keep those database files locked.
- Verification: `npm run check` passed after the expanded script update.

### 2026-06-13 - Keuangan business analytics v86

- Added professional Keuangan analytics in `assets/js/04-dashboard.js`: weekly income bars, 30-day trend line, menu revenue drivers, best/worst income days, average basket, margin, and 30-day revenue/profit projections from real `orders/{date}` data.
- The analysis excludes `orders/{date}/receipts` from income and treats receipts as expenses, matching the finance data model.
- `assets/css/mula.css` adds responsive chart/projection styling so the analytics panel collapses cleanly on mobile.
- Cache markers were bumped to v86 in `index.html`, `assets/js/mula-sw-register.js`, and Android `APP_WEB_VERSION`.
- Firebase Hosting deploy initially failed on Spark because root Hosting tried to upload executable artifacts. `firebase.json` now ignores executable/build artifacts such as `**/*.apk`, `**/*.bat`, `**/*.cmd`, `**/*.dll`, `**/*.exe`, and `**/*.msi`.
- Verification: `npm run check` passed, `npm run deploy` completed successfully, and live checks confirmed hosted HTML `v86` plus service worker `mula-v86`.

### 2026-06-13 - Keuangan analytics polish v87

- Improved the Keuangan business visualization so the 7-day bar chart shows exact compact Rupiah values and dates, and the 30-day trend chart shows scale labels instead of a numberless decorative line.
- Rewrote the projection analysis copy into smoother operational Indonesian and added a visible formula block: daily mean, standard deviation, normal-range projection, and projected profit from margin.
- Cache markers were bumped to v87 in `index.html`, `assets/js/mula-sw-register.js`, and Android `APP_WEB_VERSION`.
- Verification: `npm run check` passed, `npm run deploy` completed successfully, and live checks confirmed hosted HTML `v87` plus service worker `mula-v87`.

### 2026-06-13 - Keuangan hidden neural analysis v89

- Keuangan analytics now stays collapsed by default and shows only a prompt inside `analysisPanel`.
- Pressing `Neural Agent Intelligent Analysis` reveals the local business analytics immediately. If `GROQ_API_KEY` exists, the same button can still append the LLM analysis result; without a key it no longer blocks the local analytics behind an alert.
- The visible finance cards and order history remain available before opening analysis.
- Cache markers were bumped to v89 in `index.html`, `assets/js/mula-sw-register.js`, and Android `APP_WEB_VERSION`.
- Verification: `npm run check` passed, `npm run deploy` completed successfully, and live checks confirmed hosted HTML `v89` plus service worker `mula-v89`.

### 2026-06-14 - Keuangan current omset UX v90

- The revealed Keuangan neural analysis now starts with an executive row showing real selected-date omset, real profit, transaction count, normal daily target, and target gap before the 30-day projection.
- Projection and analysis wording uses `omset`, not `omzet`.
- The actual/projection hero layout stacks cleanly on mobile and keeps the business graphs hidden until `Neural Agent Intelligent Analysis` is pressed.
- Cache markers were bumped to v90 in `index.html`, `assets/js/mula-sw-register.js`, and Android `APP_WEB_VERSION`.
- Verification: `npm run check` passed, `npm run deploy` completed successfully, and live checks confirmed hosted HTML `v90` plus service worker `mula-v90`.

### 2026-06-14 - Keuangan period-to-date omset v91

- Changed Keuangan analytics from rolling windows to calendar period-to-date calculations.
- `Minggu Ini` now starts on Monday and accumulates through the selected date. `Bulan Ini` starts on the 1st and accumulates through the selected date, so on June 14 it uses June 1-14 instead of the previous rolling 30 days.
- The 30-day projection now uses `bulan berjalan / elapsed calendar days x 30`, so the formula denominator is the selected month day count, including zero-order days.
- Labels were changed from `7 Hari` / `30 Hari` to `Minggu Ini` / `Bulan Ini`, with charts renamed to `Omset Minggu Ini` and `Tren Omset Bulan Ini`.
- Cache markers were bumped to v91 in `index.html`, `assets/js/mula-sw-register.js`, and Android `APP_WEB_VERSION`.
- Verification: `npm run check` passed, `npm run deploy` completed successfully, and live checks confirmed hosted HTML `v91` plus service worker `mula-v91`.

### 2026-06-24 - Today-only order guard v92

- Added an order-date guard in `assets/js/03-app-state.js`, `assets/js/04-dashboard.js`, `assets/js/06-checkout.js`, and `assets/js/07-guest-view.js` so both cashier and guest order submits block unless the selected date is today.
- The cashier UI now disables order quantity controls, note edits, and the manual checkout button when the date is not today, and the guest checkout button also refuses to submit with the same popup message.
- Cache markers were bumped to v92 in `index.html`, `assets/js/mula-sw-register.js`, and Android `APP_WEB_VERSION`.
- Verification: `npm run check` passed after the guard and version updates.

### 2026-06-24 - Today-only order guard deployed v92

- Deployed the today-only order guard changes to Firebase Hosting and Realtime Database with `npm run deploy`.
- Firebase CLI reported hosting release complete and database rules released successfully for project `mula-eatery`.
- Live HTTP verification from this shell hit an outbound connection failure, so hosted HTML was not re-fetched here after the deploy.

### 2026-07-07 - Synthetic revenue dataset & operational financial report

- Generated a synthetic operational revenue dataset and a professional financial report for MULA Eatery covering the period 1 January 2026 to 30 June 2026 (181 days).
- Implemented a Python dataset generator script (`tools/generate_financial_report.py`) to simulate daily revenues following a natural normal (Gaussian) distribution with median and mean of exactly IDR 2,850,000, and standard deviation of IDR 600,000 (ranging between ~1,185,000 and ~4,515,000 IDR).
- Simulated daily transactions (orders) composed of actual menu items and prices defined in `assets/js/02-menu-data.js` to ensure the daily revenue totals are mathematically realistic and match MULA Eatery's menu pricing.
- Outputs saved under the `revenue_dataset/` directory:
  1. `daily_revenue_summary_2850.csv`: Continuous daily revenue with YYYY-MM-DD dates and IDR revenue.
  2. `detailed_transactions_2850.csv`: Transaction log showing Order ID, item names with quantities, and order totals.
  3. `mula_menu_reference_2850.csv`: Catalog of menu items and their prices used in the simulation.
  4. `mula_financial_report_h1_2026.pdf`: Professional operational financial report containing the executive summary, monthly operational metrics, statistics table, and the full multi-column chronological sales ledger of H1 2026.


### 2026-07-26 - Login startup hardening v93

- Core Admin/Karyawan role handlers now bind exactly once after `DOMContentLoaded`; the guest-view script no longer registers a competing second copy.
- Firebase/config startup failures are caught and shown as a visible recovery message instead of leaving the role buttons inert.
- `npm run check` now blocks a deploy when `assets/js/config.js` is absent and verifies the login-startup safeguards, alongside cache alignment v93.

### 2026-07-26 - Kitchen partial-completion checklist v94

- Active kitchen order cards again show a checkbox for every order line plus `Pilih semua`. Staff may finish only checked lines; unchecked lines remain active for the next batch.
- Partial completion writes only the selected items to `kitchenHistory` and preserves the remaining `tableOrders` payload, including mixed nasi/tanpa-nasi orders and offline replay.

### 2026-07-26 - Live order summary v95

- `Rangkuman Order` now reads only the active kitchen/current cashier order state, not `dailyOrders` history. Historical transaction details remain in Keuangan.

### 2026-07-26 - Redeployed MULA v92

- Aligned `index.html` asset versions (`v92`), service worker cache (`mula-v92`), and Android `APP_WEB_VERSION` (92).
- Fixed `subKitchenHistory` in `assets/js/03-app-state.js` and added `receipts` transaction guards in `assets/js/04-dashboard.js`.
- `npm run check` passed all checks.
- Executed `npm run deploy` (`firebase deploy --only hosting,database`) — successfully deployed to Firebase Hosting (`https://mula-eatery.web.app`) and updated database rules.

### 2026-07-27 - Cache Purge & Strict Calendar Charts v105

- Updated `GROQ_CACHE_KEY` in `08-ai-analysis.js` to `'mula_groq_analysis_v105'` to invalidate old cached HTML payloads from user browsers.
- Strictly enforced Calendar Week (Monday–Sunday) with "Belum Ada" indicators for future days and Calendar Month (1st to Month-End) with 3 projection lines (Optimistic 🟢, Realistic 🟡, Lower 🔴).
- Bumped version tags to `v105` across `index.html`, `mula-sw-register.js` (`mula-v105`), and `MainActivity.kt` (`APP_WEB_VERSION = 105`).
- Verified with `npm run check` and deployed to Firebase Hosting (`https://mula-eatery.web.app`).














### 2026-07-27 - Auto-Persist & Minimize/Expand Neural Analysis v106

- Auto-loads cached analysis on Keuangan tab open if today's cache exists (no Groq call needed).
- Added minimize/expand toggle button in the analysis card header (state persisted in localStorage as mula_groq_minimized).
- Bumped version tags to v106 across index.html, mula-sw-register.js (mula-v106), and MainActivity.kt (APP_WEB_VERSION = 106).
- Verified with npm run check and deployed to Firebase Hosting (https://mula-eatery.web.app).

### 2026-07-27 - Rangkuman Order Tab v107

- Added new tab '?? Rangkuman' in index.html and tab-content panel (id=tab-rangkuman) with 3 KPI cards (total pcs, total jenis, menu terlaris) and rkMenuList.
- Added renderRangkuman() in 04-dashboard.js: aggregates all dailyOrders items by itemId, sums qty/revenue, sorts by qty desc, renders ranked list with progress bars and ?????? medals.
- Wired renderRangkuman() into the tab click handler in 03-app-state.js.
- Bumped version tags to v107 across index.html, mula-sw-register.js (mula-v107), and MainActivity.kt (APP_WEB_VERSION = 107).
- Verified with npm run check and deployed to Firebase Hosting (https://mula-eatery.web.app).

### 2026-07-27 - Menu Summary in Analysis Card v108-v109

- Added buildMenuSummaryHTML() in 08-ai-analysis.js: reads dailyOrders, aggregates qty+revenue per item via buildOrderLines, sorts by qty desc, renders ranked list with progress bars and medals.
- Injected menu summary below weekly chart inside showGroqResult() in 08-ai-analysis.js.
- Bumped GROQ_CACHE_KEY to mula_groq_analysis_v108 to purge old cached payload.
- Bumped version tags to v109 across index.html, mula-sw-register.js (mula-v109), MainActivity.kt (APP_WEB_VERSION=109).

### 2026-07-27 - Removed LLM, Auto-render Analysis v110

- Rewrote 08-ai-analysis.js: stripped all Groq API calls, buildGroqPrompt, callGroq, localStorage cache logic.
- Analysis now auto-runs on Keuangan tab open via ensureGroqBtn() calling runAnalysis() immediately.
- Kept: gatherAnalysisData() (90-day history + weekly + monthly from Firebase), buildProfessionalMonthlyForecastSVG, buildProfessionalWeeklyChartSVG, buildFinancialKpiHTML, buildMenuSummaryHTML.
- Button changed to 'Refresh Analisis' for manual re-fetch only.
- Bumped v110 across index.html, mula-sw-register.js, MainActivity.kt.

### 2026-07-28 - Menu Summary Period Tabs v111

- Added Hari Ini / Minggu Ini / Bulan Ini toggle tabs to menu summary in 08-ai-analysis.js.
- gatherAnalysisData() now also aggregates weeklyItemMap and monthlyItemMap via _aggregateItems() during existing Firebase fetches.
- todayItemMap reads from in-memory dailyOrders.
- All 3 maps stored in _menuMaps global; switchMenuPeriod(period) swaps the list in-place with no extra Firebase calls.
- Bumped to v111 across index.html, mula-sw-register.js, MainActivity.kt.

### 2026-08-03 - Persistent menu month and forecast layering v117

- Rangkuman Menu Terjual now caches monthly item maps by explicit YYYY-MM keys, so changing Hari Ini / Minggu Ini / Bulan Ini does not fall back to the current month.
- Monthly forecast now draws subdued Optimistic, Realistic, and Conservative scenario lines behind a thicker actual-income line; the scenarios remain static against the selected calendar month.
- Cache markers bumped to v117 across index.html, mula-sw-register.js, and Android APP_WEB_VERSION.
- Verification: browser JS syntax checks passed for the changed analytics and dashboard/state scripts.

### 2026-08-06 - Order handoff performance pass v118

- Cashier and guest payment handoffs now use one atomic multi-location RTDB update for finance plus kitchen records, while retaining local optimistic state and offline queue recovery.
- Staff table listeners now query active, waiting-verification, and paid statuses separately instead of downloading the full `tableOrders` tree on every client.
- Table-driven panel rerenders are batched into one animation frame, and offline retries use bounded exponential backoff metadata.
- Cache markers bumped to v118. Changes are local only and intentionally not deployed yet.

### 2026-08-06 - Local-first outbox efficiency pass v119

- Added an IndexedDB-backed order outbox with localStorage fallback, legacy queue migration, retry metadata, and bounded backoff.
- Cashier, guest-payment, and kitchen-completion queue paths now use the shared outbox helpers; sync status now exposes accessible connection titles.
- Cache markers bumped to v119. Changes remain local and intentionally not deployed.

### 2026-08-06 - Today-only order guard v120

- Historical dates remain viewable for reporting, but cashier quantity controls, notes, checkout submission, and manual order writes are blocked unless `curDate` is today.
- Changing the date clears the active cashier cart and shows a read-only history notice for non-current dates.
- Cache markers bumped to v120. Changes remain local and intentionally not deployed.

### 2026-08-09 - Normalized Keuangan analytics

- Keuangan analytics now uses one read-only normalized daily dataset from valid `orders/{YYYY-MM-DD}` transactions, keeps receipt expenses separate, and uses prior-month-only trimmed forecast patterns with confidence labeling. Changes remain local and intentionally not deployed.

### 2026-09-06 - Public /order seating map local implementation

- Added the local `/order` guest flow with an interactive two-floor map based on the provided diagrams. Floor 2 starts with Meja 21 and includes Meja 21–28; floor 1 retains Meja 1–20.
- Added shared `tableLocks/{tableId}` claims for guest and cashier table orders, with owner-only replacement/removal rules and release on completion, cancellation, or clearing.
- Cache markers are aligned to v134. Changes are local only; deployment was intentionally not run.
### 2026-09-06 - Physical table list narrowed locally

- Updated the available seating list to floor 1 Meja 1–8 and floor 2 Meja 21–28 across guest selection, cashier destinations, QR links, URL validation, and locks.
- Cache markers aligned to v135. Changes remain local; deployment was not run.
### 2026-09-06 - Table map visual cleanup

- Refined the public order table map with clearer floor controls, improved table targets/status cues, diagram spacing, and a responsive mobile grid fallback.
- Cache markers aligned to v137. Changes remain local; deployment was not run.
### 2026-09-06 - Seating map layout correction

- Removed the map grid texture, removed Meja 8 from the available seating set, and repositioned/enlarged the two Bulan fixtures to match the floor-plan reference.
- Cache markers aligned to v138. Changes remain local; deployment was not run.
### 2026-09-06 - Final seating map correction

- Removed obsolete table-name entries, removed Meja 8 from the selectable set, removed the map grid background, and aligned Bulan placement/scale with the floor-plan reference.
- Cache markers aligned to v139. Changes remain local; deployment was not run.
### 2026-09-06 - Bulan wall anchoring correction

- Anchored the first enlarged Bulan fixture to the left wall beside Meja 1 and the second to the upper wall above Meja 3–5.
- Cache markers aligned to v140. Changes remain local; deployment was not run.
### 2026-09-06 - Final map spacing polish

- Tuned floor-map table spacing to prevent card collisions, improved the selection instruction, and adjusted floor-specific table widths for a cleaner diagram on desktop and mobile.
- Cache markers aligned to v141. Changes remain local; deployment was not run.
### 2026-09-06 - Seating landmark polish

- Equalized horizontal table spacing and changed Bulan from square blocks into softer ornamental circular/oval photo landmarks while retaining wall placement.
- Cache markers aligned to v142. Changes remain local; deployment was not run.
### 2026-09-06 - Ornamental marker syntax correction

- Corrected the Bulan ornament marker styling after validation and aligned local cache markers to v143.
- Changes remain local; deployment was not run.
### 2026-09-06 - Bulan wall spacing correction

- Moved the Bulan fixtures fully into their wall zones and added clear separation from nearby tables.
- Cache markers aligned to v144. Changes remain local; deployment was not run.
### 2026-09-06 - Map collision and divider cleanup

- Removed the center divider line and corrected the left Bulan marker minimum width so it stays separated from Meja 1.
- Cache markers aligned to v145. Changes remain local; deployment was not run.
### 2026-09-06 - Final Bulan spacing cleanup

- Disabled the map center divider and moved both Bulan fixtures farther into their wall zones so neither touches a table.
- Cache markers aligned to v146. Changes remain local; deployment was not run.
### 2026-09-06 - Bulan landmarks removed

- Removed both Bulan fixtures from the interactive seating map and deleted their unused map styling.
- Cache markers aligned to v147. Changes remain local; deployment was not run.

### 2026-09-06 - Floor 2 wall alignment correction

- Aligned floor-2 Kaca and Pintu to the same right-wall anchor and moved floor-2 AC inward so it remains inside the map frame on narrow screens.
- Cache markers aligned to v148. Changes remain local; deployment was not run.

### 2026-09-06 - Floor 2 Tangga and AC separation

- Centered and narrowed the floor-2 Tangga landmark so it no longer reaches the AC zone.
- Cache markers aligned to v149. No deployment was run for this change.

### 2026-09-06 - v149 deployment

- Deployed the floor-2 Tangga/AC spacing correction to Firebase Hosting and Realtime Database rules.
- Live verification returned HTTP 200 and confirmed the public order route serves v149 assets.

### 2026-09-06 - Mobile seating map layout

- Added mobile-specific floor-map spacing: compact four-column table grid, reserved top/bottom wall zones, non-overlapping landmark anchors, and a wrapped picker header.
- Cache markers aligned to v150. Changes remain local; deployment was not run.

### 2026-09-06 - Mobile map coordinates preserved

- Removed the mobile table-grid reflow so floor maps retain the same absolute table and landmark positions as desktop while scaling controls to fit smaller screens.
- Cache markers aligned to v151. Changes remain local; deployment was not run.

### 2026-09-06 - v151 mobile map deployment

- Deployed the fixed-coordinate mobile seating map to Firebase Hosting and Realtime Database rules.
- Live verification returned HTTP 200, v151 assets, and confirmed the old mobile grid reflow is absent.

### 2026-09-06 - Multi-table guest seating

- Guest /order now supports selecting multiple free tables before continuing to the menu, stores one group order with 	ableIds, locks every selected table, and releases all locks when the cashier clears or completes the order.
- Added selected-table summary/continue UI and kept the existing single-table QR route compatible.
- Cache markers aligned to v154. Changes remain local; deployment was not run.

### 2026-09-06 - Map frame cleanup

- Removed the inner square border from the interactive seating map, leaving a single clean outer frame.
- Cache markers aligned to v155. Changes remain local; deployment was not run.

### 2026-09-06 - v155 map cleanup deployment

- Deployed the single-frame map cleanup to Firebase Hosting and Realtime Database rules.
- Live verification returned HTTP 200 and confirmed v155 plus the inner-border removal.

### 2026-09-06 - Served versus cleared table lifecycle

- Kitchen “Tandai Disajikan” now records the order as served while keeping the table occupied and all selected-table locks active.
- Cashier clears the table separately with “Kosongkan Meja” only after customers leave; served state is included in Firebase subscriptions, offline sync, and the guest view.
- Cache markers aligned to v156. Changes remain local; deployment was not run.
### 2026-09-06 - Admin manage-mode table map

- Restored the kitchen action label to “Selesai Semua” for serving all items without releasing the table.
- Added an Admin-only Mode Kelola floor map using the fixed Lantai 1 and Lantai 2 coordinates; served tables can be clicked to become “Tersedia”, while active/locked tables remain protected.
- Added live table-lock awareness and aligned cache markers to v157. Changes remain local; deployment was not run.
### 2026-09-06 - v157 admin map deployment

- Deployed the customer /order seating flow and Admin Mode Kelola floor map with served-versus-available table handling to Firebase Hosting and Realtime Database rules.
- Live verification returned HTTP 200 and confirmed v157 assets plus the served lifecycle/map controls.
### 2026-09-06 - Mobile map tap handling

- Added touch/pointer interaction support with duplicate-event protection for customer table selection and Admin Mode Kelola table clearing; table coordinates remain unchanged.
- Added mobile tap affordance CSS and aligned cache markers to v158. Changes remain local; deployment was not run.
### 2026-09-06 - Save/Selesai regression repair

- Removed an undefined `bindServedTableControls(panel)` call from `renderActiveTables`; it was throwing before the kitchen Save/Selesai listeners could bind.
- Compared against the tracked GitHub baseline and kept the served-versus-cleared table lifecycle intact. Local cache markers aligned to v159; deployment was not run.
### 2026-09-06 - v160 cashier order visibility deployment

- Guest orders were reaching Firebase, but an undefined `bindServedTableControls` call could throw during active-table rendering and prevent later cashier panels from rendering.
- Removed that call, corrected duplicated multi-table labels, aligned assets to v160, and deployed Hosting plus Realtime Database rules.
- Live verification returned HTTP 200 and confirmed the public dashboard/guest assets contain the repaired flow.
### 2026-09-06 - GitHub v129 rollback deployment

- Deployed the exact tracked upstream `origin/agent/v129-updater` commit `ece981b` as a rollback, staged separately so the dirty local worktree was preserved.
- Live verification returned HTTP 200 and confirmed v129 assets without the newer map/touch changes. Temporary staging was removed after deployment.
### 2026-09-06 - v129-based /order and Mode Kelola rebuild (local)

- Rebuilt the customer `/order` route and cashier Mode Kelola floor map from the tracked v129 baseline.
- Kept `assets/js/03-app-state.js`, `assets/js/06-checkout.js`, and `database.rules.json` byte-equivalent to v129; legacy `/tableX` payload shape remains unchanged.
- Added only `/order` multi-table metadata (`tableId`/`tableIds`) and occupancy checks, with the existing order status pipeline preserved.
- Removed the map’s inner frame artifact and cleaned the tracked index HTML closing fragment. Cache markers aligned to v161. Changes remain local; deployment was not run.
### 2026-09-06 - Direct public seating and manual-DM verification deployed v163

- Restored `/order` as a directly shareable customer page: guests choose one or more available physical tables, select menu items, confirm that transfer proof was sent through MULA DM, then submit.
- Each selected table is claimed only at final submission with anonymous Firebase authentication and an owner-bound 24-hour reservation. Guests cannot overwrite another active claim; staff-only data remains protected.
- Submitted public orders enter `waiting_verification`; staff confirms payment before the existing kitchen pipeline receives an `active` order. Kitchen completion now marks an order `served` while retaining the table; Admin Mode Kelola clears it only after the customers leave. Admin can also cancel an unverified transfer to release its tables.
- Removed the staff-generated guest-session-link gate. Added status query indexing and restricted finance, kitchen history, receipts, and retired guest-session data to password-authenticated staff.
- Cache markers aligned to v163. `npm.cmd run check` passed and `npm.cmd run deploy` successfully released Firebase Hosting and Realtime Database rules.
### 2026-09-07 - Customer name and menu search repair deployed v164

- Public table orders now require a customer name for transfer-proof verification and preserve it through the cashier verification prompt, kitchen card, finance history, and receipt print.
- Restored the category-grid menu search filter from the GitHub v129 baseline, fixing cashier menu search and clear-search behavior after re-renders.
- Cache markers aligned to v164. `npm.cmd run check` passed and `npm.cmd run deploy` successfully released Firebase Hosting and Realtime Database rules. No interactive order test was run at the user's request.
### 2026-09-07 - Manual cashier customer-name modal deployed v165

- Added the missing optional **Nama Pelanggan** input to the manual cashier confirmation modal (between Tujuan Order and payment), matching the cashier screen rather than only the public `/order` path.
- Manual cashier orders now carry the entered name through finance, the active kitchen order, and receipt printing without changing the payment, destination, or offline-order pipeline.
- Cache markers aligned to v165. `npm.cmd run check` passed and Firebase Hosting plus Realtime Database rules deployed successfully. No interactive order test was run at the user's request.
### 2026-09-07 - Customer name labels deployed v167

- Manual cashier `customerName` is now visibly labeled `Atas nama:` in the Meja Aktif kitchen panel.
- Thermal and browser receipts now print `Pelanggan: <name>` when a name was entered; cashier/order payload and payment pipeline were unchanged.
- Cache markers aligned to v167. `npm.cmd run check` passed. Hosting-only deployment succeeded from a clean 16-file staging directory, excluding unrelated local exports, receipts, APKs, and database rules. Live v167 verification passed.
### 2026-09-07 - QR assets generated

- Generated local QR PNGs for the general /order page and fixed routes /table1–/table7, /table21–/table28. Added a labeled printable sheet at qr-codes-v167/MULA-QR-Sheet.html; these files were not deployed.

### 2026-09-07 - Individual QR PNG assets generated

- Created 16 standalone labeled PNG cards for General Order and Meja 1-7/21-28 at 1181x1181 px, 300 DPI, representing exact 10x10 cm print size. Added a ZIP bundle for designer handoff; no hosting deploy was made.

### 2026-09-14 - Role-enforced finance protection v168 (not deployed)

- Replaced client-selected staff roles with the Firebase Auth custom claim `mula_role: 'admin'`; every account without that claim is Karyawan and is denied if it chooses the Admin button.
- Realtime Database rules now allow only claimed admins to read or alter finance orders, receipts, receipt images, price overrides, stock, and menu administration. Password-authenticated staff may only create a recent, audit-tagged finance transaction; they cannot read, change, or delete it.
- Added `Pengaturan` with adjustable notification volume, a sound test, and `Refresh Terbaru`, which refreshes the Firebase token, updates/unregisters service workers, clears MULA cache storage, and reloads with a cache-busting URL.
- Cache markers are aligned at v168. `npm run check` passed. No deployment was run.

### 2026-09-15 - v168 security patch deployed

- Bound the configured admin account `admin@mula.com` to the Admin role in both client role resolution and Realtime Database rules; other password-authenticated accounts remain Karyawan unless they carry the explicit `mula_role: 'admin'` claim.
- Deployed with `npm run deploy` to Firebase Hosting and Realtime Database. Rules syntax validation and release both succeeded.
- Live verification returned HTTP 200 and confirmed v168 assets, the Settings control, admin binding, and force-refresh code.

### 2026-09-15 - Bungkus display wording v169

- Changed the visible manual-order destination, finance type badge/analysis label, dashboard order labels, and printed receipt label from Takeaway/Kasir to Bungkus.
- Preserved internal order values (`takeaway`, `kasir`, `KASIR-` IDs, and stored legacy table labels) so existing data and logic remain compatible.
- Cache markers aligned to v169. `npm run check` passed before deployment.

### 2026-09-15 - v169 Bungkus wording deployed

- Deployed the display/printing-only Bungkus wording patch to Firebase Hosting and Realtime Database with `npm run deploy`.
- Live verification returned HTTP 200, v169 assets, visible Bungkus text, preserved internal `takeaway` and `Takeaway / Kasir` values, and print normalization.

### 2026-09-15 - Manual order modal layout v170

- Changed the checkout summary destination choices to a responsive, non-scrollable grid and added bottom spacing/display-block sizing to the customer-name field so it stays clear of the payment panel.
- Cache markers aligned to v170. npm run check passed. No deployment was run.
### 2026-09-15 - v170 modal layout deployed

- Deployed the responsive, non-scrollable Meja grid and corrected Nama Pelanggan spacing to Firebase Hosting and Realtime Database.
- Live verification returned HTTP 200 with v170 asset references and both modal CSS rules present.
### 2026-09-16 - Guest cashier checkout and menu search (local)

- Guest table ordering now filters menu cards with a live search field.
- Customer name is required in the post-menu review step, and submitted orders instruct customers to pay manually at the cashier.
- Guest payloads mark paymentAtCashier; cashier pending-payment labels preserve legacy DM-transfer wording for older orders.
- Cache markers aligned to v171. Changes remain local; deployment was not run.
### 2026-09-16 - v171 guest cashier checkout deployed

- Deployed the guest post-menu required-name checkout, live menu search, manual cashier-payment handoff, and aligned cache markers to Firebase Hosting and Realtime Database rules.
- 
pm run check passed and Firebase Hosting plus Realtime Database deployment completed successfully. No interactive order test was run at the user's request.
### 2026-09-16 - v172 sticky guest category sidebar deployed

- Moved the public guest menu categories into a black vertical sidebar on the left with sticky positioning; menu cards remain in the adjacent content column and narrow screens keep the sidebar compact.
- Cache markers aligned to v172. 
pm run check passed and Hosting plus Realtime Database deployment completed successfully. No interactive browser test was run at the user's request.
### 2026-09-16 - v173 sticky sidebar containment fix deployed

- Fixed the guest category sidebar not sticking by allowing the guest menu panel to expose sticky children instead of clipping them with overflow: hidden.
- Cache markers aligned to v173. 
pm run check passed and Hosting plus Realtime Database deployment completed successfully.

### 2026-09-16 - v174 sticky scroll-container and text-wrap fix deployed

- Live simulation found #guestView was becoming an overflow: hidden auto scroll container, preventing the left category rail from sticking to window scroll; v174 uses overflow: clip and wraps long menu names before the quantity controls.
- Cache markers aligned to v174. npm run check passed and Firebase Hosting plus Realtime Database deployment completed successfully.

### 2026-09-16 - v175 mobile menu readability and active category navigation deployed

- Mobile guest menu items now place the menu name and price above the thumbnail and quantity controls, preventing narrow-column overlap.
- Category chips receive an active highlight that follows the section nearest the viewport while scrolling and also updates immediately when a chip is tapped.
- Cache markers aligned to v175. npm run check passed; Firebase Hosting and Realtime Database deployment succeeded. Live 430px verification found grid layout, no name/control overlap, and Favorit→Makanan active-chip switching.
### 2026-09-16 - v176 repeat table ordering and cashier block/cancel flow

- Guest QR submissions no longer claim a table or treat previous orders as table occupancy. Each submission creates its own cashier/kitchen order, and the guest menu returns immediately so the same seated customer can order again.
- Cashier and admin staff can use Mode Kelola to toggle tableBlocks/{tableId}. Only a cashier/admin block prevents new QR orders; existing orders remain intact.
- Pending cashier payment rows show Batal for staff roles; cancelling removes only the unconfirmed accidental order before it enters kitchen/finance.
- Cache markers aligned to v176. npm run check passed. No interactive order test was run at the user's request.
### 2026-09-16 - v177 all-menu deletion deployed

- Admin Mode Kelola now shows a delete control for every menu, including built-in static menu items and custom menu items.
- Built-in deletions persist under menuDeletions and are filtered from both cashier and guest menus; custom deletions continue removing their custom record and components.
- Cache markers aligned to v177. npm run check passed. Firebase Hosting and Realtime Database deployment completed.
### 2026-09-16 - v178 Karyawan menu availability permission fix

- Added an individual menuAvailability/{itemId} rule for password-authenticated staff, requiring the new value to be boolean; this lets Karyawan mark items Habis/Tersedia without opening guest or arbitrary writes.
- Cache markers aligned to v178. npm run check passed. Firebase Hosting and Realtime Database deployment completed.
### 2026-09-16 - v179 daily menu-availability reset deployed

- Staff app resets menuAvailability once per calendar date through the shared menuAvailabilityMeta/resetDate marker, clearing all Habis flags in Firebase. A minute poll also handles an app left open across midnight.
- Cache markers aligned to v179. npm run check passed. Firebase Hosting and Realtime Database deployment completed.
### 2026-09-16 - v180 simple time-based guest greeting deployed

- Replaced the guest header's “Self checkout” and instruction-heavy copy with a simple greeting that changes by local time: Selamat pagi, Selamat siang, Selamat sore, or Selamat malam, followed by Selamat datang.
- Cache markers aligned to v180. npm run check passed. Firebase Hosting and Realtime Database deployment completed.
### 2026-09-16 - v181 guest menu header and sticky search deployed

- Removed the redundant guest “Pilih Menu / Pesan lagi…” header block.
- Made the guest search bar sticky at the top while scrolling, with the category rail positioned beneath it.
- Cache markers aligned to v181. npm run check passed. Firebase Hosting and Realtime Database deployment completed.
### 2026-09-17 - v182 pending payment menu list deployed

- Cashier pending payment rows now list each ordered menu item, quantity, and note so staff can reconfirm the order before confirming payment.
- Cache markers aligned to v182. npm run check passed. Firebase Hosting and Realtime Database deployment completed.
### 2026-09-17 - v183 editable pending payment menu list deployed

- Cashier pending-payment rows now let staff decrease or remove existing items, add another menu item, and see the recalculated total before confirming payment.
- Confirmed payment rows remain read-only. Cache markers aligned to v183. npm run check passed. Firebase Hosting and Realtime Database deployment completed.