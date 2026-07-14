UPDATE barcodes b
SET unit_qty = CASE
  WHEN b.type = 'UNIT' THEN 1
  WHEN b.type = 'CXD' THEN COALESCE(NULLIF(p.in_unit_qty, 0), 1)
  WHEN b.type = 'CXD_OUT' THEN COALESCE(NULLIF(p.out_unit_qty, 0), NULLIF(p.out_qty, 0), b.unit_qty)
  ELSE b.unit_qty
END
FROM products p
WHERE b.product_id = p.id
  AND (
    (b.type = 'UNIT' AND b.unit_qty <> 1)
    OR (b.type = 'CXD' AND p.in_unit_qty IS NOT NULL AND p.in_unit_qty > 0 AND b.unit_qty <> p.in_unit_qty)
    OR (b.type = 'CXD_OUT'
      AND COALESCE(NULLIF(p.out_unit_qty, 0), NULLIF(p.out_qty, 0)) IS NOT NULL
      AND b.unit_qty <> COALESCE(NULLIF(p.out_unit_qty, 0), NULLIF(p.out_qty, 0)))
  );
