(function(global) {
    "use strict";
    var ENGINE_VERSION = "1.1.0";
    function $(sel, root) {
        return (root || document).querySelector(sel);
    }
    function $$(sel, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    }
    var reduceMotion = false;
    try {
        reduceMotion = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {}
    var STRINGS = {
        streak: function(n) {
            return "🔥 " + n + " jour" + (n > 1 ? "s" : "") + " d'affilee";
        },
        weekDayLabels: [ "D", "L", "M", "M", "J", "V", "S" ],
        weekNotPlayed: "pas joue",
        weekCell: function(correct, seen, pct) {
            return correct + "/" + seen + " — " + pct + "%";
        },
        weekSummary: function(seen, days, rate) {
            return seen + " sur " + days + " jour" + (days > 1 ? "s" : "") + " — " + rate + "% de reussite";
        },
        installIosHint: "Sur iPhone/iPad : touche « Partager » (le carre avec une fleche vers le haut), puis « Sur l'ecran d'accueil »."
    };
    function setStrings(obj) {
        if (obj && typeof obj === "object") {
            for (var k in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, k)) STRINGS[k] = obj[k];
            }
        }
        return STRINGS;
    }
    var bus = {};
    function on(evt, fn) {
        if (typeof fn !== "function") return function() {};
        (bus[evt] || (bus[evt] = [])).push(fn);
        return function off() {
            var a = bus[evt] || [];
            var i = a.indexOf(fn);
            if (i >= 0) a.splice(i, 1);
        };
    }
    function emit(evt, data) {
        (bus[evt] || []).forEach(function(fn) {
            try {
                fn(data);
            } catch (e) {}
        });
    }
    var NS = "app";
    function key(k) {
        return NS + ":" + k;
    }
    var store = {
        ns: function(id) {
            if (id) NS = String(id);
            return NS;
        },
        load: function(k, dflt) {
            try {
                var v = localStorage.getItem(key(k));
                return v == null ? dflt : JSON.parse(v);
            } catch (e) {
                return dflt;
            }
        },
        save: function(k, val) {
            try {
                localStorage.setItem(key(k), JSON.stringify(val));
            } catch (e) {
                emit("store:quota", {
                    key: k,
                    error: e
                });
            }
        },
        remove: function(k) {
            try {
                localStorage.removeItem(key(k));
            } catch (e) {}
        },
        keys: function() {
            var out = [];
            try {
                var p = NS + ":";
                for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i);
                    if (k && k.indexOf(p) === 0) out.push(k.slice(p.length));
                }
            } catch (e) {}
            return out;
        },
        clear: function() {
            try {
                store.keys().forEach(function(k) {
                    store.remove(k);
                });
            } catch (e) {}
        },
        migrate: function(steps) {
            if (!steps) return;
            var cur = store.load("__schema", 0);
            var list = Object.keys(steps).map(Number).sort(function(a, b) {
                return a - b;
            });
            for (var i = 0; i < list.length; i++) {
                var v = list[i];
                if (v <= cur) continue;
                try {
                    steps[v]();
                } catch (e) {
                    console.error("AppEngine.store.migrate: etape " + v + " a echoue, arret", e);
                    emit("store:migrate-error", {
                        step: v,
                        error: e
                    });
                    return;
                }
                store.save("__schema", v);
                cur = v;
            }
        }
    };
    var liveEl = null;
    function announce(msg, assertive) {
        try {
            if (!liveEl) {
                liveEl = document.createElement("div");
                liveEl.setAttribute("aria-live", assertive ? "assertive" : "polite");
                liveEl.setAttribute("aria-atomic", "true");
                liveEl.style.cssText = "position:absolute;width:1px;height:1px;margin:-1px;" + "padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0";
                document.body.appendChild(liveEl);
            }
            liveEl.textContent = "";
            var el = liveEl;
            setTimeout(function() {
                el.textContent = String(msg);
            }, 30);
        } catch (e) {}
    }
    var backWired = false;
    var hashWired = false;
    var screenHashOn = false;
    var firstShow = true;
    function bareId(id) {
        return String(id).replace(/^screen-/, "");
    }
    function hashScreen() {
        var h = (global.location.hash || "").replace(/^#/, "").replace(/^screen-/, "");
        if (!h) return null;
        var el = document.getElementById("screen-" + h);
        return el && el.classList.contains("screen") ? el.id : null;
    }
    var screens = {
        show: function(id, opts) {
            opts = opts || {};
            var target = null;
            $$(".screen").forEach(function(s) {
                var isOn = s.id === id;
                s.classList.toggle("active", isOn);
                if (isOn) target = s;
            });
            if (!target) console.warn('AppEngine.screens.show: ecran inconnu "' + id + '"');
            var bare = bareId(id);
            document.body.classList.add("screen-active");
            $$(".screen").forEach(function(s) {
                var n = bareId(s.id);
                document.body.classList.toggle(n + "-active", n === bare);
            });
            try {
                global.scrollTo(0, 0);
            } catch (e) {}
            if (screenHashOn && opts.hash !== false) {
                var want = "#" + bare;
                if (global.location.hash !== want) {
                    try {
                        if (opts.push === false || firstShow) {
                            global.history.replaceState(global.history.state, "", want);
                        } else {
                            global.location.hash = want;
                        }
                    } catch (e) {}
                }
            } else if (opts.push) {
                try {
                    global.history.pushState({
                        engineScreen: id
                    }, "", global.location.href);
                } catch (e) {}
            }
            firstShow = false;
            if (target && opts.focus !== false) {
                var f = target.querySelector("[autofocus], h1, h2, h3") || target;
                if (!f.hasAttribute("tabindex")) f.setAttribute("tabindex", "-1");
                try {
                    f.focus({
                        preventScroll: true
                    });
                } catch (e) {
                    try {
                        f.focus();
                    } catch (e2) {}
                }
            }
            emit("screen:show", id);
        },
        current: function() {
            var el = $(".screen.active");
            return el ? el.id : null;
        },
        fromHash: function() {
            return hashScreen();
        },
        onShow: function(fn) {
            return on("screen:show", fn);
        },
        wireBack: function() {
            if (backWired || !global.history) return;
            backWired = true;
            global.addEventListener("popstate", function(e) {
                var id = e.state && e.state.engineScreen;
                if (id) screens.show(id, {
                    push: false
                }); else emit("screen:back");
            });
        },
        wireHash: function() {
            if (hashWired) return;
            hashWired = true;
            screenHashOn = true;
            global.addEventListener("hashchange", function() {
                var id = hashScreen();
                if (id && id !== screens.current()) screens.show(id, {
                    hash: false
                });
            });
        },
        back: function() {
            if (hashWired || backWired) {
                try {
                    global.history.back();
                    return;
                } catch (e) {}
            }
            emit("screen:back");
        }
    };
    var audioCtx = null;
    var soundOn = true;
    var toneQueue = [];
    function playTone(freq, startAt, dur, type, peak) {
        var t0 = audioCtx.currentTime + (startAt || 0);
        var osc = audioCtx.createOscillator();
        var g = audioCtx.createGain();
        osc.type = type || "sine";
        osc.frequency.setValueAtTime(freq, t0);
        g.gain.setValueAtTime(1e-4, t0);
        g.gain.exponentialRampToValueAtTime(peak || .2, t0 + .015);
        g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
        osc.connect(g);
        g.connect(audioCtx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + .03);
    }
    function flushTones() {
        if (!audioCtx || audioCtx.state !== "running") return;
        var q = toneQueue;
        toneQueue = [];
        q.forEach(function(a) {
            try {
                playTone(a[0], a[1], a[2], a[3], a[4]);
            } catch (e) {}
        });
    }
    var sound = {
        enable: function(v) {
            soundOn = !!v;
            if (soundOn) sound.resume();
        },
        get enabled() {
            return soundOn;
        },
        resume: function() {
            if (!soundOn) return;
            try {
                var AC = global.AudioContext || global.webkitAudioContext;
                if (!AC) return;
                if (!audioCtx) audioCtx = new AC;
                if (audioCtx.state === "suspended") audioCtx.resume().then(flushTones).catch(function() {}); else flushTones();
            } catch (e) {
                audioCtx = null;
            }
        },
        tone: function(freq, startAt, dur, type, peak) {
            if (!soundOn) return;
            if (audioCtx && audioCtx.state === "running") {
                try {
                    playTone(freq, startAt, dur, type, peak);
                } catch (e) {}
                return;
            }
            toneQueue.push([ freq, startAt, dur, type, peak ]);
            if (toneQueue.length > 16) toneQueue.shift();
            sound.resume();
        },
        feedback: function(ok) {
            if (!soundOn) return;
            sound.resume();
            if (ok) {
                sound.tone(660, 0, .12, "sine", .22);
                sound.tone(988, .1, .16, "sine", .2);
            } else {
                sound.tone(311, 0, .16, "square", .12);
                sound.tone(233, .12, .22, "square", .12);
            }
        }
    };
    function haptic(type) {
        if (!("vibrate" in navigator)) return;
        var pat;
        if (type === "success") pat = [ 20, 35, 25 ]; else if (type === "error") pat = [ 30, 25, 60 ]; else if (type == null || type === "tap") pat = 10; else pat = type;
        try {
            navigator.vibrate(pat);
        } catch (e) {}
    }
    var autoBurstWrap = null;
    var fx = {
        stars: function(el, count) {
            if (typeof el === "string") el = $(el);
            if (!el) return;
            var n = count == null ? 60 : count;
            var frag = document.createDocumentFragment();
            for (var i = 0; i < n; i++) {
                var s = document.createElement("div");
                s.className = "star";
                var sz = Math.random() * 2.5 + .5;
                s.style.width = sz + "px";
                s.style.height = sz + "px";
                s.style.top = Math.random() * 100 + "%";
                s.style.left = Math.random() * 100 + "%";
                s.style.setProperty("--d", (Math.random() * 3 + 2).toFixed(1) + "s");
                s.style.setProperty("--delay", (Math.random() * 4).toFixed(1) + "s");
                s.style.setProperty("--op", (Math.random() * .6 + .2).toFixed(2));
                frag.appendChild(s);
            }
            el.appendChild(frag);
        },
        burst: function(positive, opts) {
            if (reduceMotion) return;
            opts = opts || {};
            var wrap = opts.container || document.getElementById("burst") || autoBurstWrap;
            if (!wrap) {
                wrap = document.createElement("div");
                wrap.className = "burst-container";
                document.body.appendChild(wrap);
                autoBurstWrap = wrap;
            }
            if (wrap._burstTimer) {
                clearTimeout(wrap._burstTimer);
                wrap._burstTimer = null;
            }
            wrap.innerHTML = "";
            var colors = opts.colors || (positive ? [ "#FFD60A", "#4ADE80", "#60A5FA", "#F472B6", "#FBBF24" ] : [ "#FF6B6B", "#F87171", "#FCA5A5" ]);
            var cx = global.innerWidth / 2, cy = global.innerHeight / 2;
            var n = positive ? 28 : 12;
            for (var i = 0; i < n; i++) {
                var p = document.createElement("div");
                p.className = "burst-particle";
                var angle = i / n * 360;
                var dist = positive ? 80 + Math.random() * 160 : 40 + Math.random() * 80;
                var rad = angle * Math.PI / 180;
                p.style.left = cx + "px";
                p.style.top = cy + "px";
                p.style.background = colors[i % colors.length];
                p.style.width = (positive ? 10 : 7) + "px";
                p.style.height = (positive ? 10 : 7) + "px";
                p.style.setProperty("--dx", Math.cos(rad) * dist + "px");
                p.style.setProperty("--dy", Math.sin(rad) * dist + "px");
                p.style.animationDuration = positive ? "0.9s" : "0.6s";
                wrap.appendChild(p);
            }
            wrap._burstTimer = setTimeout(function() {
                wrap.innerHTML = "";
                wrap._burstTimer = null;
            }, 1e3);
        }
    };
    var DAY = 864e5;
    function dayStr(ms) {
        var d = new Date(ms);
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    var history = {
        dayStr: dayStr,
        bumpStreak: function() {
            var today = dayStr(Date.now());
            var yest = dayStr(Date.now() - DAY);
            var s = store.load("streak", {
                count: 0,
                lastDay: ""
            });
            if (s.lastDay === today) return;
            s.count = s.lastDay === yest ? s.count + 1 : 1;
            s.lastDay = today;
            store.save("streak", s);
        },
        streak: function() {
            var s = store.load("streak", {
                count: 0,
                lastDay: ""
            });
            var today = dayStr(Date.now());
            var yest = dayStr(Date.now() - DAY);
            return {
                count: s.count,
                alive: s.count > 0 && (s.lastDay === today || s.lastDay === yest)
            };
        },
        renderStreak: function(el) {
            if (typeof el === "string") el = $(el);
            if (!el) return;
            var s = history.streak();
            el.hidden = !s.alive;
            if (s.alive) el.textContent = STRINGS.streak(s.count);
        },
        logDaily: function(seen, correct) {
            seen = Number(seen) || 0;
            correct = Number(correct) || 0;
            if (!seen) return;
            var log = store.load("daily", {});
            var k = dayStr(Date.now());
            var e = log[k] || {
                seen: 0,
                correct: 0
            };
            e.seen += seen;
            e.correct += correct;
            log[k] = e;
            var cutoff = dayStr(Date.now() - 60 * DAY);
            Object.keys(log).forEach(function(d) {
                if (d < cutoff) delete log[d];
            });
            store.save("daily", log);
        },
        renderWeek: function(els) {
            els = els || {};
            var wrap = typeof els.bars === "string" ? $(els.bars) : els.bars;
            var block = typeof els.block === "string" ? $(els.block) : els.block;
            var sum = typeof els.summary === "string" ? $(els.summary) : els.summary;
            if (!wrap || !block) return;
            var log = store.load("daily", {});
            var labels = STRINGS.weekDayLabels;
            wrap.innerHTML = "";
            var tSeen = 0, tCorrect = 0, days = 0;
            for (var i = 6; i >= 0; i--) {
                var ms = Date.now() - i * DAY;
                var e = log[dayStr(ms)];
                var has = !!(e && e.seen);
                var pct = has ? Math.round(e.correct / e.seen * 100) : 0;
                if (has) {
                    tSeen += e.seen;
                    tCorrect += e.correct;
                    days += 1;
                }
                var col = document.createElement("div");
                col.className = "week-col";
                var bar = document.createElement("div");
                bar.className = "week-bar";
                bar.style.height = has ? Math.max(8, pct) + "%" : "3px";
                if (has) bar.style.background = pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--yellow)" : "var(--red)";
                bar.title = has ? STRINGS.weekCell(e.correct, e.seen, pct) : STRINGS.weekNotPlayed;
                var lab = document.createElement("span");
                lab.className = "week-lab";
                lab.textContent = labels[new Date(ms).getDay()];
                col.appendChild(bar);
                col.appendChild(lab);
                wrap.appendChild(col);
            }
            if (tSeen === 0) {
                block.hidden = true;
                return;
            }
            block.hidden = false;
            if (sum) {
                var rate = Math.round(tCorrect / tSeen * 100);
                sum.textContent = STRINGS.weekSummary(tSeen, days, rate);
            }
        }
    };
    function installBanner(cfg) {
        cfg = cfg || {};
        var row = typeof cfg.row === "string" ? $(cfg.row) : cfg.row || $("#install-row");
        var btn = typeof cfg.btn === "string" ? $(cfg.btn) : cfg.btn || $("#install-btn");
        var dismiss = typeof cfg.dismiss === "string" ? $(cfg.dismiss) : cfg.dismiss || $("#install-dismiss");
        var hint = typeof cfg.hint === "string" ? $(cfg.hint) : cfg.hint || $("#install-hint");
        var api = {
            refresh: function() {}
        };
        if (!row || !btn) return api;
        var hideKey = cfg.hideKey || "install-hidden";
        var showOn = typeof cfg.showOn === "function" ? cfg.showOn : function() {
            return true;
        };
        var iosHint = cfg.iosHint || STRINGS.installIosHint;
        var deferred = null;
        var mode = null;
        var hiddenByUser = store.load(hideKey, false) === true || store.load(hideKey, false) === "1";
        function isStandalone() {
            return global.matchMedia("(display-mode: standalone)").matches || global.navigator.standalone === true || document.referrer.indexOf("android-app://") === 0;
        }
        var iOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
        var iOSSafari = iOS && /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios|opios|android/i.test(navigator.userAgent);
        function refresh() {
            var show = !!mode && !hiddenByUser && !isStandalone() && !!showOn();
            row.hidden = !show;
            if (!show && hint) hint.hidden = true;
            if (show) row.dataset.mode = mode;
        }
        function forget() {
            hiddenByUser = true;
            store.save(hideKey, true);
            refresh();
        }
        global.addEventListener("beforeinstallprompt", function(e) {
            e.preventDefault();
            deferred = e;
            mode = "prompt";
            refresh();
            emit("install:available", {
                mode: "prompt"
            });
        });
        global.addEventListener("appinstalled", function() {
            deferred = null;
            mode = null;
            refresh();
            emit("install:done", null);
        });
        btn.addEventListener("click", function() {
            if (mode === "ios") {
                if (hint) {
                    hint.hidden = !hint.hidden;
                    hint.textContent = iosHint;
                    btn.setAttribute("aria-expanded", String(!hint.hidden));
                }
                return;
            }
            if (!deferred) return;
            btn.disabled = true;
            deferred.prompt();
            Promise.resolve(deferred.userChoice).catch(function() {}).then(function() {
                deferred = null;
                mode = null;
                btn.disabled = false;
                refresh();
            });
        });
        if (dismiss) dismiss.addEventListener("click", forget);
        if (iOSSafari) {
            mode = "ios";
            if (hint && hint.id) btn.setAttribute("aria-controls", hint.id);
            btn.setAttribute("aria-expanded", "false");
            emit("install:available", {
                mode: "ios"
            });
        }
        refresh();
        api.refresh = refresh;
        on("screen:show", refresh);
        return api;
    }
    function registerServiceWorker(cfg) {
        cfg = cfg || {};
        if (!("serviceWorker" in navigator)) return;
        var version = cfg.version || "v1";
        var url = cfg.url || "service-worker.js";
        var autoReload = cfg.autoReload !== false;
        var hadController = !!navigator.serviceWorker.controller;
        var reloading = false;
        if (autoReload) {
            navigator.serviceWorker.addEventListener("controllerchange", function() {
                if (reloading || !hadController) return;
                reloading = true;
                global.location.reload();
            });
        }
        global.addEventListener("load", function() {
            navigator.serviceWorker.register(url + "?v=" + encodeURIComponent(version)).then(function(reg) {
                function updateReady(worker) {
                    var apply = function() {
                        try {
                            worker.postMessage({
                                type: "SKIP_WAITING"
                            });
                        } catch (e) {}
                    };
                    emit("sw:updateready", {
                        registration: reg,
                        apply: apply
                    });
                    if (autoReload) apply();
                }
                if (reg.waiting && navigator.serviceWorker.controller) updateReady(reg.waiting);
                reg.addEventListener("updatefound", function() {
                    var nw = reg.installing;
                    if (!nw) return;
                    nw.addEventListener("statechange", function() {
                        if (nw.state === "installed" && navigator.serviceWorker.controller) updateReady(nw);
                    });
                });
                emit("sw:registered", reg);
            }).catch(function(err) {
                console.warn("Service worker registration failed:", err);
                emit("sw:error", err);
            });
        });
    }
    function boot(config) {
        config = config || {};
        if (!config.id) console.warn("AppEngine.boot: pas d'`id` -> localStorage non prefixe");
        store.ns(config.id || "app");
        if (config.strings) setStrings(config.strings);
        if (config.version && config.versionBadgeSel !== false) {
            var badge = $(config.versionBadgeSel || "#app-version");
            if (badge) badge.textContent = config.version;
        }
        if (config.stars !== false && config.stars !== 0) {
            fx.stars(config.starsSel || "#stars", typeof config.stars === "number" ? config.stars : 60);
        }
        if (config.streakBadgeSel !== false) {
            history.renderStreak(config.streakBadgeSel || "#streak-badge");
        }
        if (config.screenHash) screens.wireHash(); else if (config.backButton) screens.wireBack();
        var install = {
            refresh: function() {}
        };
        if (config.install !== false) {
            var ic = typeof config.install === "object" ? config.install : {};
            if (ic.showOn == null) {
                ic.showOn = function() {
                    var cur = screens.current();
                    return cur == null || cur === "screen-home" || cur === "screen-settings" || cur === "screen-title";
                };
            }
            install = installBanner(ic);
        }
        if (config.serviceWorker !== false) {
            registerServiceWorker({
                version: config.version || "v1",
                url: config.swUrl || "service-worker.js",
                autoReload: config.autoReload
            });
        }
        try {
            console.info("%cAppEngine " + ENGINE_VERSION + "%c · " + (config.id || "app") + " " + (config.version || ""), "font-weight:bold", "font-weight:normal");
        } catch (e) {}
        return {
            install: install
        };
    }
    global.AppEngine = {
        version: ENGINE_VERSION,
        reduceMotion: reduceMotion,
        $: $,
        $$: $$,
        on: on,
        emit: emit,
        strings: STRINGS,
        setStrings: setStrings,
        announce: announce,
        store: store,
        screens: screens,
        sound: sound,
        haptic: haptic,
        fx: fx,
        history: history,
        installBanner: installBanner,
        registerServiceWorker: registerServiceWorker,
        boot: boot
    };
})(typeof window !== "undefined" ? window : this);