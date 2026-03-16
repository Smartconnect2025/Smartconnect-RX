# Components Foundation

## Overview

This document outlines the foundational architecture of the project, including its core file
structure and the separation between core and feature components. It also details the main libraries
used and how the app is integrated with Next.js and other services.

## Documentation

- **Foundation documentation**: Lives inside `docs` (01-architecture.md, 02-start-new-project,
  etc.).
- **Feature documentation**: Each feature directory includes a README.md file with specific
  documentation.
- **Core component documentation**: Each core component directory includes a README.md with specific
  documentation.
- **Integration documentation**: External API documentation and integration guides are stored in
  `/docs/integrations/` to help developers work more efficiently.

## Libraries

The project uses the following core libraries and tools:

- **Core**: Next.js 15.2.3, React 19, TypeScript
- **UI**: Tailwind CSS v4, ShadCN UI (built on Radix UI components)
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod
- **Database**: Drizzle ORM for migrations + Supabase for CRUD
- **Backend**: Supabase (authentication and data)
- **Utilities**: Sonner (toast notifications), date-fns
- **Icons**: Lucide React

## Root Structure

```
/
├── app/							# Next.js App Router pages
│   ├── (features)/					# Feature components with pages
│   ├── auth/						# Auth pages
│   ├── api/						# API routes
│   ├── theme.css					# Global styles and theming
│   └── layout.tsx					# Root layout with providers
├── components/						# Reusable components
│   ├── ui/							# ShadCN UI components
│   └── layout/						# Layout components
├── core/							# Core components and services
│   ├── auth/						# Authentication
│   ├── config/             		# Configuration management
│   ├── constants/          		# Global constants (timezones, states, etc.)
│   ├── database/           		# Drizzle schemas and migrations
│   ├── routing/            		# Route protection
│   └── supabase/           		# Supabase client and server setup
├── features/               		# Feature components
│   ├── feature-1/          		# Self-contained feature component
│   └── feature-2/          		# Self-contained feature component
├── hooks/                 			# Global custom hooks
│   ├── use-filter-state.ts 		# Shared utility hooks
│   └── use-media-query.ts 		 	# Common hooks used across features
├── utils/                			# Utility functions and helpers
│   └── tailwind-utils.ts			# Tailwind utilities
├── public/                			# Static assets
└── docs/                  			# Documentation
    ├── 01-architecture.md			# Architecture documentation
    ├── 02-start-new-project.md		# Setup instructions for a new project
    └── integrations/       		# Integration docs (e.g., Dosespot APIs, Stripe, MerchantX)

```

## Core Components Structure

Each core component directory will include a README file describing its purpose, usage, and any
important details for developers.

```
core/
├── auth/
│   ├── README.md            # Documentation for auth components
│   ├── AuthProvider.tsx
│   └── ...
├── config/
│   ├── README.md            # Documentation for configuration
│   └── ...
└── ...

```

## Components Directory Structure

```
components/
├── ui/                      # ShadCN UI components
│   ├── button.tsx
│   ├── input.tsx
│   └── ...
└── layout/                  # Layout components (feature-specific, not core)
    ├── header.tsx
    ├── footer.tsx
    └── ...

```

## Feature Components Structure

Features should follow a flexible structure where **most directories and files are optional** - only
create what you need for your specific feature. The only required files are:

- `README.md` - Documentation for the feature
- `index.ts` - Barrel exports for clean imports
- At least one component file

**Full structure (all optional except README.md and index.ts):**

