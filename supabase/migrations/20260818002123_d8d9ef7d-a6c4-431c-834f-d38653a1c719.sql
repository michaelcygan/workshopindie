-- 1. Normalization + slug helpers -------------------------------------------------
CREATE OR REPLACE FUNCTION public.topic_normalize(_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT nullif(
    btrim(
      regexp_replace(
        lower(translate(normalize(coalesce(_text, ''), NFKC), '–—‐‑‒−', '------')),
        '[[:space:]]+', ' ', 'g'
      ),
      ' .,;:!?'
    ),
    ''
  );
$$;

-- 2. Topic registry columns --------------------------------------------------------
ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'reviewed',
  ADD COLUMN IF NOT EXISTS family text,
  ADD COLUMN IF NOT EXISTS broader_topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_topic_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS editorial_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS normalized_key text
    GENERATED ALWAYS AS (public.topic_normalize(name)) STORED;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'topics_review_state_check'
  ) THEN
    ALTER TABLE public.topics
      ADD CONSTRAINT topics_review_state_check
      CHECK (review_state IN ('reviewed', 'needs_review'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS topics_normalized_key_uidx ON public.topics (normalized_key);
CREATE INDEX IF NOT EXISTS topics_status_idx ON public.topics (status);
CREATE INDEX IF NOT EXISTS topics_review_state_idx ON public.topics (review_state);
CREATE INDEX IF NOT EXISTS topics_featured_order_idx ON public.topics (featured DESC, editorial_order, name);
CREATE INDEX IF NOT EXISTS topics_name_trgm_idx ON public.topics USING gin (name gin_trgm_ops);

-- 3. Aliases -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.topic_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text GENERATED ALWAYS AS (public.topic_normalize(alias)) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.topic_aliases TO anon;
GRANT SELECT ON public.topic_aliases TO authenticated;
GRANT ALL ON public.topic_aliases TO service_role;
ALTER TABLE public.topic_aliases ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='topic_aliases' AND policyname='topic aliases readable by everyone') THEN
    CREATE POLICY "topic aliases readable by everyone" ON public.topic_aliases FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='topic_aliases' AND policyname='admins manage topic aliases') THEN
    CREATE POLICY "admins manage topic aliases" ON public.topic_aliases FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS topic_aliases_normalized_uidx ON public.topic_aliases (normalized_alias);
CREATE INDEX IF NOT EXISTS topic_aliases_topic_idx ON public.topic_aliases (topic_id);
CREATE INDEX IF NOT EXISTS topic_aliases_trgm_idx ON public.topic_aliases USING gin (alias gin_trgm_ops);

-- 4. Slug redirects ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.topic_slug_redirects (
  old_slug text PRIMARY KEY,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.topic_slug_redirects TO anon;
GRANT SELECT ON public.topic_slug_redirects TO authenticated;
GRANT ALL ON public.topic_slug_redirects TO service_role;
ALTER TABLE public.topic_slug_redirects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='topic_slug_redirects' AND policyname='topic redirects readable by everyone') THEN
    CREATE POLICY "topic redirects readable by everyone" ON public.topic_slug_redirects FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='topic_slug_redirects' AND policyname='admins manage topic redirects') THEN
    CREATE POLICY "admins manage topic redirects" ON public.topic_slug_redirects FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS topic_follows_topic_idx ON public.topic_follows (topic_id);

