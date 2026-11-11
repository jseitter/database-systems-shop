-- Running example: a small online shop (see STORYBOARD.md). Loaded fresh for every transcript.
CREATE TABLE customers (
  id   integer PRIMARY KEY,
  name text NOT NULL,
  city text
);
CREATE TABLE products (
  id       integer PRIMARY KEY,
  name     text NOT NULL,
  price    numeric(8,2) NOT NULL,
  category text
);
CREATE TABLE orders (
  id          integer PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers(id),
  product_id  integer NOT NULL REFERENCES products(id),
  quantity    integer NOT NULL DEFAULT 1,
  ordered_on  date NOT NULL
);
