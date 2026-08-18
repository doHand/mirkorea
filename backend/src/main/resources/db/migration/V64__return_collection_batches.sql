ALTER TABLE return_collections ADD COLUMN batch_id UUID;
ALTER TABLE return_collections ADD COLUMN batch_no VARCHAR(40);

CREATE INDEX idx_return_collections_batch_id ON return_collections(batch_id);
CREATE INDEX idx_return_collections_batch_no ON return_collections(batch_no);
