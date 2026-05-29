import { NotificationTester } from "@/features/notifications";

export const dynamic = "force-dynamic";

export default function NotificationTestPage() {
  return (
    <div className="container mx-auto px-4 py-16 space-y-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">
            Notification System Tester
          </h1>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <h2 className="font-semibold text-blue-900">
              How to Test Real-time Notifications:
            </h2>
            <ol className="list-decimal list-inside space-y-1 text-blue-800 text-sm">
              <li>{"Make sure you're logged in"}</li>
              <li>Open this page in multiple browser tabs or windows</li>
              <li>
                Click the notification type buttons below to create test
                notifications
              </li>
              <li>Watch notifications appear instantly in all tabs</li>
              <li>Test marking as read, deleting, and other actions</li>
              <li>
                Check the notification bell in the header for unread count
                updates
              </li>
            </ol>
          </div>
        </div>

        <NotificationTester />

        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Testing Notes:</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm">
            <li>
              <strong>Real-time:</strong> Changes should appear instantly across
              all open tabs
            </li>
            <li>
              <strong>Critical notifications:</strong> Vital alerts will show
              toast notifications
            </li>
            <li>
              <strong>Unread count:</strong> Check the notification bell in the
              header
            </li>
            <li>
              <strong>Persistence:</strong> Refresh the page - notifications
              should persist
            </li>
            <li>
              <strong>Multi-user:</strong> Log in with different accounts to
              test user isolation
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
