// Shop playground: loads the shop database into PGlite and runs what the viewer types, printed like psql.
import { PGlite } from "https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.16/dist/index.js";
import { run } from "./psql.js";

const $ = (id) => document.getElementById(id);
const log = $("log"), sql = $("sql"), status = $("status"), runBtn = $("run");
let db, busy = false, started = false;

// ---------- small helpers ----------
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: fine */ } },
};
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
function say(text) { const e = el("div", "entry sys", text); log.append(e); log.scrollTop = log.scrollHeight; }
function setStatus(text, cls = "") { status.textContent = text; status.className = "status " + cls; }

// ---------- database ----------
async function load() {
  const [schema, seed] = await Promise.all(["shop/schema.sql", "shop/seed.sql"].map((f) => fetch(f).then((r) => r.text())));
  const fresh = new PGlite();
  await fresh.exec(schema + "\n" + seed);
  return fresh;
}

async function refreshTables() {
  const rows = (await db.query("SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE relkind = 'r' AND nspname = 'public' ORDER BY 1")).rows;
  const box = $("tables"); box.replaceChildren();
  for (const { relname } of rows) {
    const b = el("button", "", relname);
    b.type = "button"; b.title = `\\d ${relname}`;
    b.onclick = () => execute(`\\d ${relname}`);
    box.append(b);
  }
}

async function start() {
  setStatus("loading PostgreSQL…");
  try {
    db = await load();
    const v = (await db.query("SHOW server_version")).rows[0].server_version;
    setStatus(`ready · PostgreSQL ${v.split(" ")[0]}`, "ready");
    runBtn.disabled = false;
    await refreshTables();
    say("The shop database is loaded: three tables, customers, products and orders. Pick a step from the lecture list, or type a query below.");
    // ?run=<sql> runs a query right away (links from video descriptions)
    const autorun = new URLSearchParams(location.search).get("run");
    if (autorun && !started) await execute(autorun);
    started = true;
  } catch (e) {
    setStatus("could not start", "bad");
    say("PostgreSQL could not start in this browser: " + e.message + ". Try a current Chrome, Firefox, Safari or Edge, or install the database locally (see the link at the bottom).");
  }
}

// ---------- running ----------
const cmdHistory = store.get("shop.history", []);
let hpos = cmdHistory.length;

async function execute(text) {
  text = text.trim();
  if (!text || busy || !db) return;
  busy = true; runBtn.disabled = true;
  cmdHistory.push(text); if (cmdHistory.length > 200) cmdHistory.shift(); hpos = cmdHistory.length; store.set("shop.history", cmdHistory);
  try {
    const steps = await run(db, text);
    for (const s of steps) {
      const entry = el("div", "entry");
      const cmd = el("div", "cmd");
      cmd.append(el("span", "prompt", "shop=# "), s.cmd.replace(/\n/g, "\nshop-# "));
      entry.append(cmd, el("div", "out" + (s.ok ? "" : " err"), s.out));
      log.append(entry);
    }
    if (!steps.length) say("Nothing to run: write a statement and end it with ;");
    markDone(text);
    if (/\b(CREATE|DROP|ALTER)\b/i.test(text)) await refreshTables();
  } catch (e) {
    say("Something went wrong: " + e.message);
  } finally {
    busy = false; runBtn.disabled = false;
    log.scrollTop = log.scrollHeight;
  }
}

$("form").onsubmit = (e) => { e.preventDefault(); execute(sql.value); sql.value = ""; };
sql.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $("form").requestSubmit(); return; }
  const atStart = sql.selectionStart === 0 && sql.selectionEnd === 0;
  const atEnd = sql.selectionStart === sql.value.length;
  if (e.key === "ArrowUp" && (atStart || !sql.value.includes("\n")) && hpos > 0) {
    e.preventDefault(); sql.value = cmdHistory[--hpos];
  } else if (e.key === "ArrowDown" && (atEnd || !sql.value.includes("\n")) && hpos < cmdHistory.length) {
    e.preventDefault(); hpos++; sql.value = cmdHistory[hpos] ?? "";
  }
});
$("clear").onclick = () => log.replaceChildren();
$("reset").onclick = async () => {
  if (busy) return;
  busy = true; runBtn.disabled = true; setStatus("resetting…");
  try { await db?.close(); } catch { /* already closed */ }
  busy = false;
  await start();
  document.querySelectorAll(".steps button.done").forEach((b) => b.classList.remove("done"));
  say("Reset done: the original shop data is back.");
};

// ---------- lecture steps ----------
let examples = {};
function markDone(text) {
  document.querySelectorAll(".steps button").forEach((b) => { if (b.dataset.sql === text) b.classList.add("done"); });
}
function showEpisode(ep) {
  const x = examples[ep]; if (!x) return;
  $("intro").textContent = x.intro || "";
  const list = $("steps"); list.replaceChildren();
  for (const s of x.steps) {
    const li = el("li"), b = el("button");
    b.type = "button"; b.dataset.sql = s.sql;
    b.append(el("span", "", s.label), el("code", "", s.sql));
    b.onclick = () => { sql.value = s.sql; sql.focus(); };
    b.ondblclick = () => { execute(s.sql); sql.value = ""; };
    li.append(b); list.append(li);
  }
  $("exercise-box").hidden = !x.exercise;
  if (x.exercise) { $("exercise").textContent = x.exercise.task; $("answer").textContent = x.exercise.answer; }
  const u = new URL(location); u.searchParams.set("ep", ep); window.history.replaceState(null, "", u);
  store.set("shop.ep", ep);
}

async function setupEpisodes() {
  try { examples = await (await fetch("examples.json")).json(); } catch { examples = {}; }
  const eps = Object.keys(examples).sort();
  const sel = $("episode");
  for (const ep of eps) { const o = el("option", "", `Lecture ${ep} · ${examples[ep].title}`); o.value = ep; sel.append(o); }
  const params = new URLSearchParams(location.search);
  const want = params.get("ep")?.padStart(2, "0");
  const ep = eps.includes(want) ? want : eps.includes(store.get("shop.ep")) ? store.get("shop.ep") : eps[eps.length - 1];
  if (ep) { sel.value = ep; showEpisode(ep); }
  sel.onchange = () => showEpisode(sel.value);
  if (params.get("q")) sql.value = params.get("q");
}

setupEpisodes();
start();
