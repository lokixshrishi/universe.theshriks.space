
-- Public stars table (no email)
CREATE TABLE public.stars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  message text NOT NULL,
  x double precision NOT NULL,
  y double precision NOT NULL,
  z double precision NOT NULL,
  color text NOT NULL,
  size double precision NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX stars_created_at_idx ON public.stars(created_at DESC);
CREATE INDEX stars_name_idx ON public.stars USING gin (to_tsvector('simple', name));

-- Private email storage (separate table, no client access)
CREATE TABLE public.star_emails (
  star_id uuid PRIMARY KEY REFERENCES public.stars(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.star_emails ENABLE ROW LEVEL SECURITY;

-- Anyone can read stars (public universe)
CREATE POLICY "Stars are viewable by everyone"
  ON public.stars FOR SELECT
  USING (true);

-- No client insert/update/delete on stars (server function uses service role)
-- No policies on star_emails — fully locked down

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.stars;
ALTER TABLE public.stars REPLICA IDENTITY FULL;
