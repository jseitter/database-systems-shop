-- The shop's data. ids 1-3 and the first six orders are the episode 07 shop; customer ids 4-6 stay free:
-- in episode 07 the viewer adds the second Grace as customer 4, then themselves as 5 and a friend as 6.
INSERT INTO customers VALUES
  (1, 'Ada', 'London'), (2, 'Grace', 'New York'), (3, 'Edsger', 'Utrecht'),
  (7, 'Alan', 'London'), (8, 'Barbara', NULL), (9, 'Margaret', 'Boston'),
  (10, 'Linus', 'Helsinki'), (11, 'Katherine', NULL), (12, 'Tim', 'London');
INSERT INTO products VALUES
  (1, 'Notebook', 4.90, 'stationery'), (2, 'Pen', 1.20, 'stationery'), (3, 'Desk lamp', 24.00, 'home'),
  (4, 'Backpack', 39.90, 'travel'), (5, 'Mug', 7.50, 'home'), (6, 'Water bottle', 12.00, 'travel'),
  (7, 'Pencil case', 6.40, 'stationery'), (8, 'Headphones', 59.00, 'electronics'), (9, 'USB cable', 8.99, 'electronics'),
  (10, 'Gift card', 25.00, NULL);
INSERT INTO orders VALUES
  (1, 1, 1, 2, '2025-03-01'), (2, 1, 3, 1, '2025-03-04'), (3, 2, 2, 5, '2025-03-05'), (4, 2, 4, 1, '2025-03-09'),
  (5, 3, 1, 1, '2025-03-10'), (6, 3, 2, 3, '2025-03-10'), (7, 7, 8, 1, '2025-03-12'), (8, 8, 5, 2, '2025-03-15'),
  (9, 1, 9, 3, '2025-03-18'), (10, 9, 6, 1, '2025-03-21'), (11, 10, 4, 1, '2025-03-25'), (12, 12, 2, 10, '2025-03-28'),
  (13, 2, 1, 4, '2025-04-02'), (14, 11, 10, 1, '2025-04-05'), (15, 7, 3, 1, '2025-04-08'), (16, 3, 7, 2, '2025-04-11'),
  (17, 9, 8, 1, '2025-04-15'), (18, 1, 6, 2, '2025-04-20'), (19, 10, 9, 2, '2025-04-24'), (20, 8, 1, 3, '2025-04-30');
