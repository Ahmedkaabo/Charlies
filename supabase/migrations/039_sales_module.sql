-- ============================================================
-- 039_sales_module.sql
-- Sales module: daily revenue records, edit audit log, RLS
-- ============================================================

-- ── Tables ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sales_records (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     uuid          REFERENCES public.branches(id) ON DELETE CASCADE,
  date          date          NOT NULL,
  revenue       numeric(10,2) NOT NULL,
  notes         text,
  status        text          NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'submitted', 'locked')),
  submitted_by  uuid          REFERENCES public.profiles(id),
  submitted_at  timestamptz,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (branch_id, date)
);

CREATE INDEX IF NOT EXISTS idx_sales_records_branch_date
  ON public.sales_records (branch_id, date);

CREATE TABLE IF NOT EXISTS public.sales_edit_history (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_record_id   uuid          REFERENCES public.sales_records(id) ON DELETE CASCADE,
  branch_id         uuid          REFERENCES public.branches(id),
  date              date          NOT NULL,
  previous_revenue  numeric(10,2),
  new_revenue       numeric(10,2),
  previous_notes    text,
  new_notes         text,
  previous_status   text,
  new_status        text,
  edited_by         uuid          REFERENCES public.profiles(id),
  edited_at         timestamptz   NOT NULL DEFAULT now(),
  reason            text
);

CREATE INDEX IF NOT EXISTS idx_sales_edit_history_record
  ON public.sales_edit_history (sales_record_id);

-- ── Trigger: auto-log edits to sales_records ─────────────────

CREATE OR REPLACE FUNCTION public.log_sales_edit()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    OLD.revenue != NEW.revenue
    OR OLD.notes IS DISTINCT FROM NEW.notes
    OR OLD.status != NEW.status
  ) THEN
    INSERT INTO public.sales_edit_history (
      sales_record_id, branch_id, date,
      previous_revenue, new_revenue,
      previous_notes, new_notes,
      previous_status, new_status,
      edited_by, edited_at
    ) VALUES (
      OLD.id, OLD.branch_id, OLD.date,
      OLD.revenue, NEW.revenue,
      OLD.notes, NEW.notes,
      OLD.status, NEW.status,
      auth.uid(), now()
    );
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_sales_record_updated ON public.sales_records;
CREATE TRIGGER on_sales_record_updated
  BEFORE UPDATE ON public.sales_records
  FOR EACH ROW EXECUTE FUNCTION public.log_sales_edit();

-- ── RLS ───────────────────────────────────────────────────────

ALTER TABLE public.sales_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_edit_history ENABLE ROW LEVEL SECURITY;

-- sales_records: admins can do everything
CREATE POLICY "sales_records_admin_all"
  ON public.sales_records FOR ALL
  TO authenticated
  USING     (public.is_admin())
  WITH CHECK (public.is_admin());

-- sales_records: branch members can read their branch's records
CREATE POLICY "sales_records_member_select"
  ON public.sales_records FOR SELECT
  TO authenticated
  USING (public.user_branch_role_level(branch_id) IS NOT NULL);

-- sales_records: branch members can insert records for their branch
CREATE POLICY "sales_records_member_insert"
  ON public.sales_records FOR INSERT
  TO authenticated
  WITH CHECK (public.user_branch_role_level(branch_id) IS NOT NULL);

-- sales_records: branch members can update non-locked records for their branch
CREATE POLICY "sales_records_member_update"
  ON public.sales_records FOR UPDATE
  TO authenticated
  USING (
    public.user_branch_role_level(branch_id) IS NOT NULL
    AND status != 'locked'
  );

-- sales_edit_history: admins see everything
CREATE POLICY "sales_edit_history_admin_select"
  ON public.sales_edit_history FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- sales_edit_history: branch members can read history for their branch
CREATE POLICY "sales_edit_history_member_select"
  ON public.sales_edit_history FOR SELECT
  TO authenticated
  USING (public.user_branch_role_level(branch_id) IS NOT NULL);

-- sales_edit_history is written only by the trigger (SECURITY DEFINER),
-- no direct INSERT/UPDATE/DELETE policies for regular users.

-- ── Seed permissions for the 'sales' resource ─────────────────

DO $$
DECLARE
  v_admins         uuid;
  v_area_manager   uuid;
  v_branch_manager uuid;
  v_member         uuid;
BEGIN
  SELECT id INTO v_admins         FROM public.roles WHERE name = 'Admins'          LIMIT 1;
  SELECT id INTO v_area_manager   FROM public.roles WHERE name = 'area_manager'    LIMIT 1;
  SELECT id INTO v_branch_manager FROM public.roles WHERE name = 'branch_manager'  LIMIT 1;
  SELECT id INTO v_member         FROM public.roles WHERE name IN ('member', 'bar') ORDER BY name LIMIT 1;

  -- Admins: full access
  IF v_admins IS NOT NULL THEN
    INSERT INTO public.permissions (role_id, resource, can_create, can_read, can_update, can_delete)
    VALUES (v_admins, 'sales', true, true, true, true)
    ON CONFLICT (role_id, resource) DO NOTHING;
  END IF;

  -- Area manager: full access
  IF v_area_manager IS NOT NULL THEN
    INSERT INTO public.permissions (role_id, resource, can_create, can_read, can_update, can_delete)
    VALUES (v_area_manager, 'sales', true, true, true, false)
    ON CONFLICT (role_id, resource) DO NOTHING;
  END IF;

  -- Branch manager: can create, read, update
  IF v_branch_manager IS NOT NULL THEN
    INSERT INTO public.permissions (role_id, resource, can_create, can_read, can_update, can_delete)
    VALUES (v_branch_manager, 'sales', true, true, true, false)
    ON CONFLICT (role_id, resource) DO NOTHING;
  END IF;

  -- Member / staff: read and create only
  IF v_member IS NOT NULL THEN
    INSERT INTO public.permissions (role_id, resource, can_create, can_read, can_update, can_delete)
    VALUES (v_member, 'sales', true, true, false, false)
    ON CONFLICT (role_id, resource) DO NOTHING;
  END IF;
END;
$$;
