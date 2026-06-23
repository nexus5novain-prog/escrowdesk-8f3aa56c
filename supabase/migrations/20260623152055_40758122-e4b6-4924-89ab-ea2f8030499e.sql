
-- Helper: is_arbiter
CREATE OR REPLACE FUNCTION public.is_arbiter(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','super_admin','senior_arbitrator','mediator','judge')
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_arbiter(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_arbiter(uuid) TO authenticated, service_role;

-- =========== arbitration_cases ===========
CREATE TABLE public.arbitration_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid REFERENCES public.trades(id) ON DELETE SET NULL,
  escrow_group_id uuid REFERENCES public.escrow_groups(id) ON DELETE SET NULL,
  opener_id uuid NOT NULL,
  respondent_id uuid,
  category text NOT NULL,
  summary text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  value_usd numeric(18,2) NOT NULL DEFAULT 0,
  mediator_id uuid,
  outcome text,
  outcome_note text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  ruled_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arbitration_cases TO authenticated;
GRANT ALL ON public.arbitration_cases TO service_role;
ALTER TABLE public.arbitration_cases ENABLE ROW LEVEL SECURITY;

-- Helper: is_case_party (RLS - keep executable to authenticated)
CREATE OR REPLACE FUNCTION public.is_case_party(_case_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.arbitration_cases c
    WHERE c.id = _case_id
      AND (c.opener_id = _user_id OR c.respondent_id = _user_id)
  );
$$;

CREATE POLICY "Parties read own cases"
  ON public.arbitration_cases FOR SELECT TO authenticated
  USING (opener_id = auth.uid() OR respondent_id = auth.uid() OR public.is_arbiter(auth.uid()));
CREATE POLICY "Authenticated open cases as opener"
  ON public.arbitration_cases FOR INSERT TO authenticated
  WITH CHECK (opener_id = auth.uid());
CREATE POLICY "Arbiters update cases"
  ON public.arbitration_cases FOR UPDATE TO authenticated
  USING (public.is_arbiter(auth.uid())) WITH CHECK (public.is_arbiter(auth.uid()));

CREATE TRIGGER trg_arbitration_cases_updated
  BEFORE UPDATE ON public.arbitration_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_arbitration_cases_opener ON public.arbitration_cases(opener_id);
CREATE INDEX idx_arbitration_cases_respondent ON public.arbitration_cases(respondent_id);
CREATE INDEX idx_arbitration_cases_status ON public.arbitration_cases(status);
CREATE INDEX idx_arbitration_cases_trade ON public.arbitration_cases(trade_id);

-- =========== arbitration_evidence ===========
CREATE TABLE public.arbitration_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.arbitration_cases(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL,
  file_path text NOT NULL,
  sha256 text NOT NULL,
  mime text,
  size_bytes bigint,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.arbitration_evidence TO authenticated;
GRANT ALL ON public.arbitration_evidence TO service_role;
ALTER TABLE public.arbitration_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read evidence on accessible cases"
  ON public.arbitration_evidence FOR SELECT TO authenticated
  USING (public.is_case_party(case_id, auth.uid()) OR public.is_arbiter(auth.uid()));
CREATE POLICY "Parties insert own evidence"
  ON public.arbitration_evidence FOR INSERT TO authenticated
  WITH CHECK (uploader_id = auth.uid()
    AND (public.is_case_party(case_id, auth.uid()) OR public.is_arbiter(auth.uid())));
CREATE INDEX idx_evidence_case ON public.arbitration_evidence(case_id);

-- =========== arbitration_timeline ===========
CREATE TABLE public.arbitration_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.arbitration_cases(id) ON DELETE CASCADE,
  actor_id uuid,
  kind text NOT NULL,
  body text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.arbitration_timeline TO authenticated;
GRANT ALL ON public.arbitration_timeline TO service_role;
ALTER TABLE public.arbitration_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read timeline on accessible cases"
  ON public.arbitration_timeline FOR SELECT TO authenticated
  USING (public.is_case_party(case_id, auth.uid()) OR public.is_arbiter(auth.uid()));
CREATE POLICY "Parties append timeline"
  ON public.arbitration_timeline FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid()
    AND (public.is_case_party(case_id, auth.uid()) OR public.is_arbiter(auth.uid())));
CREATE INDEX idx_timeline_case ON public.arbitration_timeline(case_id);

-- =========== arbitration_notes (staff only) ===========
CREATE TABLE public.arbitration_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.arbitration_cases(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.arbitration_notes TO authenticated;
GRANT ALL ON public.arbitration_notes TO service_role;
ALTER TABLE public.arbitration_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Arbiters read notes"
  ON public.arbitration_notes FOR SELECT TO authenticated
  USING (public.is_arbiter(auth.uid()));
CREATE POLICY "Arbiters add notes"
  ON public.arbitration_notes FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.is_arbiter(auth.uid()));
CREATE INDEX idx_notes_case ON public.arbitration_notes(case_id);

-- =========== arbitration_messages ===========
CREATE TABLE public.arbitration_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.arbitration_cases(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  staff_only boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.arbitration_messages TO authenticated;
GRANT ALL ON public.arbitration_messages TO service_role;
ALTER TABLE public.arbitration_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read messages on accessible cases"
  ON public.arbitration_messages FOR SELECT TO authenticated
  USING ((NOT staff_only AND public.is_case_party(case_id, auth.uid())) OR public.is_arbiter(auth.uid()));
CREATE POLICY "Parties send messages"
  ON public.arbitration_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid()
    AND ((NOT staff_only AND public.is_case_party(case_id, auth.uid())) OR public.is_arbiter(auth.uid())));
CREATE INDEX idx_messages_case ON public.arbitration_messages(case_id);

-- =========== arbitration_appeals ===========
CREATE TABLE public.arbitration_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.arbitration_cases(id) ON DELETE CASCADE,
  appellant_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.arbitration_appeals TO authenticated;
GRANT ALL ON public.arbitration_appeals TO service_role;
ALTER TABLE public.arbitration_appeals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read appeals on accessible cases"
  ON public.arbitration_appeals FOR SELECT TO authenticated
  USING (public.is_case_party(case_id, auth.uid()) OR public.is_arbiter(auth.uid()));
CREATE POLICY "Parties file appeals"
  ON public.arbitration_appeals FOR INSERT TO authenticated
  WITH CHECK (appellant_id = auth.uid() AND public.is_case_party(case_id, auth.uid()));
CREATE POLICY "Arbiters decide appeals"
  ON public.arbitration_appeals FOR UPDATE TO authenticated
  USING (public.is_arbiter(auth.uid())) WITH CHECK (public.is_arbiter(auth.uid()));
CREATE INDEX idx_appeals_case ON public.arbitration_appeals(case_id);

-- =========== arbitration_audit_log ===========
CREATE TABLE public.arbitration_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.arbitration_cases(id) ON DELETE SET NULL,
  actor_id uuid,
  action text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.arbitration_audit_log TO authenticated;
GRANT ALL ON public.arbitration_audit_log TO service_role;
ALTER TABLE public.arbitration_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Arbiters read audit"
  ON public.arbitration_audit_log FOR SELECT TO authenticated
  USING (public.is_arbiter(auth.uid()));
CREATE POLICY "System append audit"
  ON public.arbitration_audit_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());
CREATE INDEX idx_audit_case ON public.arbitration_audit_log(case_id);

-- =========== arbitration_signoffs ===========
CREATE TABLE public.arbitration_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.arbitration_cases(id) ON DELETE CASCADE,
  signer_id uuid NOT NULL,
  signer_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_id, signer_id)
);
GRANT SELECT, INSERT ON public.arbitration_signoffs TO authenticated;
GRANT ALL ON public.arbitration_signoffs TO service_role;
ALTER TABLE public.arbitration_signoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Arbiters read signoffs"
  ON public.arbitration_signoffs FOR SELECT TO authenticated
  USING (public.is_arbiter(auth.uid()));
