CREATE TABLE advice_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    context JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
