-- Enable Realtime on tables that drive the balance module so that
-- changes made by any user are pushed to all connected sessions.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'sales_records')
  THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_records; END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'expenses')
  THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses; END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'treasury_transfers')
  THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.treasury_transfers; END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'pool_transfers')
  THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.pool_transfers; END IF;
END $$;
