CREATE TABLE goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    target_amount DECIMAL(12,3) NOT NULL,
    saved_amount DECIMAL(12,3) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'BHD',
    deadline DATE NOT NULL,
    priority VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'ON_TRACK',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);