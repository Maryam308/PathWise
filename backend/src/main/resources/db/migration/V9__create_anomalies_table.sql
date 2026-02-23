CREATE TABLE anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    category_id UUID REFERENCES transaction_categories(id),
    transaction_id UUID REFERENCES transactions(id),
    severity VARCHAR(10) NOT NULL,
    message TEXT,
    actual_amount DECIMAL(12,3),
    baseline_amount DECIMAL(12,3),
    is_dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);