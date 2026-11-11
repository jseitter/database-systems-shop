// Compares the playground's output with transcripts captured from real psql.
// Run: node test/check.mjs <path to transcripts/*.json>   (needs: npm i @electric-sql/pglite)
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import { run } from "../psql.js";
const here = new URL("..", import.meta.url).pathname;
let fail = 0;
for (const file of process.argv.slice(2)) {
  const db = new PGlite();
  await db.exec(fs.readFileSync(here + "shop/schema.sql", "utf8") + fs.readFileSync(here + "shop/seed.sql", "utf8"));
  const t = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const st of t.steps) {
    const got = (await run(db, st.cmd)).map((s) => s.out).join("\n");
    if (got === st.out) console.log("ok  ", st.cmd);
    else { fail++; console.log("DIFF", st.cmd, "\n--- psql\n" + st.out + "\n--- playground\n" + got); }
  }
}
process.exit(fail ? 1 : 0);
