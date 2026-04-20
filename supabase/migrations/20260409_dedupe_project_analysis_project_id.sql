-- Deduplicate project_analysis by project_id and enforce uniqueness.
-- Keeps the newest row per project_id based on updated_at/created_at/id.

BEGIN;

-- Remove duplicate rows while keeping the "latest" record for each project_id.
WITH ranked AS (
  SELECT
    id,
    project_id,
    ROW_NUMBER() OVER (
      PARTITION BY project_id
      ORDER BY
        COALESCE(updated_at, created_at) DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS rn
  FROM public.project_analysis
  WHERE project_id IS NOT NULL
)
DELETE FROM public.project_analysis pa
USING ranked r
WHERE pa.id = r.id
  AND r.rn > 1;

-- Ensure we never get duplicates again.
-- Partial unique index avoids blocking legacy rows with null project_id.
CREATE UNIQUE INDEX IF NOT EXISTS ux_project_analysis_project_id
ON public.project_analysis(project_id)
WHERE project_id IS NOT NULL;

COMMIT;

