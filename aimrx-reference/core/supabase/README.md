# Supabase Core Module

This module provides utilities for interacting with Supabase in different contexts within the
application.

## Module Structure

- **types.ts** - Type definitions for Supabase integration
- **client.ts** - Client-side Supabase client creator
- **server.ts** - Server-side Supabase client creator
- **admin.ts** - Admin client creator for server-side operations requiring service role
- **middleware.ts** - Middleware session handling
- **index.ts** - Barrel exports for the module

## Components

### Client

Handles Supabase client creation for browser/client-side operations.

- `createClient()`: Creates and returns a Supabase browser client.

### Server

Handles Supabase client creation for server-side operations.

- `createServerClient()`: Creates and returns a Supabase server client with cookie handling for
  Next.js server components.

### Admin

Handles Supabase admin client creation for server-side operations requiring elevated privileges.

- `createAdminClient()`: Creates and returns a Supabase admin client using the service role key for
  administrative operations.

### Middleware

Manages authentication and session handling in Next.js middleware.

- `updateSession(request)`: Updates the Supabase session during middleware execution, handles
  authentication state, and enforces route access control based on user roles.

## Usage Examples

### Client-side

```tsx
// Import from the index file
import { createClient } from "@core/supabase";

// In a client component
const supabase = createClient();
const { data } = await supabase.from("table_name").select("*");
```

### Server-side

```tsx
// Import from the index file
import { createServerClient } from "@core/supabase";

// In a server component or API route
async function getData() {
  const supabase = await createServerClient();
  const { data } = await supabase.from("table_name").select("*");
  return data;
}
```

### Admin Operations

```tsx
// Import from the index file
import { createAdminClient } from "@core/supabase";

// In a server component or API route for admin operations
async function deleteUser(userId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.deleteUser(userId, true);
  return { success: !error };
}
```

### Middleware

The middleware functionality is typically used in your `middleware.ts` file:

```tsx
// Import from the index file
import { updateSession } from "@core/supabase";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}
```

## Environment Variables

The following environment variables must be set in your `.env` file:

```bash
# Supabase URL (public)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url

# Supabase Anon Key (public)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Supabase Service Role Key (private - server only)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Important**: The `SUPABASE_SERVICE_ROLE_KEY` should never be exposed to the client-side code. It
provides full admin access to your Supabase project and should only be used in server-side
operations.

## Important Notes

- The middleware session handling includes critical steps to maintain authenticated sessions - don't
  modify the core flow without understanding the implications.
- User roles are extracted from JWT tokens and used for route access control.
- Server-side cookie handling requires special consideration in Server Components.
- Admin operations using `createAdminClient()` should only be performed in server-side code (server
  actions, API routes, or server components).
- Never expose the service role key in client-side code or browser bundles.
