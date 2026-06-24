ALTER TABLE barcodes ADD COLUMN product_code VARCHAR(50);

UPDATE barcodes b
SET product_code = p.code
FROM products p
WHERE b.product_id = p.id;

ALTER TABLE barcodes ALTER COLUMN product_code SET NOT NULL;

ALTER TABLE barcodes
    ADD CONSTRAINT fk_barcodes_product_code
        FOREIGN KEY (product_code) REFERENCES products(code) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE INDEX idx_barcodes_product_code ON barcodes(product_code);
