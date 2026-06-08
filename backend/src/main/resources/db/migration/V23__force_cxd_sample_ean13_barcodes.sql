-- Replace every barcode belonging to the CXD sample product by type.
-- This also covers databases where the original sample barcode labels were edited.
DO $$
DECLARE
    sample_product_id UUID;
BEGIN
    SELECT id INTO sample_product_id
    FROM products
    WHERE code = 'SAMPLE-CXD-001'
    LIMIT 1;

    IF sample_product_id IS NULL THEN
        RETURN;
    END IF;

    UPDATE barcodes
    SET barcode = '2900000000018'
    WHERE product_id = sample_product_id
      AND type = 'UNIT';

    UPDATE barcodes
    SET barcode = '2900000000025'
    WHERE product_id = sample_product_id
      AND type = 'CXD';

    UPDATE barcodes
    SET barcode = '2900000000032'
    WHERE product_id = sample_product_id
      AND type = 'CXD_BOX';
END $$;
