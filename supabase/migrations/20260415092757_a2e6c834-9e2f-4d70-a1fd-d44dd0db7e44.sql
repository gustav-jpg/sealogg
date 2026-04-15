CREATE TYPE public.rustning_priority AS ENUM ('low', 'normal', 'high');

ALTER TABLE public.rustning_tasks ADD COLUMN priority rustning_priority NOT NULL DEFAULT 'normal';