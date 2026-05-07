const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

// When bundled with pkg, __dirname is the snapshot (read-only).
// Use execDir for writable files (demo-state.json), snapshotDir for static assets.
const isPkg = typeof process.pkg !== "undefined";
const execDir = isPkg ? path.dirname(process.execPath) : __dirname;
const snapshotDir = __dirname;
const root = snapshotDir;
const port = process.env.PORT || 8080;
const stateFile = path.join(execDir, "demo-state.json");


function loadState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {
    return {
      customMenu: {},
      customMenuComps: {},
      priceOverrides: {},
      orders: {},
      tableOrders: {},
      stock: {},
      receipts: {}
    };
  }
}

function saveState(state) {
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function readPath(state, rawPath = "") {
  const parts = String(rawPath).replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  let cur = state;
  for (const part of parts) {
    if (cur == null) return null;
    cur = cur[part];
  }
  return cur ?? null;
}

function setPath(state, rawPath, value) {
  const parts = String(rawPath).replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  if (!parts.length) return value;
  let cur = state;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (!cur[part] || typeof cur[part] !== "object") cur[part] = {};
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
  return state;
}

function removePath(state, rawPath) {
  const parts = String(rawPath).replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  if (!parts.length) return {};
  let cur = state;
  for (let i = 0; i < parts.length - 1; i += 1) {
    cur = cur?.[parts[i]];
    if (!cur) return state;
  }
  delete cur[parts[parts.length - 1]];
  return state;
}

function mergePath(state, rawPath, value) {
  const prev = readPath(state, rawPath);
  const next = prev && typeof prev === "object" && !Array.isArray(prev) ? { ...prev, ...(value || {}) } : { ...(value || {}) };
  return setPath(state, rawPath, next);
}

function sendJson(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(body));
}

function sendText(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(body);
}

function fileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
  }[ext] || "application/octet-stream";
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    });
    return res.end();
  }

  if (req.method === "GET" && url.pathname === "/__demo/state") {
    const state = loadState();
    return sendJson(res, 200, readPath(state, url.searchParams.get("path") || ""));
  }

  if (req.method === "POST" && url.pathname === "/__demo/write") {
    let raw = "";
    req.on("data", chunk => { raw += chunk; });
    req.on("end", () => {
      try {
        const { mode, path: writePath, value } = JSON.parse(raw || "{}");
        let state = loadState();
        if (mode === "set") state = setPath(state, writePath, value);
        else if (mode === "update") state = mergePath(state, writePath, value);
        else if (mode === "remove") state = removePath(state, writePath);
        else return sendText(res, 400, "Mode tidak valid");
        saveState(state);
        return sendJson(res, 200, { ok: true });
      } catch (e) {
        return sendText(res, 500, e.message || "Write gagal");
      }
    });
    return;
  }

  const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  const filePath = path.join(root, rel);
  if (!filePath.startsWith(root)) return sendText(res, 403, "Forbidden");
  fs.readFile(filePath, (err, data) => {
    if (err) return sendText(res, 404, "Not found");
    res.writeHead(200, { "Content-Type": fileType(filePath), "Cache-Control": "no-store" });
    res.end(data);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`MULA demo server running on http://0.0.0.0:${port}`);
});
