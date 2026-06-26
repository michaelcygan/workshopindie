
-- Group category taxonomy
CREATE TYPE public.group_category AS ENUM (
  'music',
  'film_video',
  'writing',
  'visual_art',
  'games_tech',
  'performance',
  'audio',
  'scene_life',
  'city'
);

ALTER TABLE public.groups ADD COLUMN category public.group_category;

CREATE INDEX groups_category_active_idx
  ON public.groups (category)
  WHERE deleted_at IS NULL;

-- Auto-set 'city' for any group with kind='city'
UPDATE public.groups SET category = 'city' WHERE kind = 'city' AND category IS NULL;

-- Backfill by name
UPDATE public.groups SET category = 'music' WHERE name IN (
  'SoundCloud Rappers','Bedroom Pop','Lo-fi Beatmakers','Synthwave','DJ / Club',
  'Hyperpop','Dreampop','Latin Trap','Drill','Jazz Revival',
  'Album in a Weekend','One-Take Music Video','Beat Battle','K-pop Dance Cover'
);

UPDATE public.groups SET category = 'film_video' WHERE name IN (
  'Indie Filmmakers','Documentary','Experimental Animation','48-Hour Film Race',
  'Reel-a-Day','Queer Cinema','Food Vloggers'
);

UPDATE public.groups SET category = 'writing' WHERE name IN (
  'Poets','Screenwriters','NaNoWriMo Sprint','Climate Fiction','Zine Makers'
);

UPDATE public.groups SET category = 'visual_art' WHERE name IN (
  'Comic Artists','Photographers','Ceramicists','Type Designers',
  'Tattoo Artists','Knitwear Designers','Sketch-a-Day'
);

UPDATE public.groups SET category = 'games_tech' WHERE name IN (
  'Indie Game Devs','Hackathon Crews','Solo Dev Jam','TTRPG GMs',
  'RPG One-Shot Crew','Demo Day Prep'
);

UPDATE public.groups SET category = 'performance' WHERE name IN (
  'Stand-up Comics','Open Mic Night','Drag Performers','Voice Actors','Cosplay'
);

UPDATE public.groups SET category = 'audio' WHERE name IN (
  'Podcasters','Podcast Pilot Week'
);

UPDATE public.groups SET category = 'scene_life' WHERE name IN (
  'Indie Sleaze','Vaporwave Revival','Cottagecore','Y2K Revival',
  'Afrofuturism','New Weird','DIY Punk','Sneakerheads'
);
