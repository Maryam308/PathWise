CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    plaid_account_id VARCHAR(100),
    bank_name VARCHAR(100),
    account_type VARCHAR(50),
    balance DECIMAL(12,3),
    currency VARCHAR(3) DEFAULT 'BHD',
    masked_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);