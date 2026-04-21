ALTER TABLE robot_package_versions
  ADD COLUMN IF NOT EXISTS full_file_name TEXT;

ALTER TABLE robot_package_versions
  ADD COLUMN IF NOT EXISTS full_file_size INTEGER;

ALTER TABLE robot_package_versions
  ADD COLUMN IF NOT EXISTS full_file_hash TEXT;
