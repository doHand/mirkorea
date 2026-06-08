-- Valid EAN-13 examples in the 29 internal-use range for scanner testing.
UPDATE barcodes
SET barcode = CASE barcode
    WHEN 'SAMPLE-CXD-EA-001' THEN '2900000000018'
    WHEN 'SAMPLE-CXD-INBOX-001' THEN '2900000000025'
    WHEN 'SAMPLE-CXD-BOX-001' THEN '2900000000032'
    ELSE barcode
END
WHERE barcode IN (
    'SAMPLE-CXD-EA-001',
    'SAMPLE-CXD-INBOX-001',
    'SAMPLE-CXD-BOX-001'
);
