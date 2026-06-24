ALTER TABLE outbound_orders
    ADD COLUMN shipped_at TIMESTAMPTZ;

ALTER TABLE outbound_orders
    DROP CONSTRAINT IF EXISTS chk_outbound_order_status;

ALTER TABLE outbound_orders
    ADD CONSTRAINT chk_outbound_order_status
        CHECK (status IN ('COLLECTED','INSTRUCTED','PICKED','SHIPPED','ON_HOLD','CANCELLED'));
