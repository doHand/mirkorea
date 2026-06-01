CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- USERS
-- ================================================================
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      VARCHAR(50)  UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(100) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'WORKER'
                CHECK (role IN ('ADMIN','MANAGER','WORKER','VIEWER')),
  warehouse_id  UUID,
  is_active     BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- WAREHOUSES / ZONES / LOCATIONS
-- ================================================================
CREATE TABLE warehouses (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code      VARCHAR(20)  UNIQUE NOT NULL,
  name      VARCHAR(200) NOT NULL,
  address   TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE zones (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  code         VARCHAR(20) NOT NULL,
  name         VARCHAR(100) NOT NULL,
  type         VARCHAR(20) NOT NULL DEFAULT 'STORAGE'
               CHECK (type IN ('STORAGE','RECEIVING','SHIPPING','STAGING','DAMAGED')),
  is_active    BOOLEAN DEFAULT true,
  UNIQUE(warehouse_id, code)
);

CREATE TABLE locations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  zone_id      UUID NOT NULL REFERENCES zones(id),
  code         VARCHAR(50) NOT NULL,
  aisle        VARCHAR(10),
  rack         VARCHAR(10),
  shelf        VARCHAR(10),
  bin          VARCHAR(10),
  barcode      VARCHAR(100) UNIQUE,
  capacity_unit INTEGER DEFAULT 9999,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_id, code)
);

CREATE INDEX idx_locations_barcode ON locations(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_locations_zone    ON locations(zone_id);

-- ================================================================
-- PRODUCTS
-- ================================================================
CREATE TABLE products (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code              VARCHAR(100) UNIQUE NOT NULL,
  name              VARCHAR(300) NOT NULL,
  description       TEXT,
  category          VARCHAR(100),
  brand             VARCHAR(100),
  unit              VARCHAR(20)  DEFAULT 'EA',
  box_unit          INTEGER      DEFAULT 1,
  weight_g          INTEGER,
  image_url         TEXT,
  safety_stock      INTEGER DEFAULT 0,
  reorder_point     INTEGER DEFAULT 0,
  reorder_qty       INTEGER DEFAULT 0,
  sale_status       VARCHAR(20) DEFAULT 'ACTIVE'
                    CHECK (sale_status IN ('ACTIVE','INACTIVE','DISCONTINUED')),
  cost_price        DECIMAL(15,4),
  sell_price        DECIMAL(15,4),
  is_lot_managed    BOOLEAN DEFAULT false,
  is_expiry_managed BOOLEAN DEFAULT false,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_code     ON products(code);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_status   ON products(sale_status);

-- ================================================================
-- BARCODES (products 1:N)
-- ================================================================
CREATE TABLE barcodes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  barcode    VARCHAR(100) UNIQUE NOT NULL,
  type       VARCHAR(20)  NOT NULL DEFAULT 'UNIT'
             CHECK (type IN ('UNIT','BOX','PALLET','INNER')),
  unit_qty   INTEGER NOT NULL DEFAULT 1,
  is_primary BOOLEAN DEFAULT false,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_barcodes_barcode    ON barcodes(barcode) WHERE is_active = true;
CREATE INDEX idx_barcodes_product_id ON barcodes(product_id);

-- ================================================================
-- STOCK TRANSACTIONS (원장 — append-only)
-- ================================================================
CREATE TABLE stock_transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID NOT NULL REFERENCES products(id),
  location_id     UUID NOT NULL REFERENCES locations(id),
  warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
  qty             INTEGER NOT NULL CHECK (qty != 0),
  qty_before      INTEGER NOT NULL,
  qty_after       INTEGER NOT NULL,
  tx_type         VARCHAR(30) NOT NULL
                  CHECK (tx_type IN (
                    'INBOUND','INBOUND_CANCEL',
                    'OUTBOUND','OUTBOUND_CANCEL',
                    'ADJUST_INCREASE','ADJUST_DECREASE',
                    'MOVE_OUT','MOVE_IN','INITIAL'
                  )),
  reference_type  VARCHAR(30),
  reference_id    UUID,
  lot_number      VARCHAR(100),
  expiry_date     DATE,
  reason          TEXT,
  barcode_scanned VARCHAR(100),
  unit_qty        INTEGER DEFAULT 1,
  scan_count      INTEGER DEFAULT 1,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stx_product_location ON stock_transactions(product_id, location_id);
CREATE INDEX idx_stx_warehouse_date   ON stock_transactions(warehouse_id, created_at DESC);
CREATE INDEX idx_stx_tx_type          ON stock_transactions(tx_type);
CREATE INDEX idx_stx_reference        ON stock_transactions(reference_type, reference_id);

-- ================================================================
-- INVENTORY CACHE (성능용 집계 캐시)
-- ================================================================
CREATE TABLE inventory_cache (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id   UUID NOT NULL REFERENCES products(id),
  location_id  UUID NOT NULL REFERENCES locations(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  qty          INTEGER NOT NULL DEFAULT 0,
  lot_number   VARCHAR(100),
  expiry_date  DATE,
  last_tx_id   UUID REFERENCES stock_transactions(id),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, location_id, COALESCE(lot_number, ''))
);

CREATE INDEX idx_inv_product   ON inventory_cache(product_id);
CREATE INDEX idx_inv_location  ON inventory_cache(location_id);
CREATE INDEX idx_inv_warehouse ON inventory_cache(warehouse_id);

-- ================================================================
-- INBOUND ORDERS
-- ================================================================
CREATE TABLE inbound_orders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_no      VARCHAR(50) UNIQUE NOT NULL,
  warehouse_id  UUID NOT NULL REFERENCES warehouses(id),
  supplier_name VARCHAR(200),
  supplier_code VARCHAR(100),
  status        VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETED','PARTIAL','CANCELLED')),
  expected_date DATE,
  completed_at  TIMESTAMPTZ,
  memo          TEXT,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inbound_order_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id     UUID NOT NULL REFERENCES inbound_orders(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id),
  ordered_qty  INTEGER NOT NULL CHECK (ordered_qty > 0),
  received_qty INTEGER NOT NULL DEFAULT 0,
  unit_price   DECIMAL(15,4),
  lot_number   VARCHAR(100),
  expiry_date  DATE,
  location_id  UUID REFERENCES locations(id),
  status       VARCHAR(20) DEFAULT 'PENDING'
               CHECK (status IN ('PENDING','PARTIAL','COMPLETED','CANCELLED'))
);

-- ================================================================
-- OUTBOUND ORDERS
-- ================================================================
CREATE TABLE outbound_orders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_no      VARCHAR(50) UNIQUE NOT NULL,
  warehouse_id  UUID NOT NULL REFERENCES warehouses(id),
  customer_name VARCHAR(200),
  customer_code VARCHAR(100),
  channel       VARCHAR(50) DEFAULT 'MANUAL',
  status        VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING','PICKING','PACKING','SHIPPED','PARTIAL','CANCELLED')),
  priority      SMALLINT DEFAULT 0,
  due_date      DATE,
  shipped_at    TIMESTAMPTZ,
  tracking_no   VARCHAR(100),
  memo          TEXT,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE outbound_order_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES outbound_orders(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id),
  ordered_qty INTEGER NOT NULL CHECK (ordered_qty > 0),
  picked_qty  INTEGER NOT NULL DEFAULT 0,
  shipped_qty INTEGER NOT NULL DEFAULT 0,
  location_id UUID REFERENCES locations(id),
  lot_number  VARCHAR(100),
  status      VARCHAR(20) DEFAULT 'PENDING'
              CHECK (status IN ('PENDING','PICKING','COMPLETED','SHORT','CANCELLED'))
);

