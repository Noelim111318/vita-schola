const {chromium: chromium} = require("playwright");

const fs = require("fs");

const axeSrc = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const BASE = "http://localhost:8000/index.html";

const VIEWPORTS = [ {
    name: "360x720",
    width: 360,
    height: 720
}, {
    name: "320x568",
    width: 320,
    height: 568
} ];

const TOUCH_MIN = +(process.env.TOUCH_MIN || 24);

const THEMES = process.argv[2] ? [ process.argv[2] ] : [ "dark", "light" ];

const findings = {
    axe: {},
    touch: {},
    overflow: {},
    scale: {}
};

const contrast = {};

function add(bucket, key, info) {
    findings[bucket][key] = findings[bucket][key] || {
        count: 0,
        examples: new Set,
        states: new Set
    };
    const f = findings[bucket][key];
    f.count++;
    if (f.examples.size < 4) f.examples.add(info.example);
    f.states.add(info.state);
}

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function audit(page, state, opts = {}) {
    await sleep(120);
    await page.evaluate(axeSrc);
    const res = await page.evaluate(async () => {
        const r = await axe.run(document, {
            runOnly: {
                type: "tag",
                values: [ "wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice" ]
            },
            resultTypes: [ "violations" ]
        });
        window.__contrast = [];
        r.violations.filter(v => v.id === "color-contrast").forEach(v => v.nodes.forEach(n => {
            const d = (n.any[0] || {}).data || {};
            window.__contrast.push({
                t: n.target.join(" "),
                ratio: d.contrastRatio,
                fg: d.fgColor,
                bg: d.bgColor,
                size: d.fontSize,
                need: d.expectedContrastRatio
            });
        }));
        return r.violations.map(v => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.slice(0, 4).map(n => n.target.join(" ") + " :: " + (n.failureSummary || "").split("\n").slice(1, 2).join(" ").slice(0, 110)),
            n: v.nodes.length
        }));
    });
    const cc = await page.evaluate(() => window.__contrast);
    for (const c of cc) {
        const k = c.t.replace(/:nth-child\(\d+\)/g, "").replace(/>\s*/g, "> ");
        const kk = state.split("/")[0] + " " + k;
        if (!contrast[kk] || contrast[kk].ratio > c.ratio) contrast[kk] = Object.assign({
            n: (contrast[kk] || {
                n: 0
            }).n + 1
        }, c); else contrast[kk].n++;
    }
    for (const v of res) add("axe", v.id + " (" + v.impact + ") — " + v.help, {
        example: v.nodes[0],
        state: state
    });
    await page.evaluate(m => {
        window.__TOUCH_MIN = m;
    }, TOUCH_MIN);
    const small = await page.evaluate(() => {
        const out = [];
        const MIN = window.__TOUCH_MIN;
        const els = document.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea, [role=button], summary, label:has(input[type=checkbox])");
        els.forEach(el => {
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0 || cs.visibility === "hidden" || cs.display === "none") return;
            if (el.closest("[hidden]")) return;
            if (r.width < MIN || r.height < MIN) out.push({
                sig: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : ""),
                w: Math.round(r.width),
                h: Math.round(r.height),
                text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 25)
            });
        });
        return out;
    });
    for (const s of small) add("touch", s.sig, {
        example: s.w + "x" + s.h + ' "' + s.text + '"',
        state: state
    });
    const ov = await page.evaluate(() => {
        const w = document.documentElement.clientWidth;
        const out = [];
        if (document.documentElement.scrollWidth > w + 1 || document.body.scrollWidth > w + 1) {
            document.querySelectorAll("body *").forEach(el => {
                const r = el.getBoundingClientRect();
                const cs = getComputedStyle(el);
                if (r.width > 0 && r.right > w + 1 && cs.display !== "none" && !el.closest("[hidden]") && !el.closest("svg")) out.push(el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + "." + String(el.className).split(" ")[0] + " right=" + Math.round(r.right));
            });
        }
        return out.slice(0, 5);
    });
    for (const o of ov) add("overflow", o.replace(/ right=\d+/, ""), {
        example: o,
        state: state
    });
}

async function scaleCheck(page, state) {
    await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
    });
    await sleep(150);
    const ov = await page.evaluate(() => {
        const w = document.documentElement.clientWidth;
        const out = [];
        document.querySelectorAll("body *").forEach(el => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            if (r.width > 0 && r.right > w + 1 && cs.display !== "none" && !el.closest("[hidden]") && !el.closest("svg")) out.push(el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + "." + String(el.className).split(" ")[0] + " right=" + Math.round(r.right));
        });
        const clipped = [];
        document.querySelectorAll("button, .mini-row__label-main, .btn").forEach(el => {
            const cs = getComputedStyle(el);
            if (el.offsetParent && cs.textOverflow !== "ellipsis" && el.scrollWidth > el.clientWidth + 2 && cs.overflow !== "visible") clipped.push("COUPE " + el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0]);
        });
        return out.slice(0, 6).concat(clipped.slice(0, 4));
    });
    for (const o of ov) add("scale", o.replace(/ right=\d+/, ""), {
        example: o,
        state: state
    });
    await page.evaluate(() => {
        document.documentElement.style.fontSize = "";
    });
}

