# Admin Dashboard Feature

## Overview

The Admin Dashboard provides a comprehensive administrative interface with role-based access control
(RBAC), user management, and system monitoring capabilities. It implements a clean separation
between user accounts and patient/provider profiles, with dedicated views for managing different
user types and system metrics.

## Architecture & Structure

- **Feature Isolation:** All admin functionality lives in `features/admin-dashboard/`
- **Thin Pages:** Pages under `app/(features)/admin/` only import and render feature components
- **Reusable UI:** Shared components like `BaseTableManagement` handle common table patterns
- **Types & Utils:** Shared types and utilities in `types.ts` for type safety

## Main Components

### Core Components

- **AdminDashboard:** Main dashboard with tabbed interface for different admin functions
- **UserManagement:** Comprehensive user account creation and management
- **PatientsManagement:** Patient data viewing and management interface
- **ProvidersManagement:** Provider data viewing and management interface
- **ResourcesManagement:** Educational resources CRUD operations and management
- **BaseTableManagement:** Reusable table component with search, filter, and loading states

### Dashboard Components

- **Overview Tab:** System statistics and metrics display
- **Users Tab:** User creation and management interface
- **Patients Tab:** Patient data management interface
- **Providers Tab:** Provider data management interface
- **Resources Tab:** Educational resources management interface
- **Settings Tab:** System configuration interface (placeholder for future)

### UI Components

- **CreateUserForm:** Form for creating new admin/provider accounts
- **UserTable:** Interactive table for user listing and management
- **StatusBadges:** Role and status indicators for users
- **SearchFilter:** Combined search and filter controls

## Pages

- `/admin` — Main admin dashboard
- `/admin/users` — User management interface
- `/admin/patients` — Patient management interface
- `/admin/providers` — Provider management interface
- `/admin/resources` — Resources management interface

## Features

- **User Management:**
  - Create admin/provider accounts
  - View and search all users
  - Filter by role and status
  - Monitor user activity

- **Resources Management:**
  - Create, edit, and delete educational resources
  - Support for PDF, Article, Video, and Link types
  - File upload for cover images and PDFs
  - Tag-based organization and filtering
  - Search and filter capabilities

- **Role-Based Access:**
  - Distinct admin/provider/patient roles
  - Role-specific routing and features
  - Protected admin routes and API endpoints

- **Data Management:**
  - Patient data overview
  - Provider data overview
  - Resources data overview
  - Real-time data updates
  - Export capabilities (planned)

## Data Model & Supabase Integration

### Tables

- **user_roles**
  - \`user_id\`, \`role\`, \`created_at\`
- **patients**
  - \`id\`, \`user_id\`, \`first_name\`, \`last_name\`, \`email\`, \`phone_number\`,
    \`date_of_birth\`, \`city\`, \`state\`
- **providers**
  - \`id\`, \`user_id\`, \`first_name\`, \`last_name\`, \`email\`, \`phone_number\`,
    \`specialization\`, \`license_number\`, \`city\`, \`state\`
- **resources**
  - \`id\`, \`title\`, \`description\`, \`url\`, \`cover_src\`, \`type\`, \`tags\`, \`created_at\`,
    \`updated_at\`

### Features

- **Security:** RLS policies restrict access to admin users
- **Performance:** Indexed columns for efficient querying
- **Real-time:** Live updates for user management

## API Endpoints

- **POST /api/admin/users**
  - Create new admin/provider accounts
  - Automatic role assignment
  - Profile creation for providers

- **GET /api/admin/users**
  - List all users with roles
  - Search and filter capabilities
  - Status information

- **GET /api/admin/patients**
  - List all patient data
  - Search and filter capabilities
  - Status tracking

- **GET /api/admin/providers**
  - List all provider data
  - Search and filter capabilities
  - License and specialization info

- **GET /api/admin/resources**
  - List all educational resources
  - Search and filter capabilities
  - Tag aggregation

- **POST /api/admin/resources**
  - Create new educational resource
  - Support for all resource types
  - File upload handling

- **PUT /api/admin/resources/[id]**
  - Update existing resource
  - Modify all resource fields
  - Tag management

- **DELETE /api/admin/resources/[id]**
  - Delete resource with confirmation
  - Cascade cleanup (if implemented)

## Security & Access Control

- **Route Protection:** Admin-only route guards
- **API Security:** Admin role verification on all endpoints
- **Data Access:** RLS policies in Supabase
- **Audit Trail:** User action tracking (planned)

## Dependencies

- Next.js 15.2.3 (framework)
- Supabase (auth/database)
- ShadcnUI (UI components)
- Lucide React (icons)
- Tailwind CSS (styling)
- React Hook Form (forms)
- Zod (validation)

## Testing

### Test Accounts

- Admin: \`h.alkhammal@gmail.com\` / \`Specode.123\`
- Provider: \`demo+provider1@specode.ai\` / \`Specode.123\`

### Test Scenarios

1. Admin dashboard access and navigation
2. User creation and management
3. Patient/Provider data viewing
4. Resources creation, editing, and deletion
5. Search and filter functionality
6. Role-based access control

## Future Enhancements

- User editing capabilities
- Bulk user operations
- Advanced filtering options
- Audit logging system
- Analytics dashboard
- Export functionality
- Email notifications
- System settings configuration

---

For implementation details, see the component files in \`features/admin-dashboard/\`.
