-- Add source column to Lead table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Lead' AND column_name = 'source'
  ) THEN
    ALTER TABLE "Lead" ADD COLUMN "source" TEXT DEFAULT 'other';
  END IF;
END $$;

-- Update existing NULL sources to 'other'
UPDATE "Lead" SET "source" = 'other' WHERE "source" IS NULL;

-- Ensure default is set for future inserts
ALTER TABLE "Lead" ALTER COLUMN "source" SET DEFAULT 'other';






