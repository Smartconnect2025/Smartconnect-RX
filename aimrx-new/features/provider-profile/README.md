# Provider Profile Feature

A comprehensive healthcare provider profile management system with professional information,
credentials, and practice details.

## Overview

The Provider Profile feature provides a complete provider profile management interface including:

- **Personal Information Management**: Update contact details, demographics, and security settings
- **Professional Information**: Medical licenses, specialties, board certifications, education,
  languages
- **Practice Details**: Services offered, insurance plans accepted, hospital affiliations, practice
  address
- **Real-time Validation**: Form validation using React Hook Form + Zod
- **Database Integration**: Supabase integration for data persistence

## Components

### ProviderProfile

Main provider profile component with unified navigation and routing-based form rendering.
Automatically displays the appropriate form based on the current URL pathname.

```tsx
import { ProviderProfile } from "@/features/provider-profile";

export default function ProviderProfilePage() {
  return <ProviderProfile />;
}
```

### ProviderTabsNavigation

Sticky navigation tabs that match the original design with:

- **Desktop**: Horizontal tabs with underline indicators, centered layout
- **Mobile**: Collapsible hamburger menu with current page title
- **Active State**: Brand color highlighting with CSS pseudo-element underlines
- **Responsive**: Adaptive behavior for different screen sizes

```tsx
import { ProviderTabsNavigation } from "@/features/provider-profile";

export default function Layout({ children }) {
  return (
    <div>
      <ProviderTabsNavigation />
      {children}
    </div>
  );
}
```

## Navigation Architecture

The feature uses Next.js App Router with URL-based navigation:

- `/provider/profile` - Personal information form
- `/provider/professional-info` - Professional credentials form
- `/provider/practice-details` - Practice information form
- `/provider/availability` - Availability management (placeholder)

All pages use the same `ProviderProfile` component which renders the appropriate form based on the
current pathname.

## Form Components

### Tabbed Interface Features

- **Sticky Navigation**: Desktop tabs remain visible when scrolling through long forms
- **Mobile Responsive**: Hamburger menu with smooth animations for mobile devices
- **Active State Management**: Visual indicators show current section with brand color
- **Form State Management**: Individual form validation and submission per section
- **Consistent Layout**: Unified card layout with dynamic titles and descriptions

### ProfileForm

Comprehensive form for managing personal details including:

- Name and demographics
- Contact information (phone, email with verification)
- Security settings (password management)
- Profile avatar upload

### ProfessionalInfoForm

Professional credentials management including:

- Medical licenses by state
- Board certifications
- Education and training history
- Years of experience
- Languages spoken
- Professional associations
- Professional biography

### PracticeDetailsForm

Practice information management including:

- Practice address
- Services offered
- Medical specialties
- Insurance plans accepted
- Hospital affiliations

## Styling & Design

The component follows the original design system with:

- **Brand Colors**: `#66cdcc` (teal) for active states and buttons
- **Typography**: Clean hierarchy with proper spacing
- **Layout**: Card-based design with consistent padding and borders
- **Responsive**: Mobile-first approach with desktop enhancements
- **Accessibility**: Proper ARIA labels and keyboard navigation

## Usage Patterns

### Single Page Implementation

All provider profile pages use the same component:

```tsx
// All these pages use the same component
export default function ProfilePage() {
  return <ProviderProfile />;
}

export default function ProfessionalInfoPage() {
  return <ProviderProfile />;
}

export default function PracticeDetailsPage() {
  return <ProviderProfile />;
}
```

### Navigation Integration

The navigation automatically highlights the current page and manages mobile state:

```tsx
// Automatic active state based on usePathname()
const pathname = usePathname();
const isActive = pathname === route.href;
```

## Development Notes

- Uses Next.js `usePathname()` hook for client-side routing detection
- Form IDs are dynamically generated based on current tab for save button integration
- Mobile menu state is managed with React useState and CSS transitions
- All forms maintain their own validation state using React Hook Form
- Type safety provided through Zod schemas for each form section
