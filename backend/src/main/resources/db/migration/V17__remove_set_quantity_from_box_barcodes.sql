UPDATE barcodes
SET unit_qty = 1
WHERE type IN ('BOX', 'CXD');
