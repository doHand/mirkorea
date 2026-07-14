WITH ranked AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY product_id
               ORDER BY created_at DESC, id DESC
           ) AS rn
    FROM barcodes
    WHERE is_primary = true
)
UPDATE barcodes b
SET is_primary = false
FROM ranked r
WHERE b.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_barcodes_primary_per_product
    ON barcodes(product_id)
    WHERE is_primary = true;
