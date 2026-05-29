# Provider Availability Feature

This feature manages provider availability schedules for appointment booking. Providers can set their regular weekly schedules and define exceptions for holidays or special circumstances.

## Features

- View and manage weekly availability schedules
- Add new availability blocks with customizable time ranges
- Edit existing availability schedules
- Delete availability blocks
- Support for recurring weekly patterns (e.g., Mon-Fri 9am-5pm)
- Support for one-time availability exceptions
- Automatic provider identification based on authenticated user
- Role-based access control (providers only)

## Structure

- `ProviderAvailability.tsx`: Main feature component
- `components/`: Subcomponents for UI elements
  - `AvailabilityList.tsx`: Displays list of availability blocks
  - `AvailabilityCard.tsx`: Individual availability block display
  - `NewScheduleForm.tsx`: Form for creating new schedules
  - `EditScheduleForm.tsx`: Form for editing existing schedules
  - `TimeRangeInput.tsx`: Time selection component
  - `DayPicker.tsx`: Day of week selection
  - `DeleteModal.tsx`: Confirmation modal for deletions
- `hooks/`: Custom hooks for state and logic
  - `useProviderAvailabilityData.ts`: Manages data fetching and mutations
- `utils/`: Utility functions
  - `availability-mapper.ts`: Maps between UI and database models
- `types.ts`: TypeScript type definitions
- `index.ts`: Barrel exports

## Authentication & Authorization

The component implements production-ready authentication:

1. **Authentication Check**: Redirects to `/auth` if user is not authenticated
2. **Role Verification**: Redirects to home page `/` if user is not a provider
3. **Dynamic Provider ID**: Automatically fetches the provider ID from the `providers` table based on the authenticated user's ID
4. **Data Isolation**: Each provider can only view and manage their own availability

## Usage

```tsx
import { ProviderAvailability } from "@/features/provider-availability";

export default function ProviderAvailabilityPage() {
  return <ProviderAvailability />;
}
```

## Data Model

### provider_availability table
- `id`: UUID primary key
- `provider_id`: UUID foreign key to providers table
- `day_of_week`: Integer (0-6, where 0 is Sunday)
- `start_time`: Time
- `end_time`: Time
- `created_at`: Timestamp
- `updated_at`: Timestamp

### provider_availability_exceptions table
- `id`: UUID primary key
- `provider_id`: UUID foreign key to providers table
- `date`: Date
- `start_time`: Time (nullable - null means unavailable all day)
- `end_time`: Time (nullable)
- `is_available`: Boolean
- `reason`: Text (optional)
- `created_at`: Timestamp
- `updated_at`: Timestamp

## Key Functions

### Provider ID Resolution
The component automatically resolves the provider ID:
```typescript
const { user, userRole } = useUser();
// Fetch provider ID from providers table
const providerId = await fetchProviderId(user.id);
```

### Availability Mapping
The feature uses a mapping system to convert between:
- UI representation (e.g., "Mon - Fri, 9:00am - 5:00pm")
- Database representation (individual day_of_week entries)

### Time Zone Handling
All times are stored in the provider's local timezone and displayed accordingly.

## Future Enhancements

- Integration with appointment booking system
- Support for multiple location-specific schedules
- Recurring exception patterns (e.g., every first Monday)
- Capacity limits per time slot
- Buffer times between appointments 