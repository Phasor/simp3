-- Add time_unit column to chat_rules table
-- This allows creators to specify whether their access duration is in minutes, hours, or days

-- Add the time_unit column with a default of 'days' for backward compatibility
ALTER TABLE chat_rules 
ADD COLUMN IF NOT EXISTS time_unit TEXT DEFAULT 'days' CHECK (time_unit IN ('minutes', 'hours', 'days'));

-- Update existing rows to explicitly set 'days' as the unit
UPDATE chat_rules SET time_unit = 'days' WHERE time_unit IS NULL;

-- Make the column NOT NULL after setting defaults
ALTER TABLE chat_rules ALTER COLUMN time_unit SET NOT NULL;

-- Add a comment explaining the column
COMMENT ON COLUMN chat_rules.time_unit IS 'The unit of time for access_days field (minutes, hours, or days)';

-- Add an index for queries filtering by time_unit if needed
CREATE INDEX IF NOT EXISTS idx_chat_rules_time_unit ON chat_rules(time_unit);

-- Note: The 'access_days' column name is kept for backward compatibility
-- but it now represents the time value in whatever unit is specified by time_unit
COMMENT ON COLUMN chat_rules.access_days IS 'The duration of access in the unit specified by time_unit (despite the column name)';

