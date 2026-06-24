-- BOX 타입 바코드를 CXD_BOX로 전환 후 타입 제약에서 BOX 제거
UPDATE barcodes SET type = 'CXD_BOX' WHERE type = 'BOX';

ALTER TABLE barcodes DROP CONSTRAINT IF EXISTS barcodes_type_check;
ALTER TABLE barcodes
    ADD CONSTRAINT barcodes_type_check
        CHECK (type IN ('UNIT', 'CXD', 'CXD_BOX'));