```plaintext
features/feature-name/
├── README.md                # ✅ REQUIRED - Documentation for this feature
├── index.ts                 # ✅ REQUIRED - Barrel file with exports for clean imports
├── types.ts                 # OPTIONAL - Feature-specific type definitions
├── utils.ts                 # OPTIONAL - Feature-specific utilities and helpers
├── constants.ts             # OPTIONAL - Feature-specific constants
├── api.ts                   # OPTIONAL - API calls and data fetching
├── hooks/                   # OPTIONAL - Custom hooks directory
│   └── use-feature.ts       # Feature-specific hooks
├── components/              # OPTIONAL - Feature components directory
│   ├── FeaturePage.tsx      # Main page component
│   ├── FeatureCard.tsx      # Reusable component
│   └── domain/              # OPTIONAL - Domain-specific components
│       ├── DomainItem.tsx   # Components organized by domain
│       └── DomainList.tsx   # or functionality
├── store/                   # OPTIONAL - State management directory
│   └── feature-store.ts     # Zustand store
└── services/                # OPTIONAL - Business logic and external integrations
    └── feature-service.ts   # Service layer functions
```

**Guidelines:**

- **Start simple**: Begin with just the required files and a single component
- **Add as needed**: Only create additional directories/files when your feature grows
- **Single component features**: Can live directly in the feature root (e.g., `SimpleFeature.tsx`)
- **Complex features**: Use the full directory structure for better organization

### Real Example: Storefront Feature

Our storefront feature demonstrates this organization pattern:

```plaintext
features/storefront/
├── README.md                # Documentation
├── index.ts                 # Exports all components, hooks, and utils
├── types.ts                 # Product, cart, and category types
├── utils.ts                 # Price formatting, discount calculations
├── constants.ts             # Discount rates, product FAQs
├── hooks/
│   └── use-cart.ts          # Cart management hook
├── components/
│   ├── Homepage.tsx         # Main storefront page
│   ├── ProductPage.tsx      # Product detail page
│   ├── ProductCard.tsx      # Reusable product card
│   ├── CategoryPage.tsx     # Category listing page
│   ├── product/             # Product-specific components
│   │   ├── ProductActions.tsx  # Add-to-cart and pricing
│   │   ├── ProductImage.tsx    # Product image display
│   │   └── AddToCartButton.tsx # Cart interaction
│   └── cart/                # Cart-specific components
│       ├── CartDrawer.tsx   # Slide-out cart
│       ├── CartItem.tsx     # Individual cart line item
│       └── CartSummary.tsx  # Cart totals and checkout
└── store/                   # State management (if using Zustand)
```

This structured approach:

- **Organizes by domain**: Related components are grouped in subdirectories
- **Maintains clean imports**: The barrel file (index.ts) exports everything consumers need
- **Separates concerns**: UI components, hooks, types, and utilities each have their own files
- **Scales well**: As the feature grows, the structure accommodates new components logically

The barrel file (index.ts) re-exports all components and utilities for clean imports:

```ts
// Export main components
export { Homepage } from "./components/Homepage";
export { ProductCard } from "./components/ProductCard";
// ...other exports

// Export product components
export { ProductActions } from "./components/product/ProductActions";
// ...other product exports

// Export hooks
export { useCart } from "./hooks/use-cart";

// Export types and utils
export * from "./types";
export * from "./utils";
```

This allows other parts of the application to import from the feature with clean syntax:

```ts
import { ProductCard, useCart } from "@/features/storefront";
```

For simple features with minimal components, you can still use the simpler two-file pattern:

```plaintext
features/simple-feature/
├── README.md           # Documentation
├── index.ts            # Exports
└── SimpleFeature.tsx   # Main component
```

### Database Schema Management with Drizzle

We use Drizzle ORM to manage our database schema and provide type-safe database access. All
database-related code lives in `core/database`:

```plaintext
core/database/
├── schema/                  # Drizzle schema definitions
│   ├── index.ts            # Barrel export of all schemas
│   ├── auth.ts             # Auth-related tables (users, sessions, etc.)
│   ├── products.ts         # Product catalog tables
│   ├── orders.ts           # Order management tables
│   ├── appointments.ts     # Appointment booking tables
│   └── ...                 # Other domain schemas
├── migrations/             # SQL migration files
│   ├── meta/              # Drizzle migration metadata
│   └── *.sql              # Migration files
├── db.ts                   # Database client initialization
└── index.ts                # Barrel exports
```

#### Schema Organization

