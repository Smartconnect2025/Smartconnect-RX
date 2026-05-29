# Super Admin Setup - IMPORTANT

## Database Migrations Required

Before the super admin feature will work, you MUST create the `system_logs` table in your Supabase database.

### Step 1: Create the system_logs table

Run this SQL in your Supabase SQL Editor:

```sql
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

-- Create index on created_at for faster queries
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);

-- Create index on action for filtering
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);

-- Create index on user_id for user lookups
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
```

### Step 2: Create Super Admin User Account

You need to create a user account in Supabase Auth with the super admin email:

**Option A: Via Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Users**
3. Click **"Add user"** (or "Invite user")
4. Enter:
   - Email: `super@smartconnects.com`
   - Password: `Super2025!`
   - Confirm password: `Super2025!`
5. **IMPORTANT**: Check "Auto Confirm User" (skip email verification)
6. Click "Create user"

**Option B: Via SQL**
```sql
-- This will create the user and auto-confirm them
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_sent_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'super@smartconnects.com',
  crypt('Super2025!', gen_salt('bf')),
  NOW(),
  NOW(),
  '',
  '',
  '',
  '',
  NOW(),
  NOW()
);
```

### Step 3: Login Credentials

Once the user is created, you can login with:

**Email:** `super@smartconnects.com`
**Password:** `Super2025!`

### Step 4: Verify Access

1. Login to the application with the super admin credentials
2. Click on your profile dropdown (top-right avatar)
3. You should see a **"Super Admin"** link in the dropdown
4. Click it to access the Super Admin Dashboard at `/super-admin`

## What the Super Admin Dashboard Shows

### 1. API Health
- DigitalRx connection status (green/red)
- Last checked timestamp
- Force API Test button

### 2. Prescription Statistics
- Prescriptions submitted today
- Prescriptions submitted this week
- Total prescriptions all-time

### 3. Last 10 Prescriptions Table
Shows:
- Date submitted
- Doctor (prescriber email/ID)
- Patient name
- Medication + dosage
- Current status
- Queue ID

### 4. System Log (Last 200 entries)
Shows:
- Action type (PRESCRIPTION_SUBMITTED, API_TEST, CACHE_CLEAR)
- Timestamp
- User who performed action
- Details/description
- Queue ID (if applicable)
- Status (success/error)

## Important Notes

1. **Only users with @smartconnects.com emails or joseph@smartconnects.com can access the Super Admin dashboard**
2. **The "Super Admin" link only appears for authorized users** - other users won't see it
3. **System logs are persistent** - stored in Supabase, not localStorage
4. **All prescription submissions automatically log to system_logs** table
5. **API tests and cache clears also create log entries**

## Troubleshooting

### "Table 'system_logs' does not exist"
- You need to run the SQL from Step 1 above

### "Super Admin link doesn't appear"
- Make sure you're logged in with an @smartconnects.com email or joseph@smartconnects.com
- Check the browser console for errors

### "No prescriptions showing"
- Prescriptions must be submitted via the wizard (not in demo data)
- They are now stored in the Supabase `prescriptions` table
- Old localStorage prescriptions won't appear

### "Can't login with super@smartconnects.com"
- Make sure the user was created in Supabase Auth
- Check that email verification was skipped (auto-confirmed)
- Try resetting the password via the Supabase dashboard

## Security

- The super admin page checks email authorization server-side
- Unauthorized users are redirected to home page
- Super admin dashboard is **read-only** - cannot modify data
- All system actions are logged for audit trail

## Next Steps

After creating the super admin user:
1. Test login with super@smartconnects.com / Super2025!
2. Submit a test prescription as a provider
3. Switch to super admin view
4. Verify the prescription appears in "Last 10 Prescriptions"
5. Verify the submission appears in "System Log"
6. Test the "Force API Test" button
7. Test the "Refresh Data" button
