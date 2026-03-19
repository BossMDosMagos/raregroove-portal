-- Migration: Add 2FA support for admin users
-- Description: Adds TOTP-based two-factor authentication for enhanced security

-- Table for storing 2FA secrets
CREATE TABLE IF NOT EXISTS user_2fa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    secret VARCHAR(255) NOT NULL,
    backup_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    UNIQUE(user_id)
);

-- Table for tracking 2FA verification attempts
CREATE TABLE IF NOT EXISTS user_2fa_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_2fa_user_id ON user_2fa(user_id);
CREATE INDEX IF NOT EXISTS idx_user_2fa_attempts_user_id ON user_2fa_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_2fa_attempts_at ON user_2fa_attempts(attempted_at);

-- Add 2FA required flag to profiles (for admin enforcement)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS two_factor_required BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS two_factor_enforced_at TIMESTAMPTZ;

-- Function to check if user has 2FA enabled
CREATE OR REPLACE FUNCTION has_user_2fa_enabled(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    has_2fa BOOLEAN;
BEGIN
    SELECT is_enabled INTO has_2fa
    FROM user_2fa
    WHERE user_id = p_user_id AND is_verified = true;
    
    RETURN COALESCE(has_2fa, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify 2FA code
CREATE OR REPLACE FUNCTION verify_2fa_code(p_user_id UUID, p_code VARCHAR(6))
RETURNS BOOLEAN AS $$
DECLARE
    result BOOLEAN := false;
    stored_secret VARCHAR(255);
    is_backup_code BOOLEAN := false;
    backup_codes TEXT[];
    new_backup_codes TEXT[];
BEGIN
    SELECT secret, backup_codes INTO stored_secret, backup_codes
    FROM user_2fa
    WHERE user_id = p_user_id AND is_enabled = true AND is_verified = true;
    
    IF stored_secret IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check if it's a backup code
    IF p_code = ANY(backup_codes) THEN
        is_backup_code := true;
        new_backup_codes := ARRAY(SELECT unnest(backup_codes) WHERE unnest <> p_code);
        
        UPDATE user_2fa
        SET backup_codes = new_backup_codes, last_used_at = now()
        WHERE user_id = p_user_id;
        
        result := true;
    END IF;
    
    -- Record attempt
    INSERT INTO user_2fa_attempts (user_id, success)
    VALUES (p_user_id, result);
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_2fa_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_2fa_updated_at ON user_2fa;
CREATE TRIGGER trigger_user_2fa_updated_at
    BEFORE UPDATE ON user_2fa
    FOR EACH ROW
    EXECUTE FUNCTION update_2fa_updated_at();

-- RLS Policies
ALTER TABLE user_2fa ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_2fa_attempts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own 2FA data
CREATE POLICY "Users can view own 2FA" ON user_2fa
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own 2FA" ON user_2fa
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own 2FA" ON user_2fa
    FOR UPDATE USING (auth.uid() = user_id);

-- Admins can view all 2FA data (for support)
CREATE POLICY "Admins can view all 2FA" ON user_2fa
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND COALESCE(is_admin, false) = true
        )
    );

-- Users can only view their own attempts
CREATE POLICY "Users can view own 2FA attempts" ON user_2fa_attempts
    FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all attempts
CREATE POLICY "Admins can view all 2FA attempts" ON user_2fa_attempts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND COALESCE(is_admin, false) = true
        )
    );

-- Function to enforce 2FA for admins
CREATE OR REPLACE FUNCTION enforce_admin_2fa()
RETURNS TRIGGER AS $$
DECLARE
    user_is_admin BOOLEAN;
    requires_2fa BOOLEAN;
BEGIN
    -- Get the user's admin status
    SELECT COALESCE(is_admin, false) INTO user_is_admin
    FROM profiles
    WHERE id = NEW.user_id;
    
    -- Check if user requires 2FA
    SELECT COALESCE(two_factor_required, false) INTO requires_2fa
    FROM profiles
    WHERE id = NEW.user_id;
    
    -- If user is admin and 2FA is required but not enabled, deny login
    IF user_is_admin AND requires_2fa THEN
        IF NOT has_user_2fa_enabled(NEW.user_id) THEN
            RAISE EXCEPTION '2FA é obrigatório para administradores. Por favor, configure a verificação em duas etapas.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE user_2fa IS 'Stores TOTP secrets and backup codes for two-factor authentication';
COMMENT ON TABLE user_2fa_attempts IS 'Logs 2FA verification attempts for security monitoring';
COMMENT ON FUNCTION has_user_2fa_enabled IS 'Checks if a user has 2FA enabled and verified';
COMMENT ON FUNCTION verify_2fa_code IS 'Verifies a 2FA code (TOTP or backup code)';
