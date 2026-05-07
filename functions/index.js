const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const crypto = require("crypto");

if (!admin.apps.length) admin.initializeApp();
const db = admin.database();

const TABLE_IDS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const NASI_PRICE = 5000;
const NASI_IDS = new Set(["beef_yakiniku", "tongseng_sapi", "ayam_kremes_lmg", "ayam_kremes_ijo", "ayam_geprek", "ayam_bakar", "lele_kremes_lmg", "lele_kremes_ijo", "nila_kremes_lmg", "nila_kremes_ijo", "soto_padang", "udang_saus"]);
const DEF_FAVORITES = [
  { id: "es_durian_mula", name: "Es Durian Mula", price: 18000, cat: "favorites" },
  { id: "es_teler_mula", name: "Es Teler Mula", price: 18000, cat: "favorites" },
  { id: "es_teler_durian_mula", name: "Es Teler Durian Mula", price: 23000, cat: "favorites" },
  { id: "es_teler_durian_premium", name: "Es Teler Durian Premium", price: 30000, cat: "favorites" }
];
const DEF_DRINKS = [
  { id: "kopi_susu_mula", name: "Kopi Susu Mula", price: 22000, cat: "drinks" },
  { id: "kopi_milo_cream", name: "Kopi Milo Cream", price: 25000, cat: "drinks" },
  { id: "americano", name: "Americano", price: 18000, cat: "drinks" },
  { id: "sanger", name: "Sanger", price: 18000, cat: "drinks" },
  { id: "matcha_latte", name: "Matcha Latte", price: 22000, cat: "drinks" },
  { id: "matcha_strawberry", name: "Matcha Strawberry", price: 25000, cat: "drinks" },
  { id: "mula_choco_dream", name: "Mula Choco Dream", price: 20000, cat: "drinks" },
  { id: "yakult_lychee", name: "Yakult Lychee", price: 18000, cat: "drinks" },
  { id: "melon_squash", name: "Melon Squash", price: 15000, cat: "drinks" },
  { id: "lemon_squash", name: "Lemon Squash", price: 15000, cat: "drinks" },
  { id: "es_jeruk_peras", name: "Es Jeruk Peras", price: 15000, cat: "drinks" },
  { id: "iced_lemon_tea", name: "Iced Lemon Tea", price: 10000, cat: "drinks" },
  { id: "iced_tea", name: "Iced Tea", price: 8000, cat: "drinks" },
  { id: "air_mineral", name: "Air Mineral", price: 5000, cat: "drinks" }
];
const DEF_MAIN = [
  { id: "beef_yakiniku", name: "Beef Yakiniku", price: 30000, cat: "main" }, { id: "tongseng_sapi", name: "Tongseng Daging Sapi", price: 35000, cat: "main" },
  { id: "ayam_kremes_lmg", name: "Ayam Kremes Lamongan", price: 25000, cat: "main" }, { id: "ayam_kremes_ijo", name: "Ayam Kremes Ijo", price: 25000, cat: "main" },
  { id: "ayam_geprek", name: "Ayam Geprek", price: 25000, cat: "main" }, { id: "ayam_bakar", name: "Ayam Bakar Pedas Manis", price: 28000, cat: "main" },
  { id: "lele_kremes_lmg", name: "Lele Kremes Lamongan", price: 25000, cat: "main" }, { id: "lele_kremes_ijo", name: "Lele Kremes Ijo", price: 25000, cat: "main" },
  { id: "nila_kremes_lmg", name: "Nila Kremes Lamongan", price: 28000, cat: "main" }, { id: "nila_kremes_ijo", name: "Nila Kremes Ijo", price: 28000, cat: "main" },
  { id: "soto_padang", name: "Soto Padang", price: 30000, cat: "main" }, { id: "udang_daun_jeruk", name: "Udang Krispi Nasi Daun Jeruk", price: 30000, cat: "main" },
  { id: "udang_saus", name: "Udang Krispi Saus Pedas Manis", price: 30000, cat: "main" }, { id: "seblak_seafood", name: "Seblak Seafood", price: 25000, cat: "main" },
  { id: "tumis_toge", name: "Tumis Toge", price: 10000, cat: "main" }, { id: "nasi_goreng_telur", name: "Nasi Goreng Telur", price: 22000, cat: "main" },
  { id: "nasi_goreng_ayam", name: "Nasi Goreng Ayam", price: 25000, cat: "main" }, { id: "nasi_goreng_seafood", name: "Nasi Goreng Seafood", price: 27000, cat: "main" },
  { id: "nasi_hijau_telur", name: "Nasi Goreng Hijau Telur", price: 22000, cat: "main" }, { id: "nasi_hijau_ayam", name: "Nasi Goreng Hijau Ayam", price: 25000, cat: "main" },
  { id: "nasi_hijau_seafood", name: "Nasi Goreng Hijau Seafood", price: 27000, cat: "main" }, { id: "kwetiau_telur", name: "Kwetiau Goreng Telur", price: 20000, cat: "main" },
  { id: "kwetiau_ayam", name: "Kwetiau Goreng Ayam", price: 25000, cat: "main" }, { id: "kwetiau_seafood", name: "Kwetiau Goreng Seafood", price: 27000, cat: "main" },
  { id: "bihun_telur", name: "Bihun Goreng Telur", price: 20000, cat: "main" }, { id: "bihun_ayam", name: "Bihun Goreng Ayam", price: 25000, cat: "main" },
  { id: "bihun_seafood", name: "Bihun Goreng Seafood", price: 27000, cat: "main" }, { id: "mie_telur", name: "Mie Goreng Telur", price: 20000, cat: "main" },
  { id: "mie_ayam", name: "Mie Goreng Ayam", price: 25000, cat: "main" }, { id: "mie_seafood", name: "Mie Goreng Seafood", price: 27000, cat: "main" }
];
const DEF_DESSERT = [
  { id: "risol", name: "Risol", price: 15000, cat: "dessert" }, { id: "pergedel", name: "Pergedel Jagung", price: 15000, cat: "dessert" },
  { id: "kentang", name: "Kentang Goreng", price: 15000, cat: "dessert" }, { id: "bakwan", name: "Bakwan", price: 15000, cat: "dessert" },
  { id: "sosis", name: "Sosis", price: 15000, cat: "dessert" }, { id: "roti_nutella", name: "Roti Bakar Nutella Milo", price: 20000, cat: "dessert" },
  { id: "roti_keju_eskrim", name: "Roti Bakar Keju Eskrim", price: 22000, cat: "dessert" }, { id: "pisang_keju", name: "Pisang Bakar Keju", price: 20000, cat: "dessert" },
  { id: "pisang_coklat", name: "Pisang Bakar Coklat", price: 18000, cat: "dessert" }, { id: "pisang_coklat_keju", name: "Pisang Bakar Coklat Keju", price: 23000, cat: "dessert" },
  { id: "pisang_gula", name: "Pisang Gula Aren", price: 20000, cat: "dessert" }, { id: "tahu_sutra", name: "Tahu Sutra", price: 15000, cat: "dessert" }
];
const DEF_TAMBAHAN = [
  { id: "sambal_lmg_extra", name: "Sambal Lamongan", price: 5000, cat: "tambahan" },
  { id: "sambal_ijo_extra", name: "Sambal Ijo", price: 5000, cat: "tambahan" },
  { id: "sambal_gpk_extra", name: "Sambal Geprek", price: 5000, cat: "tambahan" }
];

