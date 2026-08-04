-- manager_id was never set or read anywhere in the app; column always NULL.
ALTER TABLE warehouses DROP COLUMN manager_id;
