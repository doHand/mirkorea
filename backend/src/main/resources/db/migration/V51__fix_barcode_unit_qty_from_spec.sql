-- 바코드 구성수량을 상품 규격(spec)의 IN/OUT 숫자와 일치시킵니다.
-- spec 형식: "10IN / 12OUT"
--   UNIT    → unit_qty = 1
--   CXD     → unit_qty = IN 숫자
--   CXD_BOX → unit_qty = OUT 숫자

UPDATE barcodes b
SET unit_qty = CASE b.type
  WHEN 'UNIT' THEN 1
  WHEN 'CXD' THEN CAST(
    (regexp_match(p.spec, '^\s*(\d+)\s*IN\s*/\s*\d+\s*OUT\s*$', 'i'))[1] AS INTEGER
  )
  WHEN 'CXD_BOX' THEN CAST(
    (regexp_match(p.spec, '^\s*\d+\s*IN\s*/\s*(\d+)\s*OUT\s*$', 'i'))[1] AS INTEGER
  )
END
FROM products p
WHERE b.product_id = p.id
  AND p.spec ~ '^\s*\d+\s*IN\s*/\s*\d+\s*OUT\s*$';