-- 5. Seed the 100 canonical Topics -------------------------------------------------
INSERT INTO public.topics (slug, name, short_description, family, review_state, status)
SELECT public.topic_slugify(v.name), v.name, v.descr, v.family, 'reviewed', 'active'
FROM (VALUES
  ('Creative Process','How work actually gets made: habits, drafts, revision, and creative decisions.','Creative work'),
  ('Collaboration','Making work with other people and the dynamics that shape it.','Creative work'),
  ('Artist Development','Growth over a career: craft, direction, and sustaining a practice.','Creative work'),
  ('Creative Labor','The conditions and lived experience of making cultural or creative work.','Creative work'),
  ('DIY Production','Self-produced, low-budget, and independent ways of making and releasing work.','Creative work'),
  ('Arts Funding','Grants, patronage, budgets, and how creative work gets paid for.','Creative work'),
  ('Authorship','Credit, voice, attribution, and who is understood to have made a work.','Creative work'),
  ('Copyright','Rights, licensing, ownership, and reuse of creative work.','Creative work'),
  ('Distribution','How work reaches people: platforms, releases, screenings, and circulation.','Creative work'),
  ('Audiences','Who work is for, how it finds people, and how people respond.','Creative work'),
  ('Popular Culture','Mass culture, celebrity, trends, and shared cultural reference points.','Culture and media'),
  ('Internet Culture','Online behavior, aesthetics, communities, memes, and social life.','Culture and media'),
  ('Film Culture','Film-going, criticism, canons, festivals, and cinema communities.','Culture and media'),
  ('Music Culture','Scenes, listening, venues, fandom, and the social life of music.','Culture and media'),
  ('Visual Culture','Images, design, and looking: how visual work circulates and means.','Culture and media'),
  ('Independent Media','Independent publishing, broadcasting, and non-corporate media making.','Culture and media'),
  ('Nightlife','Bars, clubs, late shows, and the culture built after dark.','Culture and media'),
  ('Humor','Comedy, satire, jokes, and the craft and politics of being funny.','Culture and media'),
  ('Performance and Persona','Stage presence, personas, and the self performed in public.','Culture and media'),
  ('Subcultures','Scenes and communities forming their own aesthetics and rules.','Culture and media'),
  ('Identity','How people understand and express who they are.','Identity and society'),
  ('Race','Race, racism, and racial experience in culture and society.','Identity and society'),
  ('Gender','Gender identity, expression, roles, and inequality.','Identity and society'),
  ('Sexuality','Desire, intimacy, orientation, and their cultural context.','Identity and society'),
  ('Queer Life','LGBTQ+ experience, community, history, and culture.','Identity and society'),
  ('Disability','Disabled experience, access, and disability culture and politics.','Identity and society'),
  ('Social Class','Class experience, mobility, and how status shapes opportunity.','Identity and society'),
  ('Immigration','Migration, borders, diaspora, and immigrant experience.','Identity and society'),
  ('Belonging','Feeling at home, exclusion, and the search for a place among others.','Identity and society'),
  ('Community','Belonging and shared social life among people and neighbors.','Identity and society'),
  ('Mental Health','Mental health, illness, care, and psychological wellbeing.','Inner life and relationships'),
  ('Trauma','Experiences of harm and their long aftermath.','Inner life and relationships'),
  ('Grief','Loss, mourning, and living afterward.','Inner life and relationships'),
  ('Memory','Remembering and forgetting, personal and collective.','Inner life and relationships'),
  ('Love','Romantic and non-romantic love and its complications.','Inner life and relationships'),
  ('Friendship','Close non-family bonds and how they are made and kept.','Inner life and relationships'),
  ('Family','Family relationships, roles, inheritance, and estrangement.','Inner life and relationships'),
  ('Childhood','Growing up and the experience and memory of being a child.','Inner life and relationships'),
  ('Aging','Getting older, elderhood, and life across time.','Inner life and relationships'),
  ('Addiction and Recovery','Substance use, dependency, sobriety, and recovery.','Inner life and relationships'),
  ('Democracy','Self-governance, representation, and democratic institutions.','Politics and public life'),
  ('Elections','Campaigns, voting, and electoral politics.','Politics and public life'),
  ('Public Policy','Laws, programs, and the decisions governments make.','Politics and public life'),
  ('Civil Rights','Legal rights, equal protection, and civil liberties.','Politics and public life'),
  ('Social Justice','Fairness, equity, and movements for structural change.','Politics and public life'),
  ('Policing','Police, public safety, and their effects on communities.','Politics and public life'),
  ('Criminal Justice','Courts, prisons, sentencing, and justice systems.','Politics and public life'),
  ('Protest','Demonstration, dissent, and direct action.','Politics and public life'),
  ('Community Organizing','Deliberate collective action and the practice of organizing.','Politics and public life'),
  ('Media and Democracy','Press freedom, misinformation, and media''s civic role.','Politics and public life'),
  ('Labor','Work, workers, rights, unions, and labor systems broadly.','Work and economy'),
  ('Creator Economy','Making a living from independent creative work online and off.','Work and economy'),
  ('Money','Earning, spending, debt, and personal finance.','Work and economy'),
  ('Economic Inequality','Gaps in wealth, income, and economic power.','Work and economy'),
  ('Poverty','Material hardship and the systems that produce it.','Work and economy'),
  ('Housing','Rent, ownership, homelessness, and housing policy.','Work and economy'),
  ('Small Business','Independent businesses, shops, studios, and their economics.','Work and economy'),
  ('Cooperatives','Worker- and member-owned organizations and shared ownership.','Work and economy'),
  ('Entrepreneurship','Starting and building ventures.','Work and economy'),
  ('Future of Work','How work is changing: automation, remote work, and new arrangements.','Work and economy'),
  ('Climate Change','A warming planet, its causes, effects, and responses.','Environment and place'),
  ('Environmental Justice','Who bears environmental harm and who is protected from it.','Environment and place'),
  ('Sustainability','Living and producing within ecological limits.','Environment and place'),
  ('Conservation','Protecting land, water, species, and habitats.','Environment and place'),
  ('Food Systems','How food is produced, distributed, and eaten.','Environment and place'),
  ('Agriculture','Farming, growing, and agricultural life and labor.','Environment and place'),
  ('Urban Life','Cities, neighborhoods, density, and city living.','Environment and place'),
  ('Rural Life','Small towns, countryside, and rural experience.','Environment and place'),
  ('Public Space','Streets, parks, and shared physical space.','Environment and place'),
  ('Transportation','Getting around: transit, roads, biking, and mobility.','Environment and place'),
  ('Artificial Intelligence','AI systems, research, effects, governance, and criticism.','Science and technology'),
  ('AI-Assisted Creativity','The use and meaning of AI within creative practice.','Science and technology'),
  ('The Internet','Infrastructure, access, governance, and the network itself.','Science and technology'),
  ('Privacy','Personal data, consent, and the right to be left alone.','Science and technology'),
  ('Surveillance','Monitoring by states, companies, and platforms.','Science and technology'),
  ('Data and Society','How data collection and analysis shape social life.','Science and technology'),
  ('Biotechnology','Biology as technology: medicine, genetics, and bioethics.','Science and technology'),
  ('Space','Space exploration, astronomy, and the cosmos.','Science and technology'),
  ('Public Health','Population health, prevention, and health systems.','Science and technology'),
  ('Open Source','Openly licensed software, tools, and shared technical work.','Science and technology'),
  ('Education','Schools, teaching, and educational systems.','Education and knowledge'),
  ('Learning','How people learn, practice, and gain skill.','Education and knowledge'),
  ('Libraries','Libraries, lending, and public access to knowledge.','Education and knowledge'),
  ('Archives','Preserving records, collections, and cultural material.','Education and knowledge'),
  ('Local History','The past of a specific place and its people.','Education and knowledge'),
  ('Oral History','Recorded first-person testimony and memory.','Education and knowledge'),
  ('Media Literacy','Reading, judging, and understanding media critically.','Education and knowledge'),
  ('Research Ethics','Responsible research, consent, and integrity.','Education and knowledge'),
  ('Knowledge Sharing','Teaching, documentation, and passing on what you know.','Education and knowledge'),
  ('Museums','Museums, exhibitions, and curatorial practice.','Education and knowledge'),
  ('Spirituality','Personal or communal experiences of transcendence, inner life, or spiritual practice.','Belief and meaning'),
  ('Religion','Organized traditions, institutions, histories, and communities.','Belief and meaning'),
  ('Faith','Lived belief, trust, doubt, and commitment.','Belief and meaning'),
  ('Ethics','Right action, responsibility, and moral reasoning.','Belief and meaning'),
  ('Philosophy','Ideas about knowledge, existence, and value.','Belief and meaning'),
  ('Ritual','Repeated practices that carry meaning, sacred or secular.','Belief and meaning'),
  ('Death and Mortality','Dying, finitude, and how we live with it.','Belief and meaning'),
  ('Meaning','Purpose, significance, and what makes a life feel worthwhile.','Belief and meaning'),
  ('Utopia','Imagined better worlds and the desire for them.','Belief and meaning'),
  ('Mythology','Myths, legends, and inherited stories.','Belief and meaning')
) AS v(name, descr, family)
ON CONFLICT (slug) DO NOTHING;

