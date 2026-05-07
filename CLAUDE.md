# MULA Eatery — Claude Memory

Project memory for the MULA restaurant POS/ordering app. Read this file first whenever starting work in this folder.

---

## Hosting & Deployment

- **Hosted on Firebase Hosting** (NOT Netlify — CLAUDE.md was outdated)
- Deploy command: `firebase deploy --only hosting`
- Firebase project: `mula-eatery` (region: `asia-southeast1`)
- Firebase RTDB: `https://mula-eatery-default-rtdb.asia-southeast1.firebasedatabase.app`
- Android cashier app loads `index.html` from Firebase Hosting URL via WebView
- Local dev server: `node server.js` (serves over LAN for local testing only)
- `DEMO_MODE = false` in code — always uses Firebase RTDB, not local demo state

---

## What this project is

A **no-build vanilla JS SPA** for an Indonesian restaurant called **MULA Eatery**. Uses Firebase Realtime Database (no framework). Indonesian language throughout.

- **No build step, no framework, no package.json dependency for the browser app.** `index.html` is now a thin shell that loads `assets/css/mula.css` and ordered classic scripts under `assets/js/`.
- PWA with service worker (cache `mula-v17`) + ESC/POS thermal printer support
- Android wrapper: `android-cashier/` — WebView app with native Bluetooth print bridge

---

## Current flow: Payment-First Self-Service (as of 2026-04-30)

### Guest flow (table orders)
1. Guest scans table QR → `https://<firebase-hosting-url>/?table=3`
2. Guest picks items, taps **"Pesan Sekarang"** → status = `pending_payment`
3. App shows payment screen — guest pays via physical QRIS sticker on table
4. Guest taps **"Konfirmasi Pesanan"** → status = `waiting_verification`
5. Admin hears beep, sees **"💳 Verifikasi Pembayaran"** panel
6. Admin taps **"✅ Konfirmasi Bayar"** → `konfirmasiBayar()`:
   - Merges items into `orders/{today}` (finance)
   - Auto-prints receipt via native bridge or BT fallback
   - Removes `tableOrders/${tableId}` after 6s
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
   - **✓ Selesai** → removes tableOrder from kitchen queue (finance already counted)

### Kitchen (Yang Dimasak)
- `getCookOrders()` aggregates: local cart `orders` variable + `tableOrders` with `status:'active'`
- `pending_payment` / `waiting_verification` table orders are EXCLUDED from kitchen
- Kitchen only sees confirmed/active orders

---

## Firebase data model

```
orders/{YYYY-MM-DD}/{pushId}    → {time, tableLabel, total, items: {itemId: {qty, note, tanpaNasi}}}
tableOrders/{tableId}           → {items, status, total, tableLabel, createdAt, dateKey, financeKey?, paidAt?}
   status: 'pending_payment' | 'waiting_verification' | 'paid' | 'active'
   'active' = manual kasir order in kitchen queue
   financeKey = push key in orders/{date} for reversal if cancelled
customMenu/{pushId}             → {id, name, price, cat}
customMenuComps/{itemId}        → {contribs: [...compIds], newRows: [...rowNames]}
priceOverrides/{itemId}         → number
menuAvailability/{itemId}       → boolean (true = out of stock)
stock/{stockId}                 → {name, jumlah, satuan}
receipts/{receiptId}            → {img, thumb, note, items, total, date, by}
```

- `TABLE_IDS = ['1'..'7']` (whitelist — URL param validated)
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
4. Test locally: `node server.js` → open `http://localhost:8080/` (staff) or `http://localhost:8080/?table=3` (guest)
5. **Deploy:** `firebase deploy --only hosting`
6. After deploy: reload Android WebView (Tools → Reload in cashier app)
7. Keep tight inline style (compact CSS/JS) — don't reformat existing code.
8. Indonesian language for all user-facing strings.
9. Always use `esc()` when inserting any user/DB data into innerHTML.

---

## History

### 2026-05-06 - Dashboard UI/UX Phase 2 continuation

- Continued Gemini/Antigravity Phase 2 dashboard work in `index.html`.
- Cashier order menu now has reusable category rail styling, stronger responsive grid rules, and section counts.
- `Mode Kelola` is wired: everyday cashier cards stay focused on ordering, while add/edit price/delete/availability actions are exposed from manage mode.
- Search filtering now works with the Phase 2 category grid DOM by hiding/showing `.menu-grid` sections instead of assuming a flat `.menu-item` list.
- `Rangkuman Order` now renders as a compact responsive summary grid.
- Follow-up polish added an `Order Aktif` strip above the menu, selected-card highlighting, quantity badges on category chips, and a one-tap `Kosongkan` cart action.
- Admin `Keuangan` now includes `Analisis Operasional`: local daily insights for top items, average basket, dine-in/kasir mix, payment mix, margin notes, and stale-order signals.
- Verified inline script parsing and a bounded `jsdom` smoke test for menu grids, manage toggle, availability controls, and search filtering.
- 2026-05-07 deploy: hosting deployed successfully to `https://mula-eatery.web.app`; functions deploy failed because project `mula-eatery` is not on Firebase Blaze, so `cloudbuild.googleapis.com` / `artifactregistry.googleapis.com` cannot be enabled yet.
- 2026-05-07 follow-up: Gemini was removed by request. Admin analytics is local-only in `index.html`; `functions.analyzeMulaData` and Gemini API calls were removed from source. Hosting was redeployed successfully.
- 2026-05-07 refactor: monolithic `index.html` split into `assets/css/mula.css` plus ordered classic scripts `assets/js/01-platform.js` through `07-guest-view.js`; service worker cache bumped to `mula-v17`; `package.json` pkg assets now include `assets/**/*`; `assets/README.md` documents the layout. Behavior should remain unchanged.
- 2026-05-07 bugfix: mixed `tanpa nasi` orders now support split quantities on a single menu item. Order data uses `tanpaNasiQty` instead of a single all-or-nothing flag, and the cashier UI, guest UI, finance strings, print flow, and Firebase normalization were updated to preserve combinations like `2 nasi + 2 tanpa nasi` for the same menu.
- 2026-05-07 deploy: hosting redeployed successfully after the `tanpaNasiQty` split-order fix. Live URL remains `https://mula-eatery.web.app`.

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
