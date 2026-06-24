CREATE TABLE IF NOT EXISTS public.bin_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('running','completed','failed')),
  rows_added integer NOT NULL DEFAULT 0,
  rows_updated integer NOT NULL DEFAULT 0,
  rows_skipped integer NOT NULL DEFAULT 0,
  notes text,
  run_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bin_import_runs TO authenticated;
GRANT ALL ON public.bin_import_runs TO service_role;

ALTER TABLE public.bin_import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view bin import runs"
  ON public.bin_import_runs FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS bin_import_runs_started_at_idx ON public.bin_import_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS bin_import_runs_source_idx ON public.bin_import_runs (source);