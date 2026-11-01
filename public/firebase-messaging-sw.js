// The app's single service worker: push notifications (Firebase) and offline
// support. Push and offline register this same URL, so neither replaces the
// other (src/lib/firebaseConfig.ts).
const firebaseParams = Object.fromEntries(new URL(self.location).searchParams);
if (firebaseParams.apiKey) {
  importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");
  firebase.initializeApp(firebaseParams);
  firebase.messaging();
}

// Tapping a notification opens the page it points to (data.path).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const path =
    (data.FCM_MSG && data.FCM_MSG.data && data.FCM_MSG.data.path) || data.path || "/dashboard";
  const url = new URL(path, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("navigate" in client) return client.navigate(url).then((c) => c && c.focus());
      }
      return self.clients.openWindow(url);
    }),
  );
});

// ---- Offline ---------------------------------------------------------------
// Online, everything comes from the network exactly as before; the copies are
// only used when the network fails. Built files (/assets, hashed and immutable)
// are kept as they load; the Vocabulary page shell is refreshed in the
// background so the saved words open without a connection.
const OFFLINE_CACHE = "evoluir-offline-v1";
const OFFLINE_PAGE = "/vocabulary";
const REFRESH_EVERY_MS = 6 * 60 * 60 * 1000;
const BUILD_KEY = "/__offline-build__";
let lastShellRefresh = 0;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("evoluir-offline-") && key !== OFFLINE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(builtFile(request));
    return;
  }
  if (request.mode === "navigate") event.respondWith(page(event));
});

async function builtFile(request) {
  const cache = await caches.open(OFFLINE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone()).catch(() => {});
  return response;
}

async function page(event) {
  try {
    const response = await fetch(event.request);
    if (response.ok && Date.now() - lastShellRefresh > REFRESH_EVERY_MS) {
      lastShellRefresh = Date.now();
      event.waitUntil(refreshOfflineShell().catch(() => {}));
    }
    return response;
  } catch (error) {
    // A failed request is not proof of being offline (owner report, 2026-11-01:
    // "Você está offline" with a working connection, e.g. while a new version
    // is published or a request drops). With the device online, try once more
    // straight from the network before showing any notice.
    if (self.navigator.onLine !== false) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        return await fetch(event.request.url, { credentials: "same-origin", cache: "reload" });
      } catch {
        // fall through to the notice
      }
    }
    const cache = await caches.open(OFFLINE_CACHE);
    const shell = await cache.match(OFFLINE_PAGE);
    const path = new URL(event.request.url).pathname;
    if (shell && path === OFFLINE_PAGE) return shell;
    return offlineNotice(Boolean(shell), self.navigator.onLine !== false);
  }
}

/**
 * Saves the Vocabulary page, the built files it loads and the Vocabulary
 * screen's own files (lazy, so read from the build's dependency list).
 */
async function refreshOfflineShell() {
  const response = await fetch(OFFLINE_PAGE, { credentials: "same-origin" });
  if (!response.ok) return;
  const html = await response.clone().text();
  const cache = await caches.open(OFFLINE_CACHE);
  const shellFiles = [...new Set(html.match(/\/assets\/[^"'\s)]+\.(?:js|css)/g) || [])];
  const files = [...new Set([...shellFiles, ...(await vocabularyScreenFiles(shellFiles))])];

  // A new deploy changes the shell's files: copies from the old build are
  // dropped. Same build: files kept while using the app stay cached.
  const build = shellFiles.slice().sort().join(",");
  const previous = await cache.match(BUILD_KEY);
  if (!previous || (await previous.text()) !== build) {
    for (const request of await cache.keys()) {
      const path = new URL(request.url).pathname;
      if (path.startsWith("/assets/") && !files.includes(path)) await cache.delete(request);
    }
  }
  await Promise.all(
    files.map((file) => cache.match(file).then((hit) => hit || cache.add(file).catch(() => {}))),
  );
  await cache.put(OFFLINE_PAGE, response);
  await cache.put(BUILD_KEY, new Response(build));
}

/** The Vocabulary route chunk and its dependencies, from the entry file. */
async function vocabularyScreenFiles(shellFiles) {
  const entry = shellFiles.find((file) => /^\/assets\/index-[^/]+\.js$/.test(file));
  if (!entry) return [];
  try {
    const source = await (await fetch(entry)).text();
    const list = /m\.f=\[([^\]]*)\]/.exec(source);
    const deps = list
      ? [...list[1].matchAll(/["'`](assets\/[^"'`]+)["'`]/g)].map((match) => `/${match[1]}`)
      : [];
    const route =
      /import\(["'`]\.\/(vocabulary-[^"'`]+\.js)["'`]\)(?:,__vite__mapDeps\(\[([\d,]*)\]\))?/.exec(
        source,
      );
    if (!route) return [];
    const indexes = (route[2] || "").split(",").filter(Boolean).map(Number);
    return [`/assets/${route[1]}`, ...indexes.map((index) => deps[index]).filter(Boolean)];
  } catch {
    return [];
  }
}

function offlineNotice(hasSavedWords, online) {
  const link = hasSavedWords
    ? '<a class="ghost" href="/vocabulary">Abrir palavras salvas · Open saved words</a>'
    : "";
  // Online but the app did not answer: say so, and keep retrying on its own,
  // instead of calling it offline.
  const title = online
    ? "Não foi possível abrir o app · Could not open the app"
    : "Você está offline · You are offline";
  const text = online
    ? "Sua internet parece estar funcionando, mas o app não respondeu agora. Tentando de novo em alguns segundos…<br>Your connection looks fine, but the app did not answer. Retrying in a few seconds…"
    : "Esta tela precisa de internet. As palavras do vocabulário salvas neste aparelho continuam disponíveis.<br>This screen needs a connection. Vocabulary saved on this device is still available.";
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Evoluir+ English AI</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1117;color:#e6edf3;
font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;padding:24px}
h1{font-size:1.25rem;margin:0 0 8px}p{color:#9fb0c0;margin:0 0 20px;line-height:1.5}
a,button{display:inline-block;background:#2ee6c5;color:#06201b;font:inherit;font-weight:700;
text-decoration:none;border:0;padding:12px 20px;border-radius:12px;margin:4px;cursor:pointer}
a.ghost{background:transparent;color:#e6edf3;border:1px solid rgba(255,255,255,.2)}
</style></head><body><main>
<h1>${title}</h1>
<p>${text}</p>
<button type="button" onclick="location.reload()">Tentar novamente · Try again</button>
${link}
</main>
<script>
var wait=5000;function retry(){if(navigator.onLine)location.reload();else setTimeout(retry,wait);}
setTimeout(retry,wait);window.addEventListener("online",function(){location.reload();});
</script></body></html>`;
  return new Response(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
