(function() {
    "use strict";
    var VERSION = self.APP_VERSION || null;
    var SLUG = self.APP_SLUG || null;
    var CACHE_NAME = self.APP_CACHE || (SLUG || "app") + "-" + (VERSION || "v1");
    if (!SLUG) SLUG = CACHE_NAME.replace(/-[^-]*$/, "");
    var APP_SHELL = self.APP_SHELL || [ "./", "./index.html" ];
    var RUNTIME = SLUG + "-runtime";
    var RUNTIME_MAX = self.APP_RUNTIME_MAX || 50;
    var OWN = new RegExp("^" + SLUG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "-v[0-9]");
    function cachePut(name, req, resp) {
        return caches.open(name).then(function(cache) {
            return cache.put(req, resp);
        });
    }
    function trim(name, max) {
        return caches.open(name).then(function(cache) {
            return cache.keys().then(function(keys) {
                if (keys.length <= max) return null;
                return Promise.all(keys.slice(0, keys.length - max).map(function(k) {
                    return cache.delete(k);
                }));
            });
        });
    }
    function lookup(req) {
        return caches.open(CACHE_NAME).then(function(c) {
            return c.match(req).then(function(r) {
                if (r) return {
                    resp: r,
                    cache: CACHE_NAME
                };
                return caches.open(RUNTIME).then(function(rc) {
                    return rc.match(req).then(function(rr) {
                        return rr ? {
                            resp: rr,
                            cache: RUNTIME
                        } : null;
                    });
                });
            });
        });
    }
    self.addEventListener("install", function(event) {
        event.waitUntil(caches.open(CACHE_NAME).then(function(cache) {
            return Promise.all(APP_SHELL.map(function(u) {
                return cache.add(new Request(u, {
                    cache: "reload"
                })).catch(function(err) {
                    console.warn("[sw] precache ignore : " + u + " (" + (err && err.message) + ")");
                });
            }));
        }));
    });
    self.addEventListener("message", function(event) {
        if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
    });
    self.addEventListener("activate", function(event) {
        event.waitUntil(Promise.resolve().then(function() {
            return self.registration.navigationPreload ? self.registration.navigationPreload.enable().catch(function() {}) : null;
        }).then(function() {
            return caches.keys();
        }).then(function(keys) {
            return Promise.all(keys.filter(function(k) {
                return k !== CACHE_NAME && (k === RUNTIME || OWN.test(k));
            }).map(function(k) {
                return caches.delete(k);
            }));
        }).then(function() {
            return self.clients.claim();
        }));
    });
    self.addEventListener("fetch", function(event) {
        var req = event.request;
        if (req.method !== "GET") return;
        if (req.mode === "navigate") {
            event.respondWith(Promise.resolve(event.preloadResponse).then(function(preloaded) {
                if (preloaded) {
                    if (preloaded.ok) cachePut(CACHE_NAME, req, preloaded.clone());
                    return preloaded;
                }
                return fetch(req).then(function(resp) {
                    if (resp && resp.ok) cachePut(CACHE_NAME, req, resp.clone());
                    return resp;
                });
            }).catch(function() {
                return caches.match(req).then(function(cached) {
                    return cached || caches.match("./index.html");
                });
            }));
            return;
        }
        event.respondWith(lookup(req).then(function(hit) {
            var target = hit ? hit.cache : RUNTIME;
            var network = fetch(req).then(function(resp) {
                if (resp && resp.status === 200 && new URL(req.url).origin === self.location.origin) {
                    cachePut(target, req, resp.clone()).then(function() {
                        if (target === RUNTIME) trim(RUNTIME, RUNTIME_MAX);
                    });
                }
                return resp;
            }).catch(function() {
                return hit && hit.resp;
            });
            return hit && hit.resp || network;
        }));
    });
})();