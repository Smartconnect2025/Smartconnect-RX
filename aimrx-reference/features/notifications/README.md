# Notifications Feature

A comprehensive notification system for the TFA Components Foundation that supports real-time notifications with database persistence, user-specific filtering, and action buttons.

## Overview

The notifications feature provides:
- **Database-backed notifications** with PostgreSQL/Supabase
- **Real-time updates** with Supabase real-time subscriptions
- **User-specific notifications** with Row Level Security (RLS)
- **Multiple notification types** (vital, symptom, appointment, chat, order, goal, system)
- **Action buttons** on notifications (review, message, call, etc.)
- **Read/unread status** tracking
- **Critical notification** support
- **Filtering by type** (all, vital, symptoms, appointments, chat)
- **Live unread count** updates
- **Instant notification toasts** for new critical alerts

## Architecture

```
features/notifications/
├── README.md                     # This file
├── index.ts                      # Barrel exports
├── types.ts                      # TypeScript interfaces
├── services/
│   └── notificationService.ts    # Database operations
├── hooks/
│   └── useNotifications.ts       # React hooks for state management
└── components/
    ├── NotificationBell.tsx      # Bell icon with unread count
    ├── NotificationPanel.tsx     # Full notification panel
    ├── NotificationPanelContent.tsx # Panel content with close button
    ├── NotificationItem.tsx      # Individual notification component
    ├── NotificationsPanel.tsx    # Main wrapper component
    └── notificationData.ts       # Legacy store bridge
```

## Database Schema

### `notifications` table
```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('vital', 'symptom', 'appointment', 'chat', 'order', 'goal', 'system')),
  title text NOT NULL,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  critical boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  related_entity_type text,
  related_entity_id uuid,
  metadata jsonb
);
```

### `notification_actions` table
```sql
CREATE TABLE notification_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  label text NOT NULL,
  action_type text NOT NULL,
  action_data jsonb,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

## Usage

### Basic Hook Usage

```tsx
import { useNotifications } from '@/features/notifications';