-- 6. Seed true aliases -------------------------------------------------------------
INSERT INTO public.topic_aliases (topic_id, alias)
SELECT t.id, v.alias
FROM (VALUES
  ('AI','Artificial Intelligence'),
  ('A.I.','Artificial Intelligence'),
  ('AI creativity','AI-Assisted Creativity'),
  ('AI-assisted art','AI-Assisted Creativity'),
  ('global warming','Climate Change'),
  ('indie media','Independent Media'),
  ('independent production','DIY Production'),
  ('LGBTQ+ life','Queer Life'),
  ('LGBTQ life','Queer Life'),
  ('addiction recovery','Addiction and Recovery'),
  ('substance use recovery','Addiction and Recovery'),
  ('public transit','Transportation'),
  ('mass transit','Transportation'),
  ('open-source','Open Source'),
  ('oral histories','Oral History'),
  ('spiritual life','Spirituality')
) AS v(alias, target)
JOIN public.topics t ON t.normalized_key = public.topic_normalize(v.target)
WHERE NOT EXISTS (
  SELECT 1 FROM public.topic_aliases a WHERE a.normalized_alias = public.topic_normalize(v.alias)
);

-- 7. Broader-topic relationships for the seeded set --------------------------------
UPDATE public.topics child
SET broader_topic_id = parent.id
FROM public.topics parent
WHERE child.normalized_key = public.topic_normalize('AI-Assisted Creativity')
  AND parent.normalized_key = public.topic_normalize('Artificial Intelligence')
  AND child.broader_topic_id IS NULL;

UPDATE public.topics child
SET broader_topic_id = parent.id
FROM public.topics parent
WHERE child.normalized_key = public.topic_normalize('Creative Labor')
  AND parent.normalized_key = public.topic_normalize('Labor')
  AND child.broader_topic_id IS NULL;

UPDATE public.topics child
SET broader_topic_id = parent.id
FROM public.topics parent
WHERE child.normalized_key = public.topic_normalize('Community Organizing')
  AND parent.normalized_key = public.topic_normalize('Community')
  AND child.broader_topic_id IS NULL;

UPDATE public.topics child
SET broader_topic_id = parent.id
FROM public.topics parent
WHERE child.normalized_key = public.topic_normalize('Internet Culture')
  AND parent.normalized_key = public.topic_normalize('The Internet')
  AND child.broader_topic_id IS NULL;
