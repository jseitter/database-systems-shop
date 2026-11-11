// psql look-alike on top of PGlite: splits input into statements, prints results in psql's
// aligned format and emulates the meta-commands viewers meet in the lectures (\d, \dt, \?).
// Works in the browser and in Node (see test/check.mjs).

// Return every value as Postgres sends it (text), so the output matches psql exactly.
// PGlite merges custom parsers per type id, so we list every type the database knows.
const parserCache = new WeakMap();
async function rawParsersFor(db) {
  if (!parserCache.has(db)) {
    const ids = (await db.query("SELECT oid::int AS oid FROM pg_type")).rows;
    const p = {};
    for (const { oid } of ids) p[oid] = (v) => v;
    parserCache.set(db, p);
  }
  return parserCache.get(db);
}

const RIGHT = new Set([20, 21, 23, 26, 700, 701, 790, 1700]); // numeric types are right-aligned

// ---------- splitting ----------
// Split on ";" outside quotes, comments and dollar quotes. Lines starting with "\" are meta-commands.
export function split(input) {
  const out = [];
  let buf = "", i = 0;
  const flush = () => { if (buf.trim()) out.push({ sql: buf.trim() }); buf = ""; };
  while (i < input.length) {
    if (!buf.trim() && input[i] === "\\") {          // meta-command: up to end of line
      const end = input.indexOf("\n", i);
      const line = input.slice(i, end < 0 ? input.length : end).trim();
      out.push({ meta: line });
      i = end < 0 ? input.length : end + 1;
      continue;
    }
    const c = input[i], two = input.slice(i, i + 2);
    if (c === "'" || c === '"') {
      const j = input.indexOf(c, i + 1);
      const k = j < 0 ? input.length : j + 1;
      buf += input.slice(i, k); i = k; continue;
    }
    if (two === "--") {
      const j = input.indexOf("\n", i);
      const k = j < 0 ? input.length : j;
      buf += input.slice(i, k); i = k; continue;
    }
    if (two === "/*") {
      const j = input.indexOf("*/", i + 2);
      const k = j < 0 ? input.length : j + 2;
      buf += input.slice(i, k); i = k; continue;
    }
    if (c === "$") {
      const m = input.slice(i).match(/^\$[A-Za-z_]*\$/);
      if (m) {
        const j = input.indexOf(m[0], i + m[0].length);
        const k = j < 0 ? input.length : j + m[0].length;
        buf += input.slice(i, k); i = k; continue;
      }
    }
    if (c === ";") { buf += c; i++; flush(); continue; }
    buf += c; i++;
  }
  flush();
  return out;
}

// True when the statement is only comments (psql prints nothing for it).
const onlyComments = (s) => !s.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/;/g, "").trim();

// ---------- formatting ----------
const pad = (s, w, right) => right ? s.padStart(w) : s.padEnd(w);
const center = (s, w) => { const l = Math.floor((w - s.length) / 2); return " ".repeat(l) + s + " ".repeat(w - s.length - l); };

export function table(fields, rows, { title, footer = true } = {}) {
  const names = fields.map((f) => f.name);
  const right = fields.map((f) => RIGHT.has(f.dataTypeID));
  const cells = rows.map((r) => fields.map((f) => (r[f.name] ?? "") + ""));
  const w = names.map((n, c) => Math.max(n.length, ...cells.map((r) => r[c].length)));
  const lines = [];
  const header = " " + names.map((n, c) => center(n, w[c])).join(" | ") + " ";
  if (title) lines.push(center(title, header.length).replace(/\s+$/, ""));
  lines.push(header);
  lines.push(w.map((x) => "-".repeat(x + 2)).join("+"));
  for (const r of cells) {
    const last = r.length - 1;
    lines.push(" " + r.map((v, c) => c === last && !right[c] ? v : pad(v, w[c], right[c])).join(" | "));
  }
  if (footer) lines.push(`(${rows.length} ${rows.length === 1 ? "row" : "rows"})`);
  return lines.join("\n");
}

// The status line psql prints after a statement without a result table (INSERT 0 1, CREATE TABLE, ...).
export function tag(sql, res) {
  const words = sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "").trim().split(/\s+/).map((x) => x.toUpperCase());
  const n = res.affectedRows ?? 0;
  const [a, b] = words;
  if (a === "INSERT") return `INSERT 0 ${n}`;
  if (a === "UPDATE" || a === "DELETE" || a === "MERGE") return `${a} ${n}`;
  if (a === "SELECT" || a === "WITH" || a === "VALUES" || a === "TABLE") return `SELECT ${res.rows.length}`;
  if (a === "BEGIN" || a === "START") return "BEGIN";
  if (a === "END") return "COMMIT";
  if (a === "ABORT") return "ROLLBACK";
  if (["CREATE", "DROP", "ALTER"].includes(a)) {
    const kinds = ["TABLE", "INDEX", "VIEW", "SEQUENCE", "SCHEMA", "FUNCTION", "TYPE", "EXTENSION", "TRIGGER", "DATABASE"];
    let k = words.slice(1).find((x) => kinds.includes(x));
    if (words.slice(1, 4).join(" ").includes("MATERIALIZED")) k = "MATERIALIZED VIEW";
    return k ? `${a} ${k}` : a;
  }
  return a.replace(/;$/, "");
}

export function error(e, sql) {
  const lines = [`ERROR:  ${e.message}`];
  const pos = Number(e.position);
  if (pos && sql) {
    // psql: "LINE n: <text of that line>" and a caret under the error position
    const before = sql.slice(0, pos - 1);
    const lineNo = before.split("\n").length;
    const lineText = sql.split("\n")[lineNo - 1];
    const col = before.length - before.lastIndexOf("\n") - 1;
    const prefix = `LINE ${lineNo}: `;
    lines.push(prefix + lineText, " ".repeat(prefix.length + col) + "^");
  }
  if (e.detail) lines.push(`DETAIL:  ${e.detail}`);
  if (e.hint) lines.push(`HINT:  ${e.hint}`);
  return lines.join("\n");
}

