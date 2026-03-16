# Starting a New Project - Complete Setup Guide

This guide walks through all the steps required to set up a new project from this foundation,
including local setup and Supabase configuration.

## Prerequisites

- Node.js 18+ and npm installed
- Git installed
- Access to a Supabase project (create one at [supabase.com](https://supabase.com))
- SendGrid API key for email configuration

## Part 1: Local Project Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Topflightapps/tfa-components-foundation <new-project-name>
cd <new-project-name>

# Remove the existing git history and start fresh
rm -rf .git

# Clear migration metadata before adding files to git because this is a fresh database
rm -rf core/database/migrations/*

# Initialize the Drizzle Journal
mkdir -p core/database/migrations/meta
echo '{
  "version": "7",
  "dialect": "postgresql",
  "entries": []
}' > core/database/migrations/meta/_journal.json


git init

git add .
git commit -m "Initial commit from foundation"
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables Setup

Create a `.env` file in the root directory and setup all the environment variables required.

## Part 2: Supabase Configuration

### 1. Authentication Setup

#### Disable Email Confirmation

1. Navigate to **Authentication** → **Sign In / Providers** → **Email**
2. Uncheck **"Confirm email"**

#### Configure Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to: `http://localhost:3000`
3. Add the following to **Redirect URLs**:
   - `http://localhost:3000`
   - `http://localhost:3000/auth/reset-password`

   > **Note**: Add your production domain URLs once available (e.g., `https://yourdomain.com`)

### 2. Email Configuration (SMTP)

1. Navigate to **Authentication** → **Emails** → **SMTP Settings**
2. Enable **Custom SMTP**
3. Configure with the following SendGrid settings:

   | Setting         | Value                                   |
   | --------------- | --------------------------------------- |
   | **Sender**      | Use your verified SendGrid sender email |
   | **Sender Name** | Your app name                           |
   | **Host**        | `smtp.sendgrid.net`                     |
   | **Port**        | `587`                                   |
   | **Username**    | `apikey`                                |
   | **API Key**     | Your SendGrid API key                   |

4. Change **"Minimum interval between emails being sent"** to `1`

### 3. Database Setup

#### Run Migrations and Apply Core Security

```bash
# Create initial schema
npm run db:generate initial_schema

# Run initial migrations
npm run db:migrate

# Apply core security migrations (automated)
npx tsx core/database/scripts/apply-core-migrations.ts
```

This will:

1. Create all database tables:
   - User roles table with enum types (user, admin, provider)
   - Auth hook function for JWT claims
   - All other user tables
   - Row Level Security policies

2. Apply core security migrations automatically:
   - Secure the drizzle migrations table
   - Set up auth access hook function

### 4. Enable Auth Hooks

> **Important**: Only do this AFTER migrations and core security setup are complete!

1. Go to **Authentication** → **Auth Hooks**
2. Click **Add Hook**
3. Select **Customize Access Token (JWT) Claims Hook**
4. Choose the postgres function: `custom_access_token_hook`
5. Click **Create hook**

### 5. Seed the database (optional)

Fill the database with data from `core/database/seeds/data/`.

```bash
npm run db:seed
```
