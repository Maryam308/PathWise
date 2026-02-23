CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    preferred_currency VARCHAR(3) DEFAULT 'BHD',
    created_at TIMESTAMP DEFAULT NOW()
);