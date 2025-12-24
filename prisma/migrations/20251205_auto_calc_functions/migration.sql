-- ============================================
-- 1. Function: calculate_moa
-- ============================================
CREATE OR REPLACE FUNCTION calculate_moa(
  arv NUMERIC,
  multiplier NUMERIC,
  repairs NUMERIC,
  assignment_fee NUMERIC
)
RETURNS NUMERIC AS $$
BEGIN
  IF arv IS NULL OR repairs IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN (arv * COALESCE(multiplier, 0.70))
         - repairs
         - COALESCE(assignment_fee, 10000);
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 2. Trigger Function: update_moa_trigger
-- Auto-calculates MOA before INSERT/UPDATE
-- ============================================
CREATE OR REPLACE FUNCTION update_moa_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.moa = calculate_moa(
    NEW.arv,
    NEW."investorMultiplier",
    NEW."estimatedRepairs",
    NEW."desiredAssignmentFee"
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 3. Install Trigger on Lead table
-- ============================================
DROP TRIGGER IF EXISTS trg_update_moa ON "Lead";

CREATE TRIGGER trg_update_moa
BEFORE INSERT OR UPDATE ON "Lead"
FOR EACH ROW
EXECUTE FUNCTION update_moa_trigger();


-- ============================================
-- 4. Trigger Function: log_pipeline_change
-- Stores previous → next status transitions
-- ============================================
CREATE OR REPLACE FUNCTION log_pipeline_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO "PipelineHistory"(
      id, "leadId", "oldStatus", "newStatus", "changedAt"
    )
    VALUES (
      gen_random_uuid()::text,
      NEW.id,
      OLD.status,
      NEW.status,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 5. Install Trigger on Lead table
-- ============================================
DROP TRIGGER IF EXISTS trg_pipeline_history ON "Lead";

CREATE TRIGGER trg_pipeline_history
AFTER UPDATE ON "Lead"
FOR EACH ROW
EXECUTE FUNCTION log_pipeline_change();










