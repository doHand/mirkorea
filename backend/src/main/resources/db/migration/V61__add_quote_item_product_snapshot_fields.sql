ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS spec VARCHAR(200);
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS in_unit_qty INT;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS out_unit_qty INT;

UPDATE quote_items qi
SET category = COALESCE(qi.category, p.category),
    spec = COALESCE(qi.spec, p.spec),
    in_unit_qty = COALESCE(qi.in_unit_qty, p.in_unit_qty),
    out_unit_qty = COALESCE(qi.out_unit_qty, p.out_unit_qty)
FROM products p
WHERE qi.product_id = p.id;

UPDATE quote_items qi
SET barcode = b.barcode
FROM barcodes b
WHERE qi.product_id = b.product_id
  AND qi.barcode IS NULL
  AND b.is_primary = true
  AND b.is_active = true;