function cors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function cfg(name, fallback = "") {
  return process.env[name] || fallback;
}

function dateKey(now = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(now));
}

async function buildMenuLookup() {
  const [customSnap, priceSnap] = await Promise.all([db.ref("customMenu").get(), db.ref("priceOverrides").get()]);
  const customMenu = Object.values(customSnap.val() || {});
  const prices = priceSnap.val() || {};
  const all = [...DEF_FAVORITES, ...DEF_DRINKS, ...DEF_MAIN, ...DEF_DESSERT, ...DEF_TAMBAHAN, ...customMenu].map((item) => ({
    ...item,
    price: prices[item.id] || item.price
  }));
  return Object.fromEntries(all.map((item) => [item.id, item]));
}

function normalizeItems(rawItems, menuLookup) {
  const merged = {};
  const itemDetails = [];
  let total = 0;
  for (const raw of Array.isArray(rawItems) ? rawItems : []) {
    const id = String(raw?.id || "").trim();
    const qty = Math.max(0, parseInt(raw?.qty || 0, 10));
    if (!id || !qty) continue;
    const item = menuLookup[id];
    if (!item) throw new Error(`Menu tidak dikenal: ${id}`);
    if (qty > 50) throw new Error(`Qty terlalu besar untuk ${item.name}`);
    const note = String(raw?.note || "").trim().slice(0, 160);
    const tanpaNasiQtyRaw = raw?.tanpaNasiQty;
    const tanpaNasiQty = Math.min(qty, Math.max(0, parseInt(tanpaNasiQtyRaw === undefined ? (raw?.tanpaNasi ? qty : 0) : tanpaNasiQtyRaw, 10) || 0));
    if (!merged[id]) merged[id] = { qty: 0, note: "", tanpaNasiQty: 0, tanpaNasi: false };
    merged[id].qty += qty;
    merged[id].note = note || merged[id].note || "";
    merged[id].tanpaNasiQty += tanpaNasiQty;
    merged[id].tanpaNasi = merged[id].tanpaNasiQty >= merged[id].qty;
    total += (qty - tanpaNasiQty) * item.price;
    total += tanpaNasiQty * (NASI_IDS.has(id) ? item.price - NASI_PRICE : item.price);
  }
  Object.entries(merged).forEach(([id, data]) => {
    const item = menuLookup[id];
    const tanpaNasiQty = Math.min(data.qty, Math.max(0, data.tanpaNasiQty || 0));
    const denganNasiQty = Math.max(0, data.qty - tanpaNasiQty);
    if (denganNasiQty) itemDetails.push({ id, price: item.price, quantity: denganNasiQty, name: item.name });
    if (tanpaNasiQty) itemDetails.push({ id, price: NASI_IDS.has(id) ? item.price - NASI_PRICE : item.price, quantity: tanpaNasiQty, name: `${item.name} (tanpa nasi)` });
  });
  if (!itemDetails.length) throw new Error("Keranjang kosong");
  return { merged, itemDetails, total };
}

