-- Yandex OAuth + Platinum tier
ALTER TABLE users ADD COLUMN IF NOT EXISTS yandex_id varchar(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier varchar(20) NOT NULL DEFAULT 'free';
CREATE UNIQUE INDEX IF NOT EXISTS users_yandex_id_unique ON users (yandex_id) WHERE yandex_id IS NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
