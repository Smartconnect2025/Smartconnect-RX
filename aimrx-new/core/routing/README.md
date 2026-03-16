# Routing Protection Module

The Routing Protection module handles access control for the application's routes based on authentication status and user roles.

## Features

- Route-based access control
- Support for multiple route types:
  - `public` - Accessible to everyone
  - `auth` - Only for unauthenticated users (login, signup)
  - `user` - For authenticated users
  - `provider` - For users with provider role
  - `special` - Routes with custom access logic
- Path pattern matching (exact or prefix)
- Automatic redirects based on access rules

## Module Structure

- **types.ts** - Type definitions for the routing module
- **routes-config.ts** - Configuration file for defining protected routes
- **utils.ts** - Utility functions for route handling
- **route-guard.ts** - Main route protection implementation

## Usage

This module is primarily used by the middleware to protect routes:

```typescript
// In your middleware.ts
import { handleRouteAccess } from "@core/routing";

// Check access based on authentication and role
const authInfo = { isAuthenticated: !!user, role: userRole };
const redirectResponse = handleRouteAccess(request, authInfo);
if (redirectResponse) {
  return redirectResponse;
}
```

## Configuring Routes

To add or modify protected routes, update the `protectedRoutes` array in `routes-config.ts`:

```typescript
// core/routing/routes-config.ts
export const protectedRoutes: ProtectedRouteConfig[] = [
  {
    type: "user",
    patterns: [
      { path: "/dashboard", exact: false },
      // Additional paths...
    ],
  },
  // Additional route configurations...
];
```

## Customizing Redirects

You can customize redirect paths by modifying the `redirectPaths` object in `routes-config.ts`:

```typescript
// core/routing/routes-config.ts
export const redirectPaths = {
  home: "/",
  login: "/auth/signin",
  dashboard: "/dashboard",
  // Add or modify redirect paths as needed
};
```
