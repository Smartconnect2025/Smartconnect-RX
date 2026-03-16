-- ========================================
-- CREATE SUPER ADMIN USER
-- ========================================
-- This script creates the super admin user account
-- Run this in your Supabase SQL Editor
-- ========================================

-- Step 1: Create the system_logs table first (if not exists)
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  user_name TEXT,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  queue_id TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_queue_id ON system_logs(queue_id);

-- Step 2: Create the super admin user
-- NOTE: You should create this user via the Supabase Dashboard instead:
-- 1. Go to Authentication → Users
-- 2. Click "Add user"
-- 3. Email: super@smartconnects.com
-- 4. Password: Super2025!
-- 5. Check "Auto Confirm User"
-- 6. Click "Create user"

-- Alternatively, if you want to use SQL (advanced):
-- This requires the pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insert super admin user
DO $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Check if user already exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'super@smartconnects.com') THEN
    -- Generate new UUID for user
    new_user_id := gen_random_uuid();

    -- Insert into auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_sent_at,
      recovery_sent_at,
      email_change_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at,
      phone,
      phone_confirmed_at,
      phone_change,
      phone_change_sent_at,
      confirmed_at,
      email_change,
      email_change_token_current,
      email_change_confirm_status,
      banned_until,
      reauthentication_sent_at,
      reauthentication_token,
      is_sso_user,
      deleted_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', -- instance_id
      new_user_id, -- id
      'authenticated', -- aud
      'authenticated', -- role
      'super@smartconnects.com', -- email
      crypt('Super2025!', gen_salt('bf')), -- encrypted_password
      NOW(), -- email_confirmed_at (auto-confirm)
      NOW(), -- confirmation_sent_at
      NULL, -- recovery_sent_at
      NULL, -- email_change_sent_at
      NULL, -- last_sign_in_at
      '{"provider":"email","providers":["email"]}', -- raw_app_meta_data
      '{}', -- raw_user_meta_data
      false, -- is_super_admin
      NOW(), -- created_at
      NOW(), -- updated_at
      NULL, -- phone
      NULL, -- phone_confirmed_at
      '', -- phone_change
      NULL, -- phone_change_sent_at
      NOW(), -- confirmed_at
      '', -- email_change
      '', -- email_change_token_current
      0, -- email_change_confirm_status
      NULL, -- banned_until
      NULL, -- reauthentication_sent_at
      '', -- reauthentication_token
      false, -- is_sso_user
      NULL -- deleted_at
    );

    -- Insert into auth.identities
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      new_user_id,
      jsonb_build_object(
        'sub', new_user_id::text,
        'email', 'super@smartconnects.com'
      ),
      'email',
      NOW(),
      NOW(),
      NOW()
    );

    RAISE NOTICE 'Super admin user created successfully: super@smartconnects.com';
  ELSE
    RAISE NOTICE 'Super admin user already exists: super@smartconnects.com';
  END IF;
END $$;

-- Step 3: Log the creation
INSERT INTO system_logs (
  user_email,
  user_name,
  action,
  details,
  status
) VALUES (
  'system',
  'Database Setup',
  'SUPER_ADMIN_CREATED',
  'Created super admin user account: super@smartconnects.com',
  'success'
);

-- Verify the user was created
SELECT
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email = 'super@smartconnects.com';

-- Done! You can now login with:
-- Email: super@smartconnects.com
-- Password: Super2025!
