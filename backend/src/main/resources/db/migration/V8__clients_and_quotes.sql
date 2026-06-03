-- Client management
CREATE TABLE clients (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(200) NOT NULL,
    business_no   VARCHAR(50),
    address       TEXT,
    industry      VARCHAR(100),
    sector        VARCHAR(100),
    email         VARCHAR(200),
    phone         VARCHAR(50),
    fax           VARCHAR(50),
    manager_name  VARCHAR(100),
    manager_title VARCHAR(100),
    website       VARCHAR(500),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Statements / quote headers
CREATE TABLE quotes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_no       VARCHAR(50)  NOT NULL UNIQUE,
    doc_type     VARCHAR(20)  NOT NULL DEFAULT 'STATEMENT',
    client_id    UUID REFERENCES clients(id) ON DELETE SET NULL,
    client_name  VARCHAR(200),
    doc_date     DATE         NOT NULL,
    memo         TEXT,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    status       VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    created_by   UUID,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Statement / quote items
CREATE TABLE quote_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id      UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    product_id    UUID,
    product_code  VARCHAR(50),
    product_name  VARCHAR(200),
    unit          VARCHAR(20),
    qty           INT          NOT NULL DEFAULT 1,
    unit_price    DECIMAL(15,2) NOT NULL DEFAULT 0,
    amount        DECIMAL(15,2) NOT NULL DEFAULT 0,
    sort_order    INT          NOT NULL DEFAULT 0
);

CREATE INDEX idx_quotes_client_id     ON quotes(client_id);
CREATE INDEX idx_quotes_doc_type      ON quotes(doc_type);
CREATE INDEX idx_quote_items_quote_id ON quote_items(quote_id);
