/**
 * Authentication Provider Component
 * 
 * Server component that provides authentication context to the application.
 */
import { getUser } from "./get-user";
import { UserClient } from "./UserClient";

/**
 * Authentication Provider component
 * 
 * This is a server component that fetches the user's authentication state
 * and passes it to the client-side UserClient component.
 * 
 * @param props - Component props
 * @param props.children - Child components to wrap with authentication context
 * @returns A component tree with authentication context
 */
export async function UserProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, userRole, isDemo } = await getUser();

  return (
    <UserClient user={user} userRole={userRole} isDemo={isDemo}>
      {children}
    </UserClient>
  );
}
