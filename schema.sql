-- Create the stars table
CREATE TABLE public.stars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    category TEXT,
    x FLOAT8 NOT NULL,
    y FLOAT8 NOT NULL,
    z FLOAT8 NOT NULL,
    color TEXT NOT NULL,
    size FLOAT8 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS (Optional but good practice)
ALTER TABLE public.stars ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read stars (for the 3D scene)
CREATE POLICY "Enable read access for all users" ON public.stars
    FOR SELECT USING (true);

-- Allow service role (backend) to insert
CREATE POLICY "Enable insert for service_role" ON public.stars
    FOR INSERT WITH CHECK (true);

-- Create the star_emails table
CREATE TABLE public.star_emails (
    star_id UUID PRIMARY KEY REFERENCES public.stars(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.star_emails ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write emails (for privacy)
CREATE POLICY "Enable full access for service_role only" ON public.star_emails
    FOR ALL USING (true) WITH CHECK (true);