async function mergeItemsIntoDaily(dateKeyValue, items) {
  const snap = await db.ref(`orders/${dateKeyValue}`).get();
  const daily = snap.val() || {};
  const updates = {};
  Object.entries(items || {}).forEach(([id, data]) => {
    if ((data.qty || 0) <= 0) return;
    const nextTanpaNasiQty = Math.max(0, parseInt(data.tanpaNasiQty === undefined ? (data.tanpaNasi ? data.qty : 0) : data.tanpaNasiQty, 10) || 0);
    const prevTanpaNasiQty = Math.max(0, parseInt(daily[id]?.tanpaNasiQty === undefined ? (daily[id]?.tanpaNasi ? daily[id]?.qty || 0 : 0) : daily[id]?.tanpaNasiQty, 10) || 0);
    const qty = (daily[id]?.qty || 0) + (data.qty || 0);
    const tanpaNasiQty = prevTanpaNasiQty + nextTanpaNasiQty;
    updates[id] = {
      qty,
      note: data.note || daily[id]?.note || "",
      tanpaNasiQty,
      tanpaNasi: qty > 0 && tanpaNasiQty >= qty
    };
  });
  if (Object.keys(updates).length) await db.ref(`orders/${dateKeyValue}`).update(updates);
}

function paymentSnapshot(tableOrder) {
  return {
    tableLabel: tableOrder.tableLabel,
    status: tableOrder.status,
    total: tableOrder.total,
    createdAt: tableOrder.createdAt,
    paidAt: tableOrder.paidAt || null,
    dateKey: tableOrder.dateKey,
    items: tableOrder.items,
    payment: {
      provider: tableOrder.payment?.provider || "midtrans",
      status: tableOrder.payment?.status || "pending",
      orderId: tableOrder.payment?.orderId || null,
      qrUrl: tableOrder.payment?.qrUrl || null,
      qrString: tableOrder.payment?.qrString || null,
      acquirer: tableOrder.payment?.acquirer || null,
      expiresAt: tableOrder.payment?.expiresAt || null
    }
  };
}

async function createMidtransCharge(serverKey, payload, isProduction) {
  const auth = Buffer.from(`${serverKey}:`).toString("base64");
  const baseUrl = isProduction ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
  const res = await fetch(`${baseUrl}/v2/charge`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.error("Midtrans create charge failed", { status: res.status, data });
    throw new Error(data.status_message || "Midtrans charge gagal dibuat");
  }
  return data;
}

