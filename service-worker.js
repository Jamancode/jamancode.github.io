/* 
 * KuzuDB Server Worker
 * Setzt notwendige Security-Header für WebAssembly Multithreading.
 */
const headers = [
    { name: "Cross-Origin-Embedder-Policy", value: "require-corp" },
    { name: "Cross-Origin-Opener-Policy", value: "same-origin" }
];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
    // Nur Requests der eigenen Origin bearbeiten
    if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response.status === 0) return response;

                const newHeaders = new Headers(response.headers);
                headers.forEach(h => newHeaders.set(h.name, h.value));

                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: newHeaders,
                });
            })
            .catch((e) => console.error(e))
    );
});