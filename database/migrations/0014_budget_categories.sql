-- 0014_budget_categories.sql
-- Phase B1/B3: make budget_lines (per category) the source of truth.
-- Project totals + forecast are DERIVED (no more hand-typed forecast).
-- Categories: materials | labour | transport | equipment | permits | subcontractors | contingency | other

-- One line per (project, category); enforce the category vocabulary.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='budget_lines_category_chk') THEN
    ALTER TABLE budget_lines ADD CONSTRAINT budget_lines_category_chk
      CHECK (category IN ('materials','labour','transport','equipment','permits','subcontractors','contingency','other'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='budget_lines_project_category_uniq') THEN
    ALTER TABLE budget_lines ADD CONSTRAINT budget_lines_project_category_uniq UNIQUE (project_id, category);
  END IF;
END $$;

-- Recompute the whole budget for a project from its category lines:
--   committed = Σ open commitments in that category
--   actual    = Σ project expenses in that category
--   forecast  = actual + committed + estimate-to-complete (allocated − actual − committed, floored at 0)
-- then roll the lines up into project_budgets and refresh status.
CREATE OR REPLACE FUNCTION fn_recompute_budget(p_project uuid) RETURNS void AS $$
BEGIN
  INSERT INTO project_budgets (project_id) VALUES (p_project) ON CONFLICT (project_id) DO NOTHING;

  -- Surface categories that have spend/commitments even if never allocated.
  INSERT INTO budget_lines (project_id, category)
  SELECT p_project, cat FROM (
    SELECT DISTINCT budget_category AS cat FROM commitments
      WHERE project_id = p_project AND budget_category IS NOT NULL
    UNION
    SELECT DISTINCT category AS cat FROM expenses
      WHERE project_id = p_project
        AND category IN ('materials','labour','transport','equipment','permits','subcontractors','contingency','other')
  ) s
  ON CONFLICT (project_id, category) DO NOTHING;

  UPDATE budget_lines bl SET
    committed = COALESCE((SELECT SUM(c.amount) FROM commitments c
                          WHERE c.project_id = bl.project_id AND c.budget_category = bl.category AND c.status = 'open'), 0),
    actual    = COALESCE((SELECT SUM(e.amount) FROM expenses e
                          WHERE e.project_id = bl.project_id AND e.category = bl.category), 0),
    updated_at = now()
  WHERE bl.project_id = p_project;

  UPDATE budget_lines bl SET
    forecast = bl.actual + bl.committed + GREATEST(bl.allocated - bl.actual - bl.committed, 0)
  WHERE bl.project_id = p_project;

  UPDATE project_budgets pb SET
    allocated_amount = COALESCE((SELECT SUM(allocated) FROM budget_lines WHERE project_id = p_project), 0),
    committed_amount = COALESCE((SELECT SUM(committed) FROM budget_lines WHERE project_id = p_project), 0),
    actual_amount    = COALESCE((SELECT SUM(actual)    FROM budget_lines WHERE project_id = p_project), 0),
    forecast_amount  = COALESCE((SELECT SUM(forecast)  FROM budget_lines WHERE project_id = p_project), 0),
    updated_at = now()
  WHERE pb.project_id = p_project;

  PERFORM fn_budget_status(p_project);
END;
$$ LANGUAGE plpgsql;