Each schema file defines tables for a specific domain:

```typescript
// Example: core/database/schema/profile.ts
import { pgTable, text, uuid } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  firstName: text("first_name"),
  lastName: text("last_name"),
  // ... other fields
});
```

#### Type Safety

Drizzle automatically generates TypeScript types from your schemas. You can infer types directly:

```typescript
import { users } from "@/core/database/schema";
import { InferSelectModel, InferInsertModel } from "drizzle-orm";

// Types for selecting from the database
type User = InferSelectModel<typeof users>;

// Types for inserting into the database
type NewUser = InferInsertModel<typeof users>;
```

#### Using Database Schemas in Features

Features should import types from Drizzle schemas but use Supabase for all database operations:

```typescript
// In a feature service file
import { createClient } from "@/core/supabase/client";
import { users, profiles } from "@/core/database/schema";
import { InferSelectModel } from "drizzle-orm";

// Get types from Drizzle schemas
type User = InferSelectModel<typeof users>;
type Profile = InferSelectModel<typeof profiles>;

export async function getUserProfile(userId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("users")
    .select(
      `
      *,
      profiles (*)
    `,
    )
    .eq("id", userId)
    .single();

  if (error) throw error;

  // Data is typed as User & { profiles: Profile }
  return data as User & { profiles: Profile };
}
```

Key points:

- Use Drizzle schemas **only** for type definitions
- Use Supabase client for all CRUD operations
- Import types using `InferSelectModel` and `InferInsertModel` from Drizzle
- Cast Supabase responses to Drizzle-generated types for type safety

#### Migrations

Database migrations are managed through Drizzle. To create a new migration check the root README.md

Never edit migration files manually after they've been applied to any environment.

Supabase integration remains under `core/supabase`:

- **`@core/supabase/client.ts`**: Initializes the Supabase client for browser-side queries. Use in
  React components or hooks.
- **`@core/supabase/server.ts`**: Provides server-safe fetching for Next.js data functions and API
  routes.
- **`@core/supabase/admin.ts`**: Provides admin client for server-side operations requiring elevated
  privileges (user deletion, etc.).

Environment variables contain the Supabase URL and keys; import only the client on the browser side
to avoid leaking secrets. The service role key (`SUPABASE_SERVICE_ROLE_KEY`) should only be used in
server-side code.

## Integration with Next.js

In Next.js, separate your feature implementation from the routing layer:

1.  **Feature folder (`/features`)**
    - Contains all UI components, hooks, services, types, and utilities related to the feature.
    - No Next.js-specific routing or page logic here—only pure React and business logic.
    - Can import code from @core or @types

2.  **App folder (`/app/(features)`)**
    - Contains only the Next.js page entries and optional layouts.
    - Each `page.tsx` should be a thin wrapper that imports your feature's primary component from
      `/features` and passes any routing parameters or context to it.

Example: For routing and pages, continue using the App Router under `(features)`:

```plaintext
app/(features)/feature-name/
├── page.tsx            # Imports and renders FeatureName from the feature folder
└── layout.tsx          # Feature-specific layout (optional)

```

- **No duplication**: All component logic stays in `/features`; routing wrappers in `/app` simply
  render them.
- **Layouts**: If a feature needs its own layout (e.g. sidebar or toolbar), add a `layout.tsx` under
  `app/(features)/feature-name/` that wraps the page.
- **Scaling**: This pattern scales as you add more features—each feature lives in its own directory,
  with a clear boundary between React logic and Next.js routing.

## Theming

We use Tailwind CSS v4, so all theming lives in a single file:

```plaintext
/app/theme.css  # Defines colors, fonts, and design tokens via Tailwind variables

```

- No extra theme provider is needed—our CSS variables drive both utility classes and ShadCN
  components.
- ShadCN UI components automatically pick up these Tailwind tokens.
- If you need to tweak a ShadCN component, you can edit its source, but be careful: changes affect
  every place it's used. For isolated overrides, consider copying the component into a
  feature-specific folder before modifying.
