-- up migration

ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_reviewed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_reviewed_by TEXT;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_approval_status_check;
ALTER TABLE users
ADD CONSTRAINT users_approval_status_check
CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_approval_reviewed_by_fkey;
ALTER TABLE users
ADD CONSTRAINT users_approval_reviewed_by_fkey
FOREIGN KEY (approval_reviewed_by) REFERENCES users(id) ON DELETE SET NULL;

UPDATE users
SET approval_status = 'approved'
WHERE approval_status IS NULL OR TRIM(approval_status) = '';

UPDATE users
SET approval_reviewed_at = COALESCE(approval_reviewed_at, created_at, CURRENT_TIMESTAMP)
WHERE approval_status = 'approved' AND approval_reviewed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_approval_status ON users(approval_status);
CREATE INDEX IF NOT EXISTS idx_users_approval_reviewed_by ON users(approval_reviewed_by);

-- down migration

DROP INDEX IF EXISTS idx_users_approval_reviewed_by;
DROP INDEX IF EXISTS idx_users_approval_status;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_approval_reviewed_by_fkey;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_approval_status_check;

ALTER TABLE users DROP COLUMN IF EXISTS approval_reviewed_by;
ALTER TABLE users DROP COLUMN IF EXISTS approval_reviewed_at;
ALTER TABLE users DROP COLUMN IF EXISTS approval_status;
