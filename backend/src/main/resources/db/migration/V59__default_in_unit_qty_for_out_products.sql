UPDATE products
SET in_unit_qty = 1
WHERE in_unit_qty IS NULL
  AND COALESCE(out_unit_qty, out_qty) IS NOT NULL
  AND COALESCE(out_unit_qty, out_qty) > 0;
