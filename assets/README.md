# MULA Frontend Asset Layout

The browser app is still a no-build vanilla JavaScript SPA. Files are loaded in order from `index.html`.

## CSS

- `css/mula.css` - all application styles, including guest view, cashier dashboard, admin finance, printing, and responsive rules.

## JavaScript Load Order

1. `js/01-platform.js` - Firebase setup, demo adapter, theme, shared browser helpers.
2. `js/02-menu-data.js` - static menu catalog and ingredient/component definitions.
3. `js/03-app-state.js` - shared state, auth, tabs, Firebase subscriptions, stock/receipt wiring.
4. `js/04-dashboard.js` - cashier ordering, admin finance analytics, active table/payment panels.
5. `js/05-printing.js` - native Android print bridge, Web Bluetooth, browser print fallback, ESC/POS receipt generation.
6. `js/06-checkout.js` - manual cashier checkout modal, offline queue writes, menu search/manage events.
7. `js/07-guest-view.js` - QR modal handlers and guest table ordering flow.
8. `js/mula-sw-register.js` - service worker registration and cache asset list.

These are classic scripts, not ES modules. Keep shared app-level declarations as `var` globals unless the whole app is moved to modules in one deliberate migration.
