-- Add OTP code column to invitation_tokens for code-based fallback
ALTER TABLE public.invitation_tokens ADD COLUMN IF NOT EXISTS otp_code TEXT;

-- Create index for fast OTP lookups
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_otp_code ON public.invitation_tokens (otp_code) WHERE otp_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_email_otp ON public.invitation_tokens (user_email, otp_code) WHERE otp_code IS NOT NULL;