ALTER TABLE barcodes DROP CONSTRAINT IF EXISTS barcodes_type_check;
ALTER TABLE barcodes
    ADD CONSTRAINT barcodes_type_check
    CHECK (type IN ('UNIT', 'BOX', 'CXD', 'CXD_BOX'));

DO $$
DECLARE
    sample_product UUID := '10000000-0000-0000-0000-000000000019';
    warehouse UUID := '00000000-0000-0000-0000-000000000001';
    sample_location UUID;
    admin_user UUID;
BEGIN
    SELECT id INTO sample_location FROM locations WHERE code = 'A-01-01-01' LIMIT 1;
    SELECT id INTO admin_user FROM users WHERE username = 'admin' LIMIT 1;

    INSERT INTO products (
        id, code, name, category, unit, box_qty, safety_stock, reorder_point,
        cost_price, sell_price, sale_status, created_by, spec
    ) VALUES (
        sample_product, 'SAMPLE-CXD-001', 'CXD 바코드 예시상품', '예시', 'EA', 50, 10, 20,
        1000, 1500, 'ACTIVE', admin_user, 'INBOX 5EA / BOX 10INBOX'
    ) ON CONFLICT (code) DO UPDATE SET
        box_qty = EXCLUDED.box_qty,
        spec = EXCLUDED.spec;

    INSERT INTO barcodes (product_id, barcode, type, unit_qty, is_primary)
    VALUES
        (sample_product, 'SAMPLE-CXD-EA-001', 'UNIT', 1, true),
        (sample_product, 'SAMPLE-CXD-INBOX-001', 'CXD', 5, false),
        (sample_product, 'SAMPLE-CXD-BOX-001', 'CXD_BOX', 10, false)
    ON CONFLICT (barcode) DO UPDATE SET
        type = EXCLUDED.type,
        unit_qty = EXCLUDED.unit_qty;

    IF sample_location IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM inventory WHERE product_id = sample_product AND warehouse_id = warehouse
    ) THEN
        INSERT INTO inventory (product_id, location_id, warehouse_id, quantity, reserved_qty)
        VALUES (sample_product, sample_location, warehouse, 125, 0);
    END IF;
END $$;
