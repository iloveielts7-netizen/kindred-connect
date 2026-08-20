CREATE TABLE IF NOT EXISTS public.rooms (
  id text PRIMARY KEY,
  stress_id_a text NOT NULL,
  stress_id_b text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.rooms TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms readable" ON public.rooms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "rooms insertable" ON public.rooms FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "rooms updatable" ON public.rooms FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  stress_id text NOT NULL,
  display_name text NOT NULL DEFAULT 'Someone',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, stress_id)
);
GRANT SELECT, INSERT, UPDATE ON public.room_members TO anon, authenticated;
GRANT ALL ON public.room_members TO service_role;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members readable" ON public.room_members FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "members insertable" ON public.room_members FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "members updatable" ON public.room_members FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  sender_stress_id text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS room_messages_room_created_idx ON public.room_messages (room_id, created_at);
GRANT SELECT, INSERT, UPDATE ON public.room_messages TO anon, authenticated;
GRANT ALL ON public.room_messages TO service_role;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "room messages readable" ON public.room_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "room messages insertable" ON public.room_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "room messages updatable" ON public.room_messages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER rooms_updated_at BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER room_members_updated_at BEFORE UPDATE ON public.room_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER room_messages_updated_at BEFORE UPDATE ON public.room_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;