import { defineConfig } from "vite";
import { resolve, dirname } from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";

/* Self-hosted OCR engine (tesseract.js worker, WASM core, English data) under /tesseract/, so screenshot and
   ID-card scanning work inside the Android app and offline instead of depending on a CDN. */
const OCR_FILES = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  ...["lstm", "simd-lstm", "relaxedsimd-lstm"].map((v) => [`tesseract.js-core/tesseract-core-${v}.wasm.js`, `core/tesseract-core-${v}.wasm.js`]),
  // Shipped unzipped: Android's packager unpacks *.gz assets and drops the ".gz", so a .gz name 404s inside the app.
  ["@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "lang/eng.traineddata"]
];
const ocrFile = (from) => { const b = readFileSync(resolve(import.meta.dirname, "node_modules", from)); return from.endsWith(".gz") ? gunzipSync(b) : b; };
const ocrAssets = () => {
  const serve = (req, res, next) => {
    const hit = OCR_FILES.find(([, to]) => req.url.split("?")[0] === "/tesseract/" + to);
    if (!hit) return next();
    res.setHeader("content-type", hit[1].endsWith(".js") ? "text/javascript" : "application/octet-stream");
    res.end(ocrFile(hit[0]));
  };
  return {
    name: "ocr-assets",
    configureServer: (s) => { s.middlewares.use(serve); },
    writeBundle: (opts) => OCR_FILES.forEach(([from, to]) => {
      const out = resolve(opts.dir, "tesseract", to);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, ocrFile(from));
    })
  };
};

/* /version.json: what's newest. The phone app offers the new APK, an open web app offers a refresh.
   Notes and the required minimum version come from release.json. */
const readJSON = (p) => JSON.parse(readFileSync(resolve(import.meta.dirname, p), "utf8"));
const versionFile = () => ({
  name: "version-file",
  writeBundle: (opts) => {
    const { notes = [], minVersion = "0.0.0" } = readJSON("release.json");
    writeFileSync(resolve(opts.dir, "version.json"), JSON.stringify({ version: readJSON("package.json").version, minVersion, notes, apk: "/download/android", at: new Date().toISOString() }));
  }
});

export default defineConfig({
  plugins: [ocrAssets(), versionFile()],
  define: { __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(resolve(import.meta.dirname, "package.json"), "utf8")).version) },
  build: {
    target: "es2020",
    rollupOptions: {
      input: {
        site: resolve(import.meta.dirname, "index.html"),
        app: resolve(import.meta.dirname, "app.html"),
        admin: resolve(import.meta.dirname, "admin.html"),
        privacy: resolve(import.meta.dirname, "privacy.html"),
        terms: resolve(import.meta.dirname, "terms.html"),
        deleteAccount: resolve(import.meta.dirname, "delete-account.html")
      }
    }
  },
  server: { port: 5500 }
});
