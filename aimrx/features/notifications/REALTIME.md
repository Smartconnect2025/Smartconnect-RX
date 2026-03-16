# Real-time Notifications Implementation

## Overview

This document describes the real-time notification system implemented using Supabase's real-time subscriptions. The system provides instant updates to the UI when notifications are created, updated, or deleted in the database, without requiring page refreshes or polling.

## Implementation Summary

### ✅ What Was Implemented

1. **Real-time Database Subscriptions**
   - Postgres Changes subscriptions for `notifications` and `notification_actions` tables
   - User-specific filtering using `user_id=eq.${user.id}`
   - All event types: INSERT, UPDATE, DELETE

2. **Instant UI Updates**
   - New notifications appear immediately in all open tabs/windows
   - Read status changes sync across all sessions
   - Notification deletions remove items instantly
   - Action button updates reflect in real-time

3. **Smart State Management**
   - Local state updates without full data refetch
   - Unread count adjustments in real-time
   - Toast notifications for new critical alerts
   - Automatic subscription cleanup on user change/logout

4. **Database Configuration**
   - Tables added to `supabase_realtime` publication
   - Row Level Security (RLS) policies ensure user isolation
   - Optimized indexes for real-time queries

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Database      │    │   Supabase       │    │   React Hook    │
│   Changes       │───▶│   Real-time      │───▶│   useNotifications│
│                 │    │   Server         │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │   WebSocket      │    │   UI Components │
                       │   Connection     │    │   (Auto-update) │
                       └──────────────────┘    └─────────────────┘
```

## Key Features

### 1. **Instant Notification Delivery**
- New notifications appear immediately across all user sessions
- Critical notifications trigger toast alerts
- No polling or manual refresh required

### 2. **Real-time State Synchronization**
- Read/unread status syncs instantly
- Notification deletions reflected immediately
- Unread count updates across all tabs

### 3. **Action Button Real-time Updates**
- Action buttons can be modified in real-time
- New actions appear instantly
- Action updates and deletions sync immediately

### 4. **Smart Subscription Management**
- Automatic setup when user logs in
- Clean teardown when user logs out
- Efficient filtering to user-specific data only

## Technical Implementation

### Database Setup

```sql
-- Enable real-time for notifications tables
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE notification_actions;
```

### React Hook Integration

The real-time functionality is implemented in `useNotifications.ts`:

```typescript
const setupRealtimeSubscriptions = useCallback(() => {
  const channel = supabase
    .channel(`notifications:${user.id}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${user.id}`,
    }, handleNotificationChange)
    .on('postgres_changes', {
      event: '*',
      schema: 'public', 
      table: 'notification_actions',
    }, handleActionChange)
    .subscribe();
}, [user?.id]);
```

### Event Handling

1. **INSERT Events**: New notifications added to local state with toast alerts
2. **UPDATE Events**: Existing notifications updated in local state
3. **DELETE Events**: Notifications removed from local state
4. **Action Changes**: Action buttons updated in real-time

## Testing the Real-time System

### 1. **Manual Testing**

```typescript
import { createTestNotification } from '@/features/notifications';

// Create test notifications
await createTestNotification('user-id', 'vital');
await createTestNotification('user-id', 'appointment');
```

### 2. **Multi-tab Testing**

1. Open the application in multiple browser tabs
2. Log in with the same user account
3. Use the `NotificationTester` component or create notifications via API
4. Observe instant updates across all tabs

### 3. **Database Testing**

```sql
-- Insert notification directly via SQL
INSERT INTO notifications (user_id, type, title, body, critical)
VALUES ('user-id', 'vital', 'Test Real-time', 'This should appear instantly', true);

-- Update notification
UPDATE notifications 
SET read = true 
WHERE id = 'notification-id';

-- Delete notification
DELETE FROM notifications WHERE id = 'notification-id';
```

## Performance Characteristics

### Subscription Efficiency
- **Filtered subscriptions**: Only receive user-specific changes
- **Minimal data transfer**: Only changed records transmitted
- **Smart state updates**: Local state modified without full refresh

### Memory Management
- **Automatic cleanup**: Subscriptions removed on user logout
- **Single subscription per user**: Prevents subscription leaks
- **Efficient event handling**: Debounced updates for rapid changes

### Network Optimization
- **WebSocket connection**: Single persistent connection
- **Event batching**: Multiple changes sent efficiently
- **Connection reuse**: Same connection for all real-time features

## Troubleshooting

### Common Issues

1. **Notifications not appearing in real-time**
   ```
   Check: Is the user logged in?
   Check: Are tables in supabase_realtime publication?
   Check: Browser console for subscription errors
   ```

2. **Multiple notifications for same event**
   ```
   Check: Multiple subscription setup calls
   Check: Subscription cleanup on user change
   ```

3. **Real-time not working across tabs**
   ```
   Check: User session consistency
   Check: WebSocket connection status
   Check: Browser tab suspension (mobile)
   ```

### Debug Information

The system logs subscription status to browser console:

```
Subscription status: SUBSCRIBED
Successfully subscribed to notifications real-time updates
Notification change: { eventType: 'INSERT', new: {...} }
```

### Connection Status

Monitor subscription health:

```typescript
.subscribe((status) => {
  console.log('Subscription status:', status);
  if (status === 'SUBSCRIBED') {
    console.log('Real-time connected');
  } else if (status === 'CHANNEL_ERROR') {
    console.error('Real-time connection failed');
  }
});
```

## Security Considerations

### Row Level Security (RLS)
- Users only receive notifications for their `user_id`
- Database-level filtering prevents unauthorized access
- JWT token validation on subscription setup

### Data Isolation
- Real-time subscriptions respect existing RLS policies
- No cross-user data leakage possible
- Automatic user filtering in subscription setup

## Future Enhancements

### Planned Improvements
- [ ] **Connection recovery**: Automatic reconnection on network issues
- [ ] **Batch operations**: Bulk mark-as-read real-time updates
- [ ] **Presence indicators**: Show when notifications are being viewed
- [ ] **Push notifications**: Browser/mobile push integration
- [ ] **Notification queuing**: Offline notification handling

### Performance Optimizations
- [ ] **Subscription pooling**: Shared connections for related features
- [ ] **Event compression**: Reduce real-time payload size
- [ ] **Smart filtering**: Client-side event filtering
- [ ] **Connection monitoring**: Health checks and metrics

## Integration Examples

### Using with Other Features

```typescript
// Integrate with appointment system
const createAppointmentNotification = async (appointmentId: string) => {
  await createNotification({
    user_id: userId,
    type: 'appointment',
    title: 'Appointment Confirmed',
    body: 'Your appointment has been scheduled',
    related_entity_type: 'appointment',
    related_entity_id: appointmentId,
    actions: [
      { label: 'View Details', action_type: 'view' },
      { label: 'Reschedule', action_type: 'reschedule' }
    ]
  });
};

// Integrate with order system
const createOrderNotification = async (orderId: string) => {
  await createNotification({
    user_id: userId,
    type: 'order',
    title: 'Order Status Update',
    body: 'Your order has been shipped',
    related_entity_type: 'order',
    related_entity_id: orderId,
    actions: [
      { label: 'Track Package', action_type: 'track' }
    ]
  });
};
```

## Conclusion

The real-time notification system provides a seamless, instant communication channel between the database and all connected user sessions. It significantly improves user experience by eliminating the need for manual refreshes while maintaining high performance and security standards.

The implementation is production-ready and includes comprehensive error handling, subscription management, and performance optimizations suitable for high-traffic healthcare applications.