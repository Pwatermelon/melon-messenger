-- Beta access control
ALTER TABLE users ADD COLUMN IF NOT EXISTS beta_approved boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
