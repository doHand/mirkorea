ALTER TABLE outbound_orders
    ADD COLUMN order_type VARCHAR(20) NOT NULL DEFAULT 'EXTERNAL',
    ADD CONSTRAINT chk_outbound_order_type CHECK (order_type IN ('INTERNAL', 'EXTERNAL'));
