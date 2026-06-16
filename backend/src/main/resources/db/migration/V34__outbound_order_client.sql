ALTER TABLE outbound_orders
    ADD COLUMN client_id UUID REFERENCES clients(id);

CREATE INDEX idx_outbound_orders_client ON outbound_orders(client_id);

UPDATE outbound_orders o
SET client_id = c.id
FROM clients c
WHERE o.client_id IS NULL
  AND LOWER(TRIM(o.customer)) = LOWER(TRIM(c.name))
  AND (SELECT COUNT(*) FROM clients c2 WHERE LOWER(TRIM(c2.name)) = LOWER(TRIM(o.customer))) = 1;
