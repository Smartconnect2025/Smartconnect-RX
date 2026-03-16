# Configuration Module

The Configuration module provides type-safe access to environment variables with built-in validation.

## Features

- Type-safe environment variable access
- Separation of required vs. optional variables
- Server-side validation to prevent runtime errors
- Default values for optional variables

## Usage

```typescript
import { envConfig } from "@core/config";

// Access environment variables
const projectName = envConfig.NEXT_PUBLIC_PROJECT_NAME;
```

## Environment Variable Categories

Variables are organized into:

1. **Required** - Application will not start without these
2. **Optional** - Default values provided if not set

## Adding New Variables

When adding new environment variables:

1. Add them to the `envConfig` object in `envConfig.ts`
2. Specify if they're required by adding to the `requiredEnvVars` array
3. Provide sensible default values for optional variables
