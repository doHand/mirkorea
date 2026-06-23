-- Some legacy rows keep the authoritative EA-per-BOX value in spec (for example, 12EA/BOX).
UPDATE products
SET box_unit_qty = (regexp_match(spec, '([0-9]+)\\s*EA\\s*/\\s*BOX', 'i'))[1]::INT
WHERE spec ~* '[0-9]+\\s*EA\\s*/\\s*BOX';
