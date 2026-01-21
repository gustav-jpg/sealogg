-- Add ended_at column to passenger_sessions for tracking when registration was closed
ALTER TABLE public.passenger_sessions 
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP WITH TIME ZONE;