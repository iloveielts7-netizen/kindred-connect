-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stress_id text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT 'Someone',
  public_key text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  notify_mode text NOT NULL DEFAULT 'generic',
  age_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stress_id_format CHECK (stress_id ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  CONSTRAINT notify_mode_valid CHECK (notify_mode IN ('none','generic','sender','full'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- CONNECTIONS
CREATE TABLE public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  disappearing_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  CONSTRAINT connection_distinct CHECK (user_a <> user_b),
  CONSTRAINT connection_ordered CHECK (user_a < user_b),
  CONSTRAINT connection_status_valid CHECK (status IN ('pending','accepted','declined')),
  CONSTRAINT connection_unique UNIQUE (user_a, user_b)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connections TO authenticated;
GRANT ALL ON public.connections TO service_role;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- BLOCKS
CREATE TABLE public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT block_unique UNIQUE (blocker_id, blocked_id),
  CONSTRAINT block_not_self CHECK (blocker_id <> blocked_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

-- MESSAGES (ciphertext only)
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.connections(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'text',
  cipher_body text NOT NULL,
  cipher_nonce text NOT NULL,
  cipher_key_a text NOT NULL,
  cipher_key_b text NOT NULL,
  media_path text,
  media_meta jsonb,
  reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  read_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz,
  expires_at timestamptz,
  CONSTRAINT message_kind_valid CHECK (kind IN ('text','image','video','file','voice'))
);
CREATE INDEX messages_connection_created_idx ON public.messages (connection_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- REPORTS
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  submitted_excerpt text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- HELPERS
CREATE OR REPLACE FUNCTION public.is_connection_member(_connection_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.connections c
    WHERE c.id = _connection_id AND (c.user_a = _uid OR c.user_b = _uid)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_accepted_member(_connection_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.connections c
    WHERE c.id = _connection_id AND c.status = 'accepted'
      AND (c.user_a = _uid OR c.user_b = _uid)
  );
$$;

CREATE OR REPLACE FUNCTION public.shares_connection(_uid uuid, _other uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.connections c
    WHERE (c.user_a = LEAST(_uid, _other) AND c.user_b = GREATEST(_uid, _other))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_blocked_pair(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = _a AND b.blocked_id = _b)
       OR (b.blocker_id = _b AND b.blocked_id = _a)
  );
$$;

-- PROFILE POLICIES
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY "read connected profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.shares_connection(auth.uid(), id));
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "delete own profile" ON public.profiles FOR DELETE TO authenticated
  USING (id = auth.uid());

-- CONNECTION POLICIES
CREATE POLICY "read own connections" ON public.connections FOR SELECT TO authenticated
  USING (auth.uid() IN (user_a, user_b));
CREATE POLICY "create connection request" ON public.connections FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
    AND auth.uid() IN (user_a, user_b)
    AND status = 'pending'
    AND NOT public.is_blocked_pair(user_a, user_b)
  );
CREATE POLICY "update own connections" ON public.connections FOR UPDATE TO authenticated
  USING (auth.uid() IN (user_a, user_b)) WITH CHECK (auth.uid() IN (user_a, user_b));
CREATE POLICY "delete own connections" ON public.connections FOR DELETE TO authenticated
  USING (auth.uid() IN (user_a, user_b));

-- BLOCK POLICIES
CREATE POLICY "manage own blocks" ON public.blocks FOR ALL TO authenticated
  USING (blocker_id = auth.uid()) WITH CHECK (blocker_id = auth.uid());

-- MESSAGE POLICIES
CREATE POLICY "read connection messages" ON public.messages FOR SELECT TO authenticated
  USING (public.is_connection_member(connection_id, auth.uid()));
CREATE POLICY "send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_accepted_member(connection_id, auth.uid()));
CREATE POLICY "update connection messages" ON public.messages FOR UPDATE TO authenticated
  USING (public.is_connection_member(connection_id, auth.uid()))
  WITH CHECK (public.is_connection_member(connection_id, auth.uid()));
CREATE POLICY "delete own messages" ON public.messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- REPORT POLICIES
CREATE POLICY "file own reports" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "read own reports" ON public.reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

-- RATE LIMIT CONNECTION REQUESTS
CREATE OR REPLACE FUNCTION public.limit_connection_requests()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recent integer;
BEGIN
  SELECT count(*) INTO recent FROM public.connections
  WHERE requester_id = NEW.requester_id AND created_at > now() - interval '1 hour';
  IF recent >= 20 THEN
    RAISE EXCEPTION 'Too many connection requests. Please try again later.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER connections_rate_limit BEFORE INSERT ON public.connections
FOR EACH ROW EXECUTE FUNCTION public.limit_connection_requests();

-- SAFE LOOKUP BY EXACT STRESS ID (prevents enumeration of profile rows)
CREATE OR REPLACE FUNCTION public.find_by_stress_id(_stress_id text)
RETURNS TABLE (id uuid, stress_id text, display_name text, public_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.stress_id, p.display_name, p.public_key
  FROM public.profiles p
  WHERE p.stress_id = upper(_stress_id)
    AND p.id <> auth.uid()
    AND NOT public.is_blocked_pair(auth.uid(), p.id)
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.find_by_stress_id(text) FROM public;
GRANT EXECUTE ON FUNCTION public.find_by_stress_id(text) TO authenticated;

-- ENCRYPTED MEDIA ACCESS RULES
CREATE POLICY "read connection media" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'media'
    AND public.is_connection_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );
CREATE POLICY "upload connection media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND public.is_accepted_member(((storage.foldername(name))[1])::uuid, auth.uid())
    AND owner = auth.uid()
  );
CREATE POLICY "delete own media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND owner = auth.uid());

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.connections;