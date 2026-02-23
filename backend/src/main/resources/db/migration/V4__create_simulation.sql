CREATE TABLE simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    goal_id UUID NOT NULL REFERENCES goals(id),
    name VARCHAR(100),
    adjustments JSONB NOT NULL,
    baseline_date DATE NOT NULL,
    simulated_date DATE NOT NULL,
    months_saved INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);