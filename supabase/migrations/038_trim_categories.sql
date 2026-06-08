-- Remove unwanted expense categories
DELETE FROM public.expense_categories
WHERE name IN ('Gas', 'Marketing', 'Rent', 'Water');
