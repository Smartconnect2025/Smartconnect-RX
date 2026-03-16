# Provider Dashboard Hooks

This directory contains React hooks for the provider dashboard functionality.

## useProviderAvailability

A comprehensive hook for managing provider availability schedules with timezone conversion support.

### Features

- **Weekly Schedule Management**: Set availability for each day of the week with multiple time slots
- **Date-Specific Overrides**: Override availability for specific dates
- **Timezone Conversion**: Automatic conversion between local timezone and UTC for database storage
- **Auto-Detection**: Automatically detects browser timezone for new providers
- **Database Integration**: Full CRUD operations with Supabase

### Database Schema

The hook works with two main tables:

#### provider_availability
```sql
CREATE TABLE provider_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES providers(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,        -- Stored in UTC
  end_time time NOT NULL,          -- Stored in UTC
  provider_timezone text NOT NULL, -- Provider's local timezone
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### provider_availability_exceptions
```sql
CREATE TABLE provider_availability_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES providers(id) ON DELETE CASCADE,
  exception_date date NOT NULL,
  start_time time,                 -- Stored in UTC (nullable)
  end_time time,                   -- Stored in UTC (nullable)
  is_available boolean NOT NULL,
  provider_timezone text NOT NULL, -- Provider's local timezone
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Timezone Conversion

The hook handles timezone conversion automatically:

- **Storage**: All times are stored in UTC in the database
- **Display**: Times are converted to the provider's local timezone for UI display
- **Input**: User inputs are converted from local timezone to UTC before saving

#### Conversion Functions

```typescript
// Convert local time to UTC for database storage
const convertToUTC = (localTime: string, timezone: string): string => {
  // Uses fixed reference date to avoid DST issues
  // Returns time in HH:MM format (UTC)
}

// Convert UTC time to local timezone for display
const convertFromUTC = (utcTime: string, timezone: string): string => {
  // Converts UTC time to provider's local timezone
  // Returns time in HH:MM format (local)
}
```

### Usage

```typescript
import { useProviderAvailability } from './useProviderAvailability';

function AvailabilityComponent() {
  const {
    availabilityData,
    setAvailabilityData,
    saveAvailabilityData,
    isLoading,
    error,
    providerId,
  } = useProviderAvailability();

  // availabilityData contains:
  // - days: Array of day schedules with local times
  // - timezone: Provider's selected timezone
  // - dateOverrides: Array of date-specific overrides

  const handleSave = async () => {
    try {
      await saveAvailabilityData(availabilityData);
      // Times are automatically converted to UTC before saving
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  return (
    // Your UI components
  );
}
```

### Data Flow

1. **Loading**: 
   - Fetch provider ID from authenticated user
   - Load availability data from database (UTC times)
   - Convert UTC times to local timezone for display

2. **Editing**:
   - User modifies times in their local timezone
   - Changes are stored in component state (local times)

3. **Saving**:
   - Local times are converted to UTC
   - Data is saved to database with UTC times
   - Provider timezone is stored separately

### Error Handling

- Graceful fallbacks for timezone conversion errors
- Loading and error states for UI feedback
- Comprehensive error messages for debugging

### New Provider Behavior

- Auto-detects browser timezone
- Provides default Mon-Fri 8:30 AM - 5:00 PM schedule
- Requires timezone selection before saving

### Existing Provider Behavior

- Loads existing timezone from database
- Converts stored UTC times to local timezone
- Maintains existing schedule structure 

## useProviderAppointments

A React hook that fetches and manages appointments for the currently authenticated provider.

### Features

- Automatically fetches provider ID from the authenticated user
- Loads upcoming appointments with patient information
- Provides appointment cancellation functionality
- Handles loading and error states
- Real-time data updates

### Usage

```tsx
import { useProviderAppointments } from "@/features/provider-dashboard/hooks/useProviderAppointments";

function MyComponent() {
  const { 
    appointments, 
    loading, 
    error, 
    providerId,
    fetchAppointments, 
    cancelAppointment 
  } = useProviderAppointments();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {appointments.map(appointment => (
        <div key={appointment.id}>
          <h3>{appointment.patient.first_name} {appointment.patient.last_name}</h3>
          <p>{appointment.reason}</p>
          <button onClick={() => cancelAppointment(appointment.id)}>
            Cancel
          </button>
        </div>
      ))}
    </div>
  );
}
```

### Return Values

- `appointments`: Array of `ProviderAppointment` objects with patient information
- `loading`: Boolean indicating if data is being fetched
- `error`: String with error message if something went wrong
- `providerId`: The provider ID for the current user (null if not found)
- `fetchAppointments`: Function to manually refresh appointment data
- `cancelAppointment`: Function to cancel an appointment by ID

### Data Structure

The hook returns appointments with the following structure:

```typescript
interface ProviderAppointment {
  id: string;
  provider_id: string;
  patient_id: string;
  datetime: string; // ISO datetime string
  duration: number; // Duration in minutes
  type: string; // "video", "phone", "chat", etc.
  reason: string; // Purpose of the appointment
  created_at?: string;
  updated_at?: string;
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}
```

### Requirements

- User must be authenticated
- User must have a corresponding provider record in the `providers` table
- Provider record must be linked via `user_id` field

### Database Dependencies

This hook requires the following database tables:
- `providers` - Provider information linked to auth users
- `appointments` - Appointment records
- `patients` - Patient information

### Error Handling

The hook handles several error scenarios:
- User not authenticated
- Provider not found for user
- Database connection issues
- Permission errors

All errors are captured in the `error` state and can be displayed to the user. 