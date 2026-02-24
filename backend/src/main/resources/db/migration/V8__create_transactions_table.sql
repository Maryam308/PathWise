CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    category_id UUID REFERENCES transaction_categories(id),
    plaid_transaction_id VARCHAR(100),
    merchant_name VARCHAR(150),
    amount DECIMAL(12,3),
    type VARCHAR(10),
    currency VARCHAR(3) DEFAULT 'BHD',
    transaction_date DATE NOT NULL,
    ai_category_raw TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);