CREATE TABLE public.connection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id text NOT NULL,
  receiver_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.connection_requests TO anon;
GRANT SELECT, INSERT, UPDATE ON public.connection_requests TO authenticated;
GRANT ALL ON public.connection_requests TO service_role;

ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "connection requests readable" ON public.connection_requests
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "connection requests insertable" ON public.connection_requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "connection requests updatable" ON public.connection_requests
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX connection_requests_receiver_idx ON public.connection_requests (receiver_id, status);
CREATE INDEX connection_requests_sender_idx ON public.connection_requests (sender_id, status);

ALTER PUBLICATION supabase_realtime ADD TABLE public.connection_requests;
ALTER TABLE public.connection_requests REPLICA IDENTITY FULL;