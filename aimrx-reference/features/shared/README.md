# Shared Tracker Components

This module provides reusable components and patterns for implementing consistent tracker
functionality across the application.

## Components

### BaseTrackerLayout

A standardized layout component for all tracker pages featuring:

- Consistent back button navigation
- Uniform title styling
- Optional header actions
- Responsive container sizing

```tsx
import { BaseTrackerLayout } from "@/features/shared";

<BaseTrackerLayout
  title="Mood Tracker"
  description="Track your daily emotional well-being"
  onBack={() => router.back()}
  headerActions={<Button>Export Data</Button>}
>
  {/* Tracker content */}
</BaseTrackerLayout>;
```

### TrackerModal

A standardized modal component for data entry in trackers:

- Consistent styling across all trackers
- Responsive sizing options (default, large, fullscreen)
- Built-in close functionality
- Optional footer actions

```tsx
import { TrackerModal } from "@/features/shared";

<TrackerModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Log New Entry"
  description="Record your current mood and influences"
  size="large"
  footerActions={<Button onClick={handleSave}>Save Entry</Button>}
>
  {/* Modal content */}
</TrackerModal>;
```

### NavigationCard

A reusable card component for dashboard navigation:

- Consistent hover states and styling
- Icon integration
- Support for different sizes (default, large)
- Accessible button implementation

```tsx
import { NavigationCard } from "@/features/shared";

<NavigationCard
  title="Track Moods"
  description="Monitor your daily emotional well-being"
  icon={Heart}
  onClick={() => router.push("/mood-tracker")}
  variant="large"
/>;
```

## Usage Guidelines

1. **Consistency**: All tracker pages should use `BaseTrackerLayout` for uniform UX
2. **Modal Pattern**: Use `TrackerModal` for all data entry to maintain consistency
3. **Navigation**: Use `NavigationCard` for dashboard navigation elements
4. **Accessibility**: All components include proper ARIA labels and keyboard navigation

## Architecture Principles

- **Reusability**: Components are designed to work across different tracker types
- **Consistency**: Uniform styling and behavior patterns
- **Accessibility**: Built-in support for screen readers and keyboard navigation
- **Responsive**: Mobile-first design with responsive breakpoints
