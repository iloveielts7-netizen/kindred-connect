ALTER TABLE public.room_messages ADD COLUMN IF NOT EXISTS read boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS room_messages_room_read_idx ON public.room_messages (room_id, read);