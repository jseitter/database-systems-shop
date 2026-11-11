// Prints a psql-like session for inputs that have no captured transcript yet (eyeball check).
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import { run } from "../psql.js";
const here = new URL("..", import.meta.url).pathname;
const db = new PGlite();
await db.exec(fs.readFileSync(here + "shop/schema.sql", "utf8") + fs.readFileSync(here + "shop/seed.sql", "utf8"));
const input = `\\dt
SELECT * FROM products;
SELECT * FROM orders WHERE id < 3;  -- comment; with semicolon
INSERT INTO customers VALUES (4, 'Grace', 'London');
INSERT INTO customers VALUES (NULL, 'Linus', 'Helsinki');
INSERT INTO products VALUES (5, 'Mug', 'cheap', 'home');
SELEC * FROM customers;
SELECT count(*), true AS b, NULL AS n FROM customers;
UPDATE customers SET city = 'Paris' WHERE id = 4;
\\d orders
\\d nope
\\x`;
for (const s of await run(db, input)) console.log("shop=# " + s.cmd + "\n" + s.out + "\n");