CREATE INDEX idx_outbound_status ON outbound_orders(warehouse_id, status)
  WHERE status IN ('PENDING','PICKING');

-- ================================================================
-- STOCK ADJUSTMENTS
-- ================================================================
CREATE TABLE stock_adjustments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  adj_no        VARCHAR(50) UNIQUE NOT NULL,
  warehouse_id  UUID NOT NULL REFERENCES warehouses(id),
  reason_type   VARCHAR(30) NOT NULL
                CHECK (reason_type IN ('STOCKTAKING','DAMAGE','LOSS','FOUND','EXPIRY','OTHER')),
  reason_detail TEXT,
  status        VARCHAR(20) DEFAULT 'DRAFT'
                CHECK (status IN ('DRAFT','APPROVED','REJECTED','APPLIED')),
  approved_by   UUID REFERENCES users(id),
  approved_at   TIMESTAMPTZ,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stock_adjustment_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  adjustment_id UUID NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id),
  location_id   UUID NOT NULL REFERENCES locations(id),
  qty_system    INTEGER NOT NULL,
  qty_actual    INTEGER NOT NULL,
  lot_number    VARCHAR(100)
);

-- ================================================================
-- LOCATION MOVES
-- ================================================================
CREATE TABLE location_moves (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  move_no          VARCHAR(50) UNIQUE NOT NULL,
  warehouse_id     UUID NOT NULL REFERENCES warehouses(id),
  product_id       UUID NOT NULL REFERENCES products(id),
  from_location_id UUID NOT NULL REFERENCES locations(id),
  to_location_id   UUID NOT NULL REFERENCES locations(id),
  qty              INTEGER NOT NULL CHECK (qty > 0),
  lot_number       VARCHAR(100),
  memo             TEXT,
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- UPDATED_AT 트리거
-- ================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at     BEFORE UPDATE ON users         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated_at  BEFORE UPDATE ON products      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_inbound_updated_at   BEFORE UPDATE ON inbound_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_outbound_updated_at  BEFORE UPDATE ON outbound_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
