ALTER TABLE products ADD COLUMN IF NOT EXISTS in_unit_qty INT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS out_unit_qty INT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS out_qty INT NOT NULL DEFAULT 1;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS out_count INT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'p_unit_qty'
  ) THEN
    EXECUTE 'UPDATE products SET in_unit_qty = p_unit_qty WHERE in_unit_qty IS NULL AND p_unit_qty IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'box_unit_qty'
  ) THEN
    EXECUTE 'UPDATE products SET out_unit_qty = box_unit_qty WHERE out_unit_qty IS NULL AND box_unit_qty IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'box_qty'
  ) THEN
    EXECUTE 'UPDATE products SET out_qty = box_qty WHERE box_qty IS NOT NULL AND box_qty > 0';
    EXECUTE 'UPDATE products SET out_unit_qty = box_qty WHERE out_unit_qty IS NULL AND box_qty IS NOT NULL AND box_qty > 0';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_order_items' AND column_name = 'box_count'
  ) THEN
    EXECUTE 'UPDATE purchase_order_items SET out_count = box_count WHERE out_count = 0 AND box_count IS NOT NULL';
  END IF;
END $$;

ALTER TABLE barcodes DROP CONSTRAINT IF EXISTS barcodes_type_check;

UPDATE barcodes SET type = 'CXD_OUT' WHERE type IN ('BOX', 'CXD_BOX');

ALTER TABLE barcodes ADD CONSTRAINT barcodes_type_check
  CHECK (type IN ('UNIT', 'CXD', 'CXD_OUT'));

ALTER TABLE products DROP COLUMN IF EXISTS p_unit_qty;
ALTER TABLE products DROP COLUMN IF EXISTS box_unit_qty;
ALTER TABLE products DROP COLUMN IF EXISTS pl_unit_qty;
ALTER TABLE products DROP COLUMN IF EXISTS box_qty;
