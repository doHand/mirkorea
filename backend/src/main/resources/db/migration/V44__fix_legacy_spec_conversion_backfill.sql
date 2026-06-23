UPDATE products
SET box_unit_qty = (regexp_match(spec, '([0-9]+)[[:space:]]*EA[[:space:]]*/[[:space:]]*BOX', 'i'))[1]::INT
WHERE spec ~* '[0-9]+[[:space:]]*EA[[:space:]]*/[[:space:]]*BOX';

-- Keep legacy outbound history aligned with the corrected product conversion value.
UPDATE outbound_order_items oi
SET conversion_qty = p.box_unit_qty,
    converted_ea_qty = oi.input_qty * p.box_unit_qty
FROM products p
WHERE oi.product_id = p.id AND oi.input_unit = 'BOX';