exports.createMidtransQris = onRequest({ region: "asia-southeast1" }, async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const tableId = String(req.body?.tableId || "").trim();
    if (!TABLE_IDS.includes(tableId)) return res.status(400).json({ error: "Table tidak valid" });
    const existingSnap = await db.ref(`tableOrders/${tableId}`).get();
    const existing = existingSnap.val();
    if (existing && ["pending_payment", "paid"].includes(existing.status)) {
      return res.status(409).json({ error: "Masih ada pembayaran aktif di meja ini" });
    }
    const menuLookup = await buildMenuLookup();
    const normalized = normalizeItems(req.body?.items, menuLookup);
    const createdAt = Date.now();
    const orderId = `MULA-T${tableId}-${createdAt}`;
    const serverKey = cfg("MIDTRANS_SERVER_KEY");
    const env = cfg("MIDTRANS_ENV", "sandbox").toLowerCase();
    const acquirer = cfg("MIDTRANS_QRIS_ACQUIRER", "gopay");
    if (!serverKey) return res.status(500).json({ error: "MIDTRANS_SERVER_KEY belum diset" });
    const charge = await createMidtransCharge(serverKey, {
      payment_type: "qris",
      transaction_details: { order_id: orderId, gross_amount: normalized.total },
      qris: { acquirer },
      custom_expiry: { order_time: new Date(createdAt).toISOString(), expiry_duration: 15, unit: "minute" },
      item_details: normalized.itemDetails,
      customer_details: { first_name: `Meja ${tableId}` },
      metadata: { tableId, source: "mula-web" }
    }, env === "production");
    const actions = Array.isArray(charge.actions) ? charge.actions : [];
    const qrAction = actions.find((action) => String(action.name || "").toLowerCase().includes("qr") || String(action.url || "").toLowerCase().includes("qr"));
    const tableOrder = {
      tableId,
      tableLabel: `Meja ${tableId}`,
      status: "pending_payment",
      createdAt,
      updatedAt: createdAt,
      dateKey: dateKey(createdAt),
      total: normalized.total,
      items: normalized.merged,
      payment: {
        provider: "midtrans",
        mode: env,
        status: "pending",
        orderId,
        transactionId: charge.transaction_id || null,
        transactionStatus: charge.transaction_status || "pending",
        qrUrl: qrAction?.url || null,
        qrString: charge.qr_string || null,
        acquirer,
        expiresAt: charge.expiry_time ? Date.parse(charge.expiry_time) || null : null,
        grossAmount: normalized.total
      }
    };
    await db.ref(`tableOrders/${tableId}`).set(tableOrder);
    res.json({ ok: true, tableOrder: paymentSnapshot(tableOrder) });
  } catch (error) {
    logger.error("createMidtransQris failed", error);
    res.status(500).json({ error: error.message || "Gagal membuat QRIS" });
  }
});

exports.midtransWebhook = onRequest({ region: "asia-southeast1" }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  try {
    const body = req.body || {};
    const orderId = String(body.order_id || "");
    const statusCode = String(body.status_code || "");
    const grossAmount = String(body.gross_amount || "");
    const signature = String(body.signature_key || "");
    const serverKey = cfg("MIDTRANS_SERVER_KEY");
    if (!serverKey) return res.status(500).send("MIDTRANS_SERVER_KEY belum diset");
    const expected = crypto.createHash("sha512").update(orderId + statusCode + grossAmount + serverKey).digest("hex");
    if (expected !== signature) {
      logger.warn("Midtrans signature mismatch", { orderId });
      return res.status(403).send("Invalid signature");
    }
    const match = /^MULA-T(\d+)-/.exec(orderId);
    if (!match) return res.status(400).send("Unknown order id");
    const tableId = match[1];
    const ref = db.ref(`tableOrders/${tableId}`);
    const snap = await ref.get();
    const current = snap.val();
    if (!current || current.payment?.orderId !== orderId) return res.status(404).send("Order not found");
    const transactionStatus = String(body.transaction_status || "").toLowerCase();
    const paidAt = Date.now();
    if (["settlement", "capture"].includes(transactionStatus)) {
      if (!current.mergedAt) await mergeItemsIntoDaily(current.dateKey || dateKey(paidAt), current.items || {});
      await ref.update({
        status: "paid",
        paidAt,
        mergedAt: current.mergedAt || paidAt,
        updatedAt: paidAt,
        payment: {
          ...(current.payment || {}),
          status: "settlement",
          transactionStatus,
          transactionId: body.transaction_id || current.payment?.transactionId || null,
          notifiedAt: paidAt,
          settlementTime: body.settlement_time || null
        }
      });
    } else if (transactionStatus === "pending") {
      await ref.update({
        status: "pending_payment",
        updatedAt: paidAt,
        payment: { ...(current.payment || {}), status: "pending", transactionStatus, notifiedAt: paidAt }
      });
    } else if (transactionStatus === "expire") {
      await ref.update({
        status: "expired",
        updatedAt: paidAt,
        payment: { ...(current.payment || {}), status: "expired", transactionStatus, notifiedAt: paidAt }
      });
    } else {
      await ref.update({
        status: "payment_failed",
        updatedAt: paidAt,
        payment: { ...(current.payment || {}), status: "failed", transactionStatus, notifiedAt: paidAt }
      });
    }
    res.status(200).send("ok");
  } catch (error) {
    logger.error("midtransWebhook failed", error);
    res.status(500).send("error");
  }
});
