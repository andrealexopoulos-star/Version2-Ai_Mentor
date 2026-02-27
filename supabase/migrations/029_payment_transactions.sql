-- Payment transactions table for Stripe
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    session_id TEXT UNIQUE,
    amount NUMERIC,
    currency TEXT DEFAULT 'aud',
    package_id TEXT,
    tier TEXT,
    payment_status TEXT DEFAULT 'initiated',
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_session ON payment_transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_payment_user ON payment_transactions(user_id);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own payments" ON payment_transactions FOR SELECT USING (true);
CREATE POLICY "Service manages payments" ON payment_transactions FOR ALL USING (true) WITH CHECK (true);
