# Admin Dashboard Components

This directory contains reusable components for the admin dashboard feature.

## Components

### MetricCard

A reusable card component for displaying dashboard metrics with loading states and growth
indicators.

#### Usage

```tsx
import { MetricCard } from "@/features/admin-dashboard";

<MetricCard title="Total Patients" value={1234} growth={20.1} isLoading={false} />;
```

#### Props

- `title: string` - The title displayed in the card header
- `value: number` - The numeric value to display
- `growth: number` - The growth percentage (positive or negative)
- `isLoading?: boolean` - Whether to show loading skeleton (default: false)
- `className?: string` - Additional CSS classes

#### Features

- **Loading States**: Shows skeleton placeholders while data is loading
- **Growth Indicators**: Color-coded growth percentages (green for positive, red for negative)
- **Number Formatting**: Properly formatted numbers with locale support
- **Responsive Design**: Adapts to different screen sizes
- **Consistent Styling**: Matches the overall admin dashboard design

#### Styling

The component uses Tailwind CSS classes and follows the design system:

- Green text (`text-green-600`) for positive growth
- Red text (`text-red-600`) for negative growth
- Muted text (`text-muted-foreground`) for zero growth
- Consistent spacing and typography with other dashboard components
