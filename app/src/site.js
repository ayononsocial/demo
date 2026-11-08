/* Landing page: install prompt, app version, service worker. */
const $ = (s) => document.querySelector(s);

// Install as an app (Chrome / Edge / Android). The browser decides when this is offered.
let deferred = null;
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); deferred = e;
  const b = $("#install-btn"); if (b) b.hidden = false;
  const h = $("#install-hint"); if (h) h.hidden = true;
});
$("#install-btn")?.addEventListener("click", async () => {
  if (!deferred) return;
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  if (outcome === "accepted") $("#install-btn").hidden = true;
});
addEventListener("appinstalled", () => { const b = $("#install-btn"); if (b) b.hidden = true; });
if (matchMedia("(display-mode: standalone)").matches) { const h = $("#install-hint"); if (h) h.textContent = "You're already using the installed app."; }

fetch("/version.json", { cache: "no-store" }).then((r) => r.json()).then((j) => { const v = $("#dl-ver"); if (v && j.version) v.textContent = `Version ${j.version}`; }).catch(() => {});

if ("serviceWorker" in navigator && import.meta.env.PROD) navigator.serviceWorker.register("/sw.js").catch(() => {});
