ALTER TABLE purchase_orders
    ADD COLUMN client_id UUID REFERENCES clients(id);

CREATE INDEX idx_purchase_orders_client ON purchase_orders(client_id);

UPDATE purchase_orders po
SET client_id = c.id
FROM clients c
WHERE po.client_id IS NULL
  AND po.supplier = c.name;
