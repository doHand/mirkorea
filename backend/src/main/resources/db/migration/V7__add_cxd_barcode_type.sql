-- 바코드 타입을 UNIT(일반낱개), BOX(박스), CXD(CXD낱개) 3종으로 변경
DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'barcodes'::regclass
    AND contype = 'c';
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE barcodes DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

ALTER TABLE barcodes
  ADD CONSTRAINT barcodes_type_check
    CHECK (type IN ('UNIT', 'BOX', 'CXD'));
