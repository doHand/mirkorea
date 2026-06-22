CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    action VARCHAR(20) NOT NULL,
    target_type VARCHAR(80) NOT NULL,
    target_id VARCHAR(100),
    summary VARCHAR(500) NOT NULL,
    actor VARCHAR(100),
    request_path VARCHAR(300),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_target ON audit_logs (target_type, target_id);
