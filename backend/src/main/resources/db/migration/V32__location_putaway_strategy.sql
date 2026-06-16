ALTER TABLE locations
    ADD COLUMN putaway_priority INT NOT NULL DEFAULT 100,
    ADD COLUMN pick_priority INT NOT NULL DEFAULT 100,
    ADD COLUMN allow_mixed_products BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE locations
    ADD CONSTRAINT chk_location_putaway_priority CHECK (putaway_priority >= 0),
    ADD CONSTRAINT chk_location_pick_priority CHECK (pick_priority >= 0);
