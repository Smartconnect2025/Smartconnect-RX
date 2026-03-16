/**
 * Utility functions for handling pagination logic after item deletion
 * Ensures consistent behavior across all admin management components
 */

export interface PaginationState {
  currentPage: number;
  totalCount: number;
  pageSize: number;
}

export interface PaginationResult {
  newPage: number;
  shouldFetch: boolean;
  isEmpty: boolean;
}

/**
 * Calculates the correct page to navigate to after deleting an item
 * Handles all edge cases including empty pages, last page deletion, etc.
 */
export function calculatePageAfterDeletion(
  state: PaginationState,
  itemsRemainingOnCurrentPage: number,
): PaginationResult {
  const { currentPage, totalCount, pageSize } = state;

  // Calculate new total count after deletion
  const newTotalCount = Math.max(0, totalCount - 1);
  const newTotalPages = Math.ceil(newTotalCount / pageSize);

  // Edge case: No items left at all
  if (newTotalCount === 0) {
    return {
      newPage: 1,
      shouldFetch: false,
      isEmpty: true,
    };
  }

  // Edge case: Current page no longer exists (deleted last item on last page)
  if (currentPage > newTotalPages) {
    return {
      newPage: Math.max(1, newTotalPages),
      shouldFetch: true,
      isEmpty: false,
    };
  }

  // Edge case: Current page is now empty (deleted last item on current page)
  if (itemsRemainingOnCurrentPage === 0 && currentPage > 1) {
    return {
      newPage: Math.max(1, currentPage - 1),
      shouldFetch: true,
      isEmpty: false,
    };
  }

  // Normal case: Current page still has items, just refresh it
  return {
    newPage: currentPage,
    shouldFetch: true,
    isEmpty: false,
  };
}

/**
 * Handles optimistic UI updates for deletion
 * Returns the updated state and a revert function
 */
export function createOptimisticDeletion<T>(
  items: T[],
  itemId: string,
  getId: (item: T) => string,
): {
  updatedItems: T[];
  revert: () => T[];
} {
  const updatedItems = items.filter((item) => getId(item) !== itemId);

  return {
    updatedItems,
    revert: () => items, // Return original items for reverting
  };
}

/**
 * Validates pagination state to prevent invalid states
 */
export function validatePaginationState(
  state: PaginationState,
): PaginationState {
  const { currentPage, totalCount, pageSize } = state;

  const maxPage = Math.max(1, Math.ceil(totalCount / pageSize));
  const validCurrentPage = Math.max(1, Math.min(currentPage, maxPage));

  return {
    currentPage: validCurrentPage,
    totalCount: Math.max(0, totalCount),
    pageSize: Math.max(1, pageSize),
  };
}
