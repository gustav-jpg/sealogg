
ALTER TABLE public.logbooks ADD COLUMN water_filled boolean NOT NULL DEFAULT false;
ALTER TABLE public.logbooks ADD COLUMN septic_emptied boolean NOT NULL DEFAULT false;
