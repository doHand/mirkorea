UPDATE barcodes b
SET unit_qty = GREATEST(1, p.box_qty)
FROM products p
WHERE b.product_id = p.id
  AND b.type IN ('BOX', 'CXD')
  AND b.unit_qty = 1;
