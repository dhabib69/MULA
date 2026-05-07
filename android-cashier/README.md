# MULA Cashier Android Bridge

Native Android cashier shell that loads the existing MULA web UI in a `WebView` and exposes:

- `window.MulaPrinter.printBase64(base64Receipt)`

The web app still builds the ESC/POS bytes in `index.html`. The Android bridge only handles classic Bluetooth SPP printing for RP022N / RPP02N style printers.

## What this solves

`RP022N`-style printers often work through Android apps but not through Chrome Web Bluetooth because the browser path is BLE/GATT while many thermal printers expose classic Bluetooth SPP. This wrapper keeps the existing MULA web UI but gives it a native Android bridge for raw ESC/POS bytes.

## Build

1. Open `android-cashier` in Android Studio.
2. Let Gradle sync.
3. Pair the printer in Android settings first.
4. Run the app on the cashier phone.
5. Tap `URL` and set the cashier page URL, for example:
   - `http://192.168.1.12:8080/`
   - or your future HTTPS deployment
6. Tap `Printer` and choose the already-paired RP022N device.
7. Use the existing `Print` flow from the cashier page.

## Notes

- This is the cashier/staff app only.
- Guest flow stays in the browser.
- If your printer name differs, adjust `findTargetDevice()` in `PrinterBridge.kt`.
- The app allows cleartext HTTP so it can load the current LAN demo URL.
- Pair the printer in Android settings first; the bridge uses paired-device lookup, not browser discovery.
- The wrapper persists the chosen printer MAC address and shows its status above the WebView.
- When running inside this Android shell, the web app now treats printing as native-only and surfaces printer errors instead of silently falling back to browser print preview.
