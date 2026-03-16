# Provider Dashboard Feature

The Provider Dashboard feature provides a comprehensive interface for healthcare providers to manage
their appointments and availability.

## Features

- **Your Sessions View**: Display actual upcoming appointments from the database with patient
  details, appointment types, and real-time data
- **Recent Appointments**: Display past appointments within the last 24 hours with completion status
- **Edit Availability**: Integrated availability management using the existing provider-availability
  component
- **Appointment Organization**: Appointments are grouped by date (Today, Tomorrow, etc.) and sorted
  by time
- **Appointment Types**: Support for video, phone, and chat appointments
- **Real-time Data**: Fetches actual appointments from Supabase database
- **Appointment Management**: Cancel appointments with confirmation dialogs

## Components

- **ProviderDashboard**: Main dashboard component with tabbed interface
- **UpcomingMeetings**: Component that displays real appointments from the database
- **PastAppointments**: Component that displays past appointments within the last 24 hours
- **AppointmentCard**: Individual appointment display component with cancel functionality
- **useProviderAppointments**: Hook for fetching and managing provider appointments
- **Types**: TypeScript interfaces for appointments and component props

## Usage

The Provider Dashboard is designed to be displayed on the homepage for users with the "provider"
role.

```tsx
import { ProviderDashboard } from "@/features/provider-dashboard";

export default function HomePage() {
  const { userRole } = useUser();

  if (userRole === "provider") {
    return <ProviderDashboard />;
  }

  // Other user types...
}
```

## Database Integration

The dashboard now fetches real appointment data from Supabase:

- Connects to `appointments` table with patient information
- Filters to show only future appointments
- Groups appointments by date (Today, Tomorrow, etc.)
- Supports appointment cancellation
- Handles loading and error states

## Integration

- Integrates with the existing `provider-availability` feature for availability management
- Uses the project's UI component library (shadcn/ui)
- Follows the project's styling patterns with Tailwind CSS
- Implements proper TypeScript typing

## Future Enhancements

- Add appointment rescheduling functionality
- Implement real-time updates for appointment changes
- Add filtering and search capabilities
- Add video call integration for "Join" buttons
- Add appointment notes and status updates
- Include appointment statistics and analytics
