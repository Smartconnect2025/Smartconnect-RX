# Authentication Module

The Authentication module handles user authentication, authorization, and session management for the application.

## Features

- User authentication (sign in, sign up, password reset)
- Role-based authorization
- JWT token management and decoding
- Session persistence
- User context provider for React components

## Module Structure

- **auth-utils.ts** - Utility functions for authentication (token parsing, user serialization)
- **get-user.ts** - Server-side function to fetch the authenticated user
- **UserProvider.tsx** - Server component that provides user context
- **UserClient.tsx** - Client component with authentication state and hooks

## Usage

The Authentication module is used across the application to:

1. Provide user context to components:

```tsx
// In your app/layout.tsx
import { UserProvider } from "@core/auth";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}
```

2. Access user data in client components:

```tsx
"use client";
import { useUser } from "@core/auth";

export function ProfileButton() {
  const { user, userRole } = useUser();
  
  if (!user) return null;
  
  return (
    <button>
      {user.email} ({userRole})
    </button>
  );
}
```

3. Get user data in server components:

```tsx
import { getUser } from "@core/auth";

export default async function DashboardPage() {
  const { user, userRole } = await getUser();
  
  if (!user) {
    // Handle unauthenticated case
    return <p>Please log in</p>;
  }
  
  return (
    <div>
      <h1>Welcome, {user.email}</h1>
      {userRole === "admin" && <AdminPanel />}
    </div>
  );
}
```

## Auth UI Components

The authentication UI components (sign in, sign up, etc.) are managed separately from this core module in the `app/auth` directory but leverage these core utilities. 