function MyComponent() {
  const {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    createNewNotification,
    deleteNotificationById
  } = useNotifications();

  return (
    <div>
      <p>You have {unreadCount} unread notifications</p>
      {notifications.map(notification => (
        <div key={notification.id}>
          <h3>{notification.title}</h3>
          <p>{notification.body}</p>
          {!notification.read && (
            <button onClick={() => markAsRead(notification.id)}>
              Mark as read
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Service Layer Usage

```tsx
import { 
  createNotification, 
  getUserNotifications,
  markAllNotificationsAsRead 
} from '@/features/notifications';

// Create a new notification
const notification = await createNotification({
  user_id: 'user-uuid',
  type: 'vital',
  title: 'High Blood Pressure Alert',
  body: 'Your reading is above normal range',
  critical: true,
  actions: [
    { label: 'Review', action_type: 'review' },
    { label: 'Message Provider', action_type: 'message' }
  ]
});

// Get all user notifications
const notifications = await getUserNotifications('user-uuid');

// Mark all as read
await markAllNotificationsAsRead('user-uuid');

// Create a test notification (development only)
const testNotification = await createTestNotification('user-uuid', 'vital');
```

### Component Usage

```tsx
import { NotificationsPanel } from '@/features/notifications';

function Header() {
  return (
    <header>
      <nav>
        {/* Other nav items */}
        <NotificationsPanel />
      </nav>
    </header>
  );
}
```

## Notification Types

| Type | Description | Icon | Use Case |
|------|-------------|------|----------|
| `vital` | Vital sign alerts | Activity | Blood pressure, heart rate alerts |
| `symptom` | Symptom reports | AlertTriangle | Patient symptom submissions |
| `appointment` | Appointment related | Calendar | Reminders, cancellations, reschedules |
| `chat` | Messages/communication | MessageSquare | Provider-patient messages |
| `order` | Order updates | Package | Shipping, delivery notifications |
| `goal` | Goal progress | Target | Milestone achievements |
| `system` | System notifications | Bell | App updates, maintenance |

## Action Types

| Action Type | Description | Common Labels |
|-------------|-------------|---------------|
| `review` | Review/view details | "Review", "View Details" |
| `message` | Send a message | "Message", "Reply" |
| `call` | Initiate a call | "Call Patient", "Call Provider" |
| `reschedule` | Reschedule appointment | "Reschedule" |
| `cancel` | Cancel appointment | "Cancel" |
| `archive` | Archive notification | "Archive" |
| `track` | Track order/shipment | "Track Order" |
| `support` | Contact support | "Contact Support" |

## Real-time Features

The notification system includes real-time subscriptions that automatically update the UI when:

- **New notifications are created** - Instantly appear in the notification panel with toast alerts
- **Notifications are updated** - Read status, content, or metadata changes reflect immediately
- **Notifications are deleted** - Removed from the UI without page refresh
- **Actions are modified** - Action buttons update in real-time

### Real-time Setup

Real-time functionality is automatically enabled when using the `useNotifications` hook. The system:

1. **Subscribes to postgres_changes** for the `notifications` and `notification_actions` tables
2. **Filters by user_id** to ensure users only receive their own notifications
3. **Handles all event types** - INSERT, UPDATE, DELETE
4. **Updates local state** immediately for optimal user experience
5. **Shows toast notifications** for new critical alerts

### Database Configuration

The real-time functionality requires the tables to be added to the `supabase_realtime` publication:

```sql
-- Enable real-time for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE notification_actions;
```

This is automatically handled by the migration `enable_realtime_for_notifications`.

## API Reference

### Hooks

#### `useNotifications()`
Returns notification state and actions for the current user.

**Returns:**
- `notifications: Notification[]` - Array of user notifications
- `loading: boolean` - Loading state
- `unreadCount: number` - Count of unread notifications
- `markAsRead: (id: string) => Promise<void>` - Mark single notification as read
- `markAllAsRead: () => Promise<void>` - Mark all notifications as read
- `createNewNotification: (data) => Promise<Notification>` - Create new notification
- `updateNotificationById: (id, data) => Promise<Notification>` - Update notification
- `deleteNotificationById: (id: string) => Promise<void>` - Delete notification
- `loadNotificationsByType: (type: string) => Promise<Notification[]>` - Load filtered notifications
- `refreshNotifications: () => Promise<void>` - Refresh notification list
- `refreshUnreadCount: () => Promise<number>` - Refresh unread count

### Service Functions

#### `createNotification(data: CreateNotificationData): Promise<Notification>`
Create a new notification with optional actions.

#### `getUserNotifications(userId: string): Promise<Notification[]>`
Get all notifications for a user, ordered by creation date.

#### `getUserNotificationsByType(userId: string, type: string): Promise<Notification[]>`
Get notifications filtered by type.

#### `markNotificationAsRead(notificationId: string): Promise<void>`
Mark a single notification as read.

#### `markAllNotificationsAsRead(userId: string): Promise<void>`
Mark all user notifications as read.

#### `getUnreadNotificationCount(userId: string): Promise<number>`
Get count of unread notifications for a user.

#### `deleteNotification(notificationId: string): Promise<void>`
Delete a notification and its actions.

#### `createTestNotification(userId: string, type?: string): Promise<Notification>`
Create a test notification for development/testing purposes. Supports types: 'vital', 'symptom', 'appointment', 'chat', 'order'.

## Types

### `Notification`
```typescript
interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  critical: boolean;
  createdAt: Date;
  updatedAt: Date;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, any>;
  actions: NotificationAction[];
}
```

### `NotificationAction`
```typescript
interface NotificationAction {
  id: string;
  label: string;
  actionType: string;
  actionData?: Record<string, any>;
  displayOrder: number;
}
```

## Migration from Mock Data

The system includes a bridge layer (`notificationData.ts`) that maintains backward compatibility with existing components while providing real database integration. 

### Legacy Store Bridge
```tsx
import { useNotificationStoreSync } from '@/features/notifications';

// In components that use the legacy format:
function MyComponent() {
  useNotificationStoreSync(); // Syncs real data to legacy store
  
  // Components can continue using useNotificationStore()
  const { notifications } = useNotificationStore();
}
```

## Security

- **Row Level Security (RLS)** ensures users only see their own notifications
- **User authentication** required for all operations
- **Input validation** on notification types and action types
- **Sanitized data** in service responses

## Performance Considerations

- **Indexed queries** on user_id, read status, and creation date
- **Pagination support** ready for large notification volumes
- **Efficient filtering** by type without full table scans
- **Cascade deletes** for automatic cleanup of related actions

## Future Enhancements

- [x] **Real-time notifications** using Supabase realtime subscriptions ✅
- [ ] **Push notifications** for mobile/web
- [ ] **Email notifications** for critical alerts
- [ ] **Notification preferences** per user/type
- [ ] **Batch operations** for marking multiple notifications
- [ ] **Notification templates** for consistent formatting
- [ ] **Analytics** on notification engagement
- [ ] **Scheduled notifications** for reminders

## Testing

The feature includes sample data for testing. To create test notifications:

```typescript
// Using the test utility function
import { createTestNotification } from '@/features/notifications';

// Create different types of test notifications
await createTestNotification('user-id', 'vital');     // Critical vital alert
await createTestNotification('user-id', 'symptom');   // Symptom report
await createTestNotification('user-id', 'appointment'); // Appointment reminder
await createTestNotification('user-id', 'chat');      // Chat message
await createTestNotification('user-id', 'order');     // Order update
```

```sql
-- Or directly via SQL
INSERT INTO notifications (user_id, type, title, body, critical)
VALUES ('your-user-id', 'vital', 'Test Alert', 'This is a test notification', true);
```

### Real-time Testing

To test real-time functionality:

1. Open the app in multiple browser tabs/windows
2. Use `createTestNotification()` in one tab
3. Watch notifications appear instantly in other tabs
4. Test marking as read, deleting, etc. across tabs

## Dependencies

- `@core/supabase` - Database client
- `@core/auth` - User authentication
- `sonner` - Toast notifications
- `zustand` - State management
- `lucide-react` - Icons
- Tailwind CSS components (Button, Badge, Card, etc.)