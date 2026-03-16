/**
 * Admin Tags Page
 *
 * Dedicated page for managing resource tags.
 * Thin wrapper that imports and renders the TagsManagement feature component.
 */

import { TagsManagement } from "@/features/admin-dashboard";

export default function AdminTagsPage() {
  return <TagsManagement />;
}