CREATE POLICY "Arbiters add signoffs"
  ON public.arbitration_signoffs FOR INSERT TO authenticated
  WITH CHECK (signer_id = auth.uid() AND public.is_arbiter(auth.uid()));

-- =========== Auto-freeze trade on case open ===========
CREATE OR REPLACE FUNCTION public.tg_arbitration_case_freeze()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.trade_id IS NOT NULL THEN
    UPDATE public.trades SET status = 'disputed' WHERE id = NEW.trade_id AND status <> 'released';
  END IF;
  INSERT INTO public.arbitration_timeline(case_id, actor_id, kind, body)
    VALUES (NEW.id, NEW.opener_id, 'case_opened', NEW.summary);
  INSERT INTO public.arbitration_audit_log(case_id, actor_id, action, payload)
    VALUES (NEW.id, NEW.opener_id, 'case_opened',
      jsonb_build_object('trade_id', NEW.trade_id, 'escrow_group_id', NEW.escrow_group_id, 'value_usd', NEW.value_usd));
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.tg_arbitration_case_freeze() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_arbitration_case_freeze
  AFTER INSERT ON public.arbitration_cases
  FOR EACH ROW EXECUTE FUNCTION public.tg_arbitration_case_freeze();

-- =========== Realtime ===========
ALTER TABLE public.arbitration_cases REPLICA IDENTITY FULL;
ALTER TABLE public.arbitration_messages REPLICA IDENTITY FULL;
ALTER TABLE public.arbitration_timeline REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='arbitration_cases') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.arbitration_cases, public.arbitration_messages, public.arbitration_timeline';
  END IF;
END $$;
