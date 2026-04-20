-- The app sends arbitrary category labels when users pick "Other Category"
-- (e.g. "plumbing"). The previous CHECK only allowed fixed presets and caused:
-- new row for relation "daily_expenses" violates check constraint "daily_expenses_category_check"
ALTER TABLE public.daily_expenses DROP CONSTRAINT IF EXISTS daily_expenses_category_check;
