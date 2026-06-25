UPDATE outbound_order_items
SET input_unit = 'OUT'
WHERE input_unit IN ('BOX', 'CXD_BOX');

UPDATE purchase_order_items
SET input_unit = 'OUT'
WHERE input_unit IN ('BOX', 'CXD_BOX');

UPDATE inbound_order_items
SET input_unit = 'OUT'
WHERE input_unit IN ('BOX', 'CXD_BOX');

UPDATE products
SET base_unit = 'OUT'
WHERE base_unit IN ('BOX', 'CXD_BOX');

UPDATE products
SET base_unit = 'IN'
WHERE base_unit IN ('P', 'CXD_IN');