// ---------- meta-commands ----------
const q = async (db, sql, params) => (await db.query(sql, params, { parsers: await rawParsersFor(db) })).rows;

async function listTables(db) {
  const rows = await q(db, `SELECT n.nspname AS "Schema", c.relname AS "Name", 'table' AS "Type", pg_get_userbyid(c.relowner) AS "Owner"
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r','p') AND n.nspname = 'public' ORDER BY 2`);
  if (!rows.length) return "Did not find any relations.";
  const f = ["Schema", "Name", "Type", "Owner"].map((name) => ({ name, dataTypeID: 25 }));
  return table(f, rows, { title: "List of relations" });
}

async function describe(db, name) {
  const rel = (await q(db, `SELECT c.oid, n.nspname, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r','p') AND c.relname = $1 AND n.nspname NOT IN ('pg_catalog','information_schema')`, [name.replace(/^public\./, "")]))[0];
  if (!rel) return `Did not find any relation named "${name}".`;
  const cols = await q(db, `SELECT a.attname AS "Column", format_type(a.atttypid, a.atttypmod) AS "Type",
      coalesce((SELECT collname FROM pg_collation co WHERE co.oid = a.attcollation AND a.attcollation <> t.typcollation), '') AS "Collation",
      CASE WHEN a.attnotnull THEN 'not null' ELSE '' END AS "Nullable",
      coalesce(pg_get_expr(d.adbin, d.adrelid), '') AS "Default"
    FROM pg_attribute a JOIN pg_type t ON t.oid = a.atttypid
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = $1 AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`, [rel.oid]);
  const f = ["Column", "Type", "Collation", "Nullable", "Default"].map((n) => ({ name: n, dataTypeID: 25 }));
  const out = [table(f, cols, { title: `Table "${rel.nspname}.${rel.relname}"`, footer: false })];

  const idx = await q(db, `SELECT i.relname AS name, x.indisprimary AS pk, x.indisunique AS uq,
      pg_get_indexdef(x.indexrelid) AS def,
      EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = x.indexrelid AND k.contype = 'u') AS ucon
    FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid WHERE x.indrelid = $1 ORDER BY x.indisprimary DESC, i.relname`, [rel.oid]);
  if (idx.length) {
    out.push("Indexes:");
    for (const i of idx) {
      const how = i.def.replace(/^.* USING /, "");
      const yes = (v) => v === true || v === "t" || v === "true";
      const kind = yes(i.pk) ? "PRIMARY KEY, " : yes(i.ucon) ? "UNIQUE CONSTRAINT, " : yes(i.uq) ? "UNIQUE, " : "";
      out.push(`    "${i.name}" ${kind}${how}`);
    }
  }
  const checks = await q(db, `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = $1 AND contype = 'c' ORDER BY 1`, [rel.oid]);
  if (checks.length) { out.push("Check constraints:"); for (const c of checks) out.push(`    "${c.conname}" ${c.def}`); }
  const fks = await q(db, `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = $1 AND contype = 'f' ORDER BY 1`, [rel.oid]);
  if (fks.length) { out.push("Foreign-key constraints:"); for (const c of fks) out.push(`    "${c.conname}" ${c.def}`); }
  const refs = await q(db, `SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE confrelid = $1 AND contype = 'f' ORDER BY 1, 2`, [rel.oid]);
  if (refs.length) { out.push("Referenced by:"); for (const c of refs) out.push(`    TABLE "${c.tbl}" CONSTRAINT "${c.conname}" ${c.def}`); }
  return out.join("\n");
}

export const HELP = `Commands you can use here:
  \\dt              list the tables
  \\d               list the tables
  \\d NAME          show the structure of table NAME (columns, types, keys)
  \\?               show this help
Everything else is sent to PostgreSQL. End each statement with ;
Use the Reset button to get the original shop data back.`;

async function meta(db, line) {
  const [cmd, arg] = line.split(/\s+/);
  if (cmd === "\\?" || cmd === "\\h" || cmd === "\\help") return HELP;
  if (cmd === "\\dt" || cmd === "\\dt+" || (cmd === "\\d" && !arg)) return listTables(db);
  if (cmd === "\\d" || cmd === "\\d+") return describe(db, arg);
  if (cmd === "\\q") return "(This is a web page: there is nothing to quit. Close the tab when you are done.)";
  return `invalid command ${cmd}\nTry \\? for help.`;
}

// ---------- run ----------
// The statement as echoed in the log: without leading comment lines (they belong to the line before).
const shown = (sql) => sql.replace(/^(\s*--[^\n]*\n)+/, "").trim();

// Runs everything in `input` and returns [{cmd, out, ok}] - one entry per statement, like psql would print them.
export async function run(db, input) {
  const steps = [];
  for (const s of split(input)) {
    if (s.meta) { steps.push({ cmd: s.meta, out: await meta(db, s.meta), ok: true }); continue; }
    if (onlyComments(s.sql)) continue;
    try {
      const res = await db.query(s.sql, [], { parsers: await rawParsersFor(db) });
      const out = res.fields.length ? table(res.fields, res.rows) : tag(s.sql, res);
      steps.push({ cmd: shown(s.sql), out, ok: true });
    } catch (e) {
      steps.push({ cmd: shown(s.sql), out: error(e, s.sql), ok: false });
    }
  }
  return steps;
}
