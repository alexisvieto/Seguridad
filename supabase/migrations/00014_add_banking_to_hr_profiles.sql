-- ============================================================================
-- Migration 00014: Add banking data to hr_agent_profiles for ACH exports
-- ============================================================================

ALTER TABLE public.hr_agent_profiles
  ADD COLUMN cedula TEXT CHECK (char_length(cedula) BETWEEN 5 AND 20),
  ADD COLUMN bank_code TEXT CHECK (char_length(bank_code) <= 10),
  ADD COLUMN bank_name TEXT CHECK (char_length(bank_name) <= 100),
  ADD COLUMN bank_account_number TEXT CHECK (char_length(bank_account_number) <= 30),
  ADD COLUMN bank_account_type TEXT CHECK (bank_account_type IN ('ahorros', 'corriente'));

COMMENT ON COLUMN public.hr_agent_profiles.cedula IS 'National ID number — used in ACH file generation';
COMMENT ON COLUMN public.hr_agent_profiles.bank_code IS 'Bank routing code for ACH transfers';
COMMENT ON COLUMN public.hr_agent_profiles.bank_account_type IS 'Account type: ahorros (savings) or corriente (checking)';
