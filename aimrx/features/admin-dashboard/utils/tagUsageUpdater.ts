/**
 * Tag Usage Updater Utility
 *
 * Handles updating tag usage counts when resources are created, updated, or deleted
 */

import { createClient } from "@core/supabase";

/**
 * Updates usage count for all tags based on current resource data
 * This should be called after any resource CRUD operation
 */
export async function updateTagUsageCounts() {
  try {
    const supabase = createClient();

    // Get all tags
    const { data: tags, error: tagsError } = await supabase
      .from("tags")
      .select("id, name");

    if (tagsError) {
      console.error("Error fetching tags:", tagsError);
      return;
    }

    if (!tags || tags.length === 0) {
      return;
    }

    // Get all resources with their tags
    const { data: resources, error: resourcesError } = await supabase
      .from("resources")
      .select("tags");

    if (resourcesError) {
      console.error("Error fetching resources:", resourcesError);
      return;
    }

    // Calculate usage count for each tag
    const tagUsageCounts: Record<string, number> = {};

    tags.forEach((tag) => {
      tagUsageCounts[tag.id] = 0;
    });

    resources?.forEach((resource) => {
      if (resource.tags && Array.isArray(resource.tags)) {
        resource.tags.forEach((tagName) => {
          const tag = tags.find((t) => t.name === tagName);
          if (tag) {
            tagUsageCounts[tag.id]++;
          }
        });
      }
    });

    // Update usage counts in database
    const updatePromises = Object.entries(tagUsageCounts).map(
      ([tagId, count]) =>
        supabase.from("tags").update({ usage_count: count }).eq("id", tagId),
    );

    await Promise.all(updatePromises);
  } catch (error) {
    console.error("Error updating tag usage counts:", error);
  }
}

/**
 * Updates usage count for a specific tag
 */
export async function updateTagUsageCount(tagName: string) {
  try {
    const supabase = createClient();

    // Count resources using this tag
    const { count, error } = await supabase
      .from("resources")
      .select("*", { count: "exact", head: true })
      .contains("tags", [tagName]);

    if (error) {
      console.error("Error counting tag usage:", error);
      return;
    }

    // Update the tag's usage count
    await supabase
      .from("tags")
      .update({ usage_count: count || 0 })
      .eq("name", tagName);
  } catch (error) {
    console.error("Error updating tag usage count:", error);
  }
}
