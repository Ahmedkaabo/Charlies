-- Rename the "Salary" expense category to "Employee Debt"
UPDATE public.expense_categories
SET name = 'Employee Debt'
WHERE name ILIKE 'salary';
