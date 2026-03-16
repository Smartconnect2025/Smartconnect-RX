# Super Admin - 3-Tier System Documentation

## Overview

The system now has 3 distinct user roles:

1. **Providers/Doctors** - Create and manage prescriptions
2. **Pharmacy Admin** - Review incoming queue, manage settings
3. **Super Admin** - SmartConnect team monitoring and system oversight

## Super Admin Access

### Who Can Access

Only users with emails matching these patterns can access the Super Admin dashboard:
- Any email ending in `@smartconnects.com`
- Specific email: `joseph@smartconnects.com`

### How to Access

1. **Login** as a user with authorized email
2. **Click profile dropdown** in top-right corner (avatar icon)
3. **Select "Super Admin"** from the dropdown menu
4. **Dashboard appears** at `/super-admin`

The "Super Admin" link only appears for authorized users - other users cannot see or access it.

## Super Admin Dashboard Features

### 1. API Health Card
- **Status indicator**: Green (healthy) or Red (error)
- **Real-time monitoring**: Shows DigitalRx API connection status
- **Last checked timestamp**: When the API was last tested
- **Force API Test button**: Manually trigger API connection test

### 2. Prescription Statistics Card
- **Today**: Count of prescriptions submitted today
- **This Week**: Count of prescriptions submitted in last 7 days
- **All Time**: Total prescription count in system

### 3. Last 10 Prescriptions Table
Displays most recent prescription submissions with:
- Date
- Doctor name
- Patient name
- Medication + strength
- Current status (badge)
- Queue ID

### 4. System Log
Last 20 system actions including:
- **Action type** (PRESCRIPTION_SUBMITTED, API_TEST, CACHE_CLEAR)
- **Timestamp** (when action occurred)
- **User** (who performed the action)
- **Details** (description of what happened)
- **Queue ID** (if applicable)

## Action Buttons

### Force API Test
- Simulates DigitalRx API connection test
- Shows loading state while testing
- Updates API Health card status
- Logs test result to System Log
- Shows toast notification with result

### Clear Cache / Force Refresh
- Reloads all prescription data from localStorage
- Refreshes dashboard statistics
- Logs action to System Log
- Shows confirmation dialog before clearing

## Data Sources

All data is loaded from localStorage:
- `submittedPrescriptions` - All prescription submissions
- `systemLogs` - System activity log (last 100 entries)

## Security

### Route Protection
The `/super-admin` page checks email authorization on load:
```typescript
const email = user?.email?.toLowerCase() || "";
const isSuperAdmin =
  email.endsWith("@smartconnects.com") ||
  email === "joseph@smartconnects.com";
```

If unauthorized, user is redirected to home page (`/`).

### Menu Visibility
The "Super Admin" link in headers uses the same `isSuperAdmin()` check:
- Provider Header (`Header.tsx`)
- Admin Header (`AdminHeader.tsx`)
- Desktop dropdown menu
- Mobile menu drawer

### No Data Modification
Super Admin dashboard is **read-only** for monitoring purposes. It can:
- ✅ View prescription data
- ✅ View system logs
- ✅ Test API connection
- ✅ Refresh data
- ❌ Cannot modify prescriptions
- ❌ Cannot delete data
- ❌ Cannot change user roles

## System Logging

Prescriptions automatically log to system when submitted:
```typescript
{
  id: "log_timestamp",
  timestamp: ISO date string,
  action: "PRESCRIPTION_SUBMITTED",
  user: "Dr. Provider Name",
  details: "Submitted Lisinopril 10mg for John Doe",
  queueId: "RX-ABC-1234"
}
```

Super Admin actions also log:
- API tests (success/failure)
- Cache clears
- System refreshes

## Integration with Existing Roles

### Nothing Changed for Providers
- All provider features remain exactly the same
- New Prescription wizard unchanged
- Prescriptions list unchanged
- No UI changes except dropdown menu link (if authorized)

### Nothing Changed for Pharmacy Admin
- Incoming queue unchanged
- Settings page unchanged
- Doctor management unchanged
- No UI changes except dropdown menu link (if authorized)

### Super Admin is Additive
- New layer on top of existing system
- Does not interfere with provider or admin workflows
- Only visible to authorized SmartConnect team members
- Provides oversight without disrupting operations

## Testing Super Admin Access

### Test as Authorized User
1. Create/use account with email: `test@smartconnects.com`
2. Login to system
3. Open profile dropdown
4. Verify "Super Admin" link appears
5. Click link and verify dashboard loads
6. Test Force API Test button
7. Test Clear Cache button
8. Submit a prescription and verify it appears in Last 10 list
9. Verify system log shows the submission

### Test as Unauthorized User
1. Login with any other email (e.g., `doctor@hospital.com`)
2. Open profile dropdown
3. Verify "Super Admin" link does NOT appear
4. Try navigating directly to `/super-admin`
5. Verify you are redirected to home page

## Demo Credentials

For testing, create a Supabase user with:
- Email: `joseph@smartconnects.com` (already authorized)
- OR any email ending in `@smartconnects.com`

Example test emails:
- `admin@smartconnects.com`
- `support@smartconnects.com`
- `joseph@smartconnects.com`

## Technical Implementation

### Files Created
- `/app/(features)/super-admin/page.tsx` - Main dashboard component

### Files Modified
- `/components/layout/Header.tsx` - Added super admin check + menu link
- `/components/layout/AdminHeader.tsx` - Added super admin check + menu link
- `/app/(features)/prescriptions/new/step3/page.tsx` - Added system logging

### Technologies Used
- Next.js App Router for routing
- localStorage for data persistence
- React hooks (useState, useEffect, useCallback)
- ShadCN UI components (Card, Badge, Button)
- Lucide icons (Activity, CheckCircle2, XCircle, RefreshCw, Zap)
- Sonner for toast notifications

## Future Enhancements

Potential additions to Super Admin:
- Real DigitalRx API integration
- User management (create/disable accounts)
- System health metrics (response times, error rates)
- Export data to CSV
- Advanced filtering/search
- Email notifications for critical events
- Role assignment interface
- Audit trail with more detail
