# EMR Store Architecture

This directory contains the refactored EMR store implementation, broken down into focused, maintainable modules following the Single Responsibility Principle.

## File Structure

```
store/
├── README.md                     # This documentation
├── index.ts                      # Main exports
├── emr-store.ts                  # Main store (< 50 lines)
├── types.ts                      # TypeScript interfaces
├── helpers.ts                    # Utility functions
├── selectors.ts                  # Performance-optimized selectors
└── actions/
    ├── patient-actions.ts        # Patient-related actions
    ├── encounter-actions.ts      # Encounter-related actions
    ├── medical-data-actions.ts   # Medical data actions (meds, conditions, etc.)
    └── utility-actions.ts        # Utility actions (loading, error, reset)
```

## Architecture Benefits

### 🎯 **Single Responsibility**

- Each file has one clear purpose
- Easy to locate and modify specific functionality
- Reduced cognitive load when working with the code

### 🔄 **Maintainability**

- Modular structure allows for easy testing of individual action groups
- Changes to one domain (e.g., patients) don't affect others
- Clear separation of concerns

### 📈 **Performance**

- Granular selectors prevent unnecessary re-renders
- Action selectors group related actions for better optimization
- Immer middleware for efficient immutable updates

### 🛡️ **Type Safety**

- Comprehensive TypeScript coverage
- Proper typing for all actions and state
- StateCreator pattern ensures type consistency

## Usage

### Importing the Store

```typescript
import { useEmrStore } from "@/features/basic-emr/store";
```

### Using Selectors (Recommended)

```typescript
// State selectors
import { usePatients, useCurrentPatient, useEmrLoading } from "@/features/basic-emr/store";

// Action selectors
import { usePatientActions, useEncounterActions } from "@/features/basic-emr/store";

const MyComponent = () => {
  // Get state
  const patients = usePatients();
  const loading = useEmrLoading();
  
  // Get actions
  const { fetchPatients, createPatient } = usePatientActions();
  
  // Use them...
};
```

### Direct Store Access (When Needed)

```typescript
import { useEmrStore } from "@/features/basic-emr/store";

const MyComponent = () => {
  const patients = useEmrStore((state) => state.patients);
  const fetchPatients = useEmrStore((state) => state.fetchPatients);
};
```

## Key Features

### 🔧 **Middleware Stack**

- **Immer**: Immutable state updates with mutable syntax
- **DevTools**: Redux DevTools integration for debugging
- **SubscribeWithSelector**: Performance optimization for selective subscriptions

### 📊 **Async Handling**

- Centralized `handleAsyncAction` helper for consistent error handling
- Loading states and error management
- Toast notifications for user feedback

### 🎛️ **State Management**

- Centralized state for all EMR entities
- Current item tracking (currentPatient, currentEncounter)
- Utility functions for common operations

## Adding New Actions

To add new actions to an existing domain:

1. **Add to the interface** in `types.ts`
2. **Implement in the appropriate action file** (e.g., `patient-actions.ts`)
3. **Add to the selector** in `selectors.ts` if needed

For new domains, create a new action file following the existing pattern.

## Performance Notes

- Use selectors instead of direct store access when possible
- Group related actions in action selectors
- The store automatically handles loading states and error management
- All operations are optimized with Immer for efficient updates

## Migration from Old Store

The refactored store maintains the same public API, so existing components should work without changes. However, consider migrating to selectors for better performance:

```typescript
// Old approach
const patients = useEmrStore((state) => state.patients);
const fetchPatients = useEmrStore((state) => state.fetchPatients);

// New approach (recommended)
const patients = usePatients();
const { fetchPatients } = usePatientActions();
```

This refactoring reduces the main store file from 700+ lines to under 50 lines while improving maintainability, testability, and performance.
