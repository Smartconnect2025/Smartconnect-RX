-- ========================================
-- CREATE DEMO TEST ACCOUNTS
-- ========================================
-- Creates 4 test accounts for demo:
-- 1. Platform Owner: platform@demo.com / Demo2025!
-- 2. Pharmacy Admin: admin@demo.com / Demo2025!
-- 3. Doctor 1: dr.smith@demo.com / Doctor2025!
-- 4. Doctor 2: dr.jones@demo.com / Doctor2025!
-- ========================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ========================================
-- 1. PLATFORM OWNER ACCOUNT
-- ========================================
DO $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'platform@demo.com') THEN
    DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'platform@demo.com');
    DELETE FROM auth.users WHERE email = 'platform@demo.com';
  END IF;

  -- Generate new UUID for user
  new_user_id := gen_random_uuid();

  -- Insert into auth.users
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_sent_at, confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_super_admin, is_sso_user
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    'platform@demo.com',
    crypt('Demo2025!', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(), NOW(), false, false
  );

  -- Insert into auth.identities
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', 'platform@demo.com'),
    'email',
    NOW(), NOW(), NOW()
  );

  RAISE NOTICE 'Platform Owner created: platform@demo.com';
END $$;

-- ========================================
-- 2. PHARMACY ADMIN ACCOUNT
-- ========================================
DO $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@demo.com') THEN
    DELETE FROM user_roles WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'admin@demo.com');
    DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'admin@demo.com');
    DELETE FROM auth.users WHERE email = 'admin@demo.com';
  END IF;

  -- Generate new UUID for user
  new_user_id := gen_random_uuid();

  -- Insert into auth.users
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_sent_at, confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_super_admin, is_sso_user
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    'admin@demo.com',
    crypt('Demo2025!', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(), NOW(), false, false
  );

  -- Insert into auth.identities
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', 'admin@demo.com'),
    'email',
    NOW(), NOW(), NOW()
  );

  -- Assign admin role
  INSERT INTO user_roles (user_id, role)
  VALUES (new_user_id, 'admin');

  RAISE NOTICE 'Pharmacy Admin created: admin@demo.com';
END $$;

-- ========================================
-- 3. DOCTOR 1 ACCOUNT (Dr. Smith)
-- ========================================
DO $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'dr.smith@demo.com') THEN
    DELETE FROM providers WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'dr.smith@demo.com');
    DELETE FROM user_roles WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'dr.smith@demo.com');
    DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'dr.smith@demo.com');
    DELETE FROM auth.users WHERE email = 'dr.smith@demo.com';
  END IF;

  -- Generate new UUID for user
  new_user_id := gen_random_uuid();

  -- Insert into auth.users
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_sent_at, confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_super_admin, is_sso_user
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    'dr.smith@demo.com',
    crypt('Doctor2025!', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(), NOW(), false, false
  );

  -- Insert into auth.identities
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', 'dr.smith@demo.com'),
    'email',
    NOW(), NOW(), NOW()
  );

  -- Assign provider role
  INSERT INTO user_roles (user_id, role)
  VALUES (new_user_id, 'provider');

  -- Create provider profile
  INSERT INTO providers (
    id, user_id, first_name, last_name, specialization,
    npi_number, license_number, license_state,
    is_accepting_patients, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    'Sarah',
    'Smith',
    'Family Medicine',
    '1234567890',
    'MD12345',
    'CA',
    true,
    NOW(),
    NOW()
  );

  RAISE NOTICE 'Doctor 1 created: dr.smith@demo.com (Dr. Sarah Smith)';
END $$;

-- ========================================
-- 4. DOCTOR 2 ACCOUNT (Dr. Jones)
-- ========================================
DO $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'dr.jones@demo.com') THEN
    DELETE FROM providers WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'dr.jones@demo.com');
    DELETE FROM user_roles WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'dr.jones@demo.com');
    DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'dr.jones@demo.com');
    DELETE FROM auth.users WHERE email = 'dr.jones@demo.com';
  END IF;

  -- Generate new UUID for user
  new_user_id := gen_random_uuid();

  -- Insert into auth.users
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_sent_at, confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_super_admin, is_sso_user
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    'dr.jones@demo.com',
    crypt('Doctor2025!', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(), NOW(), false, false
  );

  -- Insert into auth.identities
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', 'dr.jones@demo.com'),
    'email',
    NOW(), NOW(), NOW()
  );

  -- Assign provider role
  INSERT INTO user_roles (user_id, role)
  VALUES (new_user_id, 'provider');

  -- Create provider profile
  INSERT INTO providers (
    id, user_id, first_name, last_name, specialization,
    npi_number, license_number, license_state,
    is_accepting_patients, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    'Michael',
    'Jones',
    'Internal Medicine',
    '0987654321',
    'MD54321',
    'CA',
    true,
    NOW(),
    NOW()
  );

  RAISE NOTICE 'Doctor 2 created: dr.jones@demo.com (Dr. Michael Jones)';
END $$;

-- ========================================
-- VERIFY ALL ACCOUNTS
-- ========================================
SELECT
  u.email,
  COALESCE(ur.role, 'platform_owner') as role,
  u.email_confirmed_at IS NOT NULL as confirmed,
  u.created_at
FROM auth.users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
WHERE u.email IN (
  'platform@demo.com',
  'admin@demo.com',
  'dr.smith@demo.com',
  'dr.jones@demo.com'
)
ORDER BY
  CASE u.email
    WHEN 'platform@demo.com' THEN 1
    WHEN 'admin@demo.com' THEN 2
    WHEN 'dr.smith@demo.com' THEN 3
    WHEN 'dr.jones@demo.com' THEN 4
  END;

-- ========================================
-- ACCOUNTS CREATED
-- ========================================
-- Platform Owner: platform@demo.com / Demo2025!
-- Pharmacy Admin: admin@demo.com / Demo2025!
-- Doctor 1: dr.smith@demo.com / Doctor2025! (Dr. Sarah Smith)
-- Doctor 2: dr.jones@demo.com / Doctor2025! (Dr. Michael Jones)
-- ========================================