async function run(theme, vp) {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({
        viewport: {
            width: vp.width,
            height: vp.height
        },
        hasTouch: true,
        deviceScaleFactor: 2
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.addInitScript(t => {
        try {
            localStorage.setItem("notes:theme", JSON.stringify(t));
        } catch (e) {}
    }, theme);
    await page.goto(BASE);
    await sleep(800);
    const S = name => theme + "/" + vp.name + "/" + name;
    const click = async (sel, wait = 200) => {
        await page.locator(sel).first().click({
            timeout: 4e3
        });
        await sleep(wait);
    };
    await audit(page, S("connexion"));
    await scaleCheck(page, S("connexion"));
    await click("#demo-btn");
    await audit(page, S("choix enfant (demo)"));
    await click("#child-list .child-row", 600);
    await audit(page, S("resume complet"));
    await scaleCheck(page, S("resume complet"));
    await click("#view-custom-btn");
    await audit(page, S("resume personnalise"));
    await click("#view-full-btn");
    await click("#view-customize-btn");
    await audit(page, S("panneau personnaliser"));
    await click("#detail-close");
    await click("#homework-list .mini-row");
    await audit(page, S("bulle devoir"));
    await click("#detail-close");
    await click("#timetable-list .mini-row");
    await audit(page, S("bulle cours"));
    await click("#detail-close");
    await click("#home-subjects-list .subject-row", 400);
    await audit(page, S("detail matiere + simulateur"));
    await scaleCheck(page, S("detail matiere"));
    await click("#subject-back-btn", 300).catch(() => page.goBack());
    await click("#revise-list .mini-row");
    await audit(page, S("bulle cours (reviser)"));
    await click("#detail-body .detail-action-btn", 400);
    await audit(page, S("choix des cours a reviser"));
    await scaleCheck(page, S("choix des cours"));
    await click(".revise-source__view");
    await audit(page, S('bulle "Voir"'));
    await click("#detail-close");
    await click("#revise-go-btn", 500);
    await audit(page, S("quiz question"));
    await click("#quiz-choices .quiz-choice");
    await audit(page, S("quiz apres reponse"));
    await scaleCheck(page, S("quiz apres reponse"));
    await click("#quiz-next-btn");
    await click("#quiz-choices .quiz-choice");
    await click("#quiz-next-btn");
    await audit(page, S("quiz resultat"));
    await click("#revise-back-btn", 300);
    await click("#home-about-btn", 300);
    await audit(page, S("a propos"));
    await scaleCheck(page, S("a propos"));
    await click("#about-ai-btn", 300);
    await audit(page, S("reglages IA"));
    await scaleCheck(page, S("reglages IA"));
    if (errs.length) console.log("  erreurs page (" + theme + "/" + vp.name + "):", errs.slice(0, 3).join(" | "));
    await browser.close();
}

(async () => {
    for (const theme of THEMES) for (const vp of VIEWPORTS) {
        process.stdout.write("… " + theme + " " + vp.name + "\n");
        try {
            await run(theme, vp);
        } catch (e) {
            console.log("  ARRET :", e.message.split("\n")[0]);
        }
    }
    const out = {};
    for (const k of Object.keys(findings)) out[k] = Object.entries(findings[k]).map(([key, f]) => ({
        key: key,
        count: f.count,
        examples: [ ...f.examples ],
        states: [ ...f.states ].slice(0, 5),
        nstates: f.states.size
    }));
    fs.writeFileSync(require("os").tmpdir() + "/a11y-audit-results.json", JSON.stringify(out, null, 2));
    for (const k of [ "axe", "overflow", "scale" ]) {
        console.log("\n=== " + k.toUpperCase() + " ===");
        out[k].sort((a, b) => b.nstates - a.nstates).forEach(f => console.log("- " + f.key + "  [" + f.nstates + " états]\n    " + f.examples.slice(0, 2).join("\n    ")));
        if (!out[k].length) console.log("(rien)");
    }
    fs.writeFileSync(require("os").tmpdir() + "/a11y-contrast.json", JSON.stringify(contrast, null, 2));
    console.log("\n=== CONTRASTE (distincts) ===");
    Object.entries(contrast).sort((a, b) => a[1].ratio - b[1].ratio).forEach(([k, c]) => console.log("- " + k.slice(0, 70) + "  " + c.ratio + " (besoin " + c.need + ") fg " + c.fg + " / bg " + c.bg + " " + c.size));
    console.log("\n=== ZONES TACTILES < " + TOUCH_MIN + " px (" + out.touch.length + " types d’éléments) ===");
    out.touch.sort((a, b) => b.nstates - a.nstates).slice(0, 25).forEach(f => console.log("- " + f.key + "  [" + f.nstates + " états]  " + f.examples[0]));
})();