# Database Systems: the shop database

The follow-along database for the **Database Systems** lectures: a small online shop with three tables
(`customers`, `products`, `orders`). Every query in the lectures runs against exactly this data, so what you see
in the video is what you get at home.

## The easy way: in your browser

**[Open the shop playground](https://jseitter.github.io/database-systems-shop/)**

Real PostgreSQL, running inside your browser ([PGlite](https://pglite.dev)). Nothing to install, nothing leaves
your computer. Pick the lecture and run its queries step by step, or type your own.
`\d customers` and `\dt` work like in psql. **Reset database** brings back the original data.

Link straight to a lecture with `?ep=07`, or run a query on open with `?run=SELECT%20*%20FROM%20customers;`.

## The real thing: PostgreSQL on your computer

### With Docker

From this folder:

```sh
docker run -d --name shop -e POSTGRES_PASSWORD=shop -e POSTGRES_DB=shop \
  -v "$PWD/shop:/docker-entrypoint-initdb.d:ro" postgres:17
docker exec -it shop psql -U postgres -d shop
```

The two files in `shop/` are loaded on the first start (in name order: `schema.sql`, then `seed.sql`).
To start over with fresh data: `docker rm -f shop` and run the first command again.

### With an existing PostgreSQL

```sh
createdb shop
psql -d shop -f shop/schema.sql -f shop/seed.sql
psql -d shop
```

To start over: `dropdb shop` and repeat.

## What is in here

| File | What it is |
|---|---|
| `shop/schema.sql` | the tables |
| `shop/seed.sql` | the data |
| `index.html`, `app.js`, `psql.js` | the browser playground (static files, no build step) |
| `examples.json` | the queries of each lecture, shown in the playground |
| `test/check.mjs` | compares the playground's output with output captured from real `psql` |

## Differences from psql

The playground prints results in psql's format and is checked against real psql output, but it is not psql:

- Only the meta-commands `\d`, `\d NAME`, `\dt` and `\?` are available.
- It runs PostgreSQL 18 (the lectures show PostgreSQL 17). For everything in the lectures the results are the same.
- The data lives in your browser tab: reloading the page starts again with fresh data.

## Licence

The code is under the [MIT licence](LICENSE). The shop data in `shop/` is public domain ([CC0 1.0](shop/LICENSE)):
use it for anything, no credit needed.
