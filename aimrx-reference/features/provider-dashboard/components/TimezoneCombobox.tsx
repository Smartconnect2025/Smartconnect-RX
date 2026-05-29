"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/utils/tailwind-utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  DrawerTitle,
  DrawerHeader,
} from "@/components/ui/drawer";
import {
  TIMEZONES,
  formatTimezone,
  getPopularTimezones,
} from "@/core/constants/timezones";

interface TimezoneComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}

export function TimezoneCombobox({
  value,
  onValueChange,
  placeholder = "Select timezone",
  searchPlaceholder = "Search timezones...",
  emptyMessage = "No timezone found.",
  disabled = false,
  className,
}: TimezoneComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearchValue, setDebouncedSearchValue] = useState("");
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const popularTimezones = getPopularTimezones();
  const allTimezones = TIMEZONES;

  // Debounce search value for performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchValue(searchValue);
    }, 100);

    return () => clearTimeout(timer);
  }, [searchValue]);

  const handleSelect = (currentValue: string) => {
    onValueChange(currentValue === value ? "" : currentValue);
    setOpen(false);
  };

  const selectedTimezone = allTimezones.find((tz) => tz.value === value);

  // Filter timezones based on debounced search
  const getFilteredTimezones = () => {
    if (!debouncedSearchValue.trim()) {
      // Show popular timezones when not searching
      return popularTimezones;
    }

    // When searching, show all matching timezones
    const searchLower = debouncedSearchValue.toLowerCase();
    return allTimezones.filter(
      (tz) =>
        tz.label.toLowerCase().includes(searchLower) ||
        tz.value.toLowerCase().includes(searchLower) ||
        tz.offset.toLowerCase().includes(searchLower)
    );
  };

  const filteredTimezones = getFilteredTimezones();
  const isShowingPopularOnly = !debouncedSearchValue.trim();

  // Format timezone for display with truncation
  const formatTimezoneForDisplay = (timezone: {
    value: string;
    label: string;
    offset: string;
  }) => {
    const formatted = formatTimezone(timezone);
    // Truncate if too long for better display
    if (formatted.length > 50) {
      return formatted.substring(0, 47) + "...";
    }
    return formatted;
  };

  const ComboboxTrigger = (
    <Button
      variant="outline"
      role="combobox"
      disabled={disabled}
      className={cn(
        "w-full justify-between rounded-full",
        !value && "text-muted-foreground",
        className
      )}
    >
      <span className="truncate">
        {selectedTimezone
          ? formatTimezoneForDisplay(selectedTimezone)
          : placeholder}
      </span>
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  const ComboboxContent = (
    <Command shouldFilter={false}>
      <CommandInput
        placeholder={searchPlaceholder}
        value={searchValue}
        onValueChange={setSearchValue}
      />
      <CommandList>
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        <CommandGroup className="max-h-[200px] overflow-auto">
          {isShowingPopularOnly && (
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Popular Timezones
            </div>
          )}
          {filteredTimezones.map((tz) => (
            <CommandItem
              key={tz.value}
              value={tz.value}
              onSelect={() => handleSelect(tz.value)}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  value === tz.value ? "opacity-100" : "opacity-0"
                )}
              />
              {formatTimezone(tz)}
            </CommandItem>
          ))}
          {isShowingPopularOnly && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground border-t">
              Type to search all timezones...
            </div>
          )}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{ComboboxTrigger}</PopoverTrigger>
        <PopoverContent
          className="p-0 rounded-sm"
          align="start"
          sideOffset={4}
          style={{ width: "var(--radix-popover-trigger-width)" }}
        >
          {ComboboxContent}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{ComboboxTrigger}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="sr-only">
          <DrawerTitle>{placeholder}</DrawerTitle>
        </DrawerHeader>
        <div className="mt-4 border-t">{ComboboxContent}</div>
      </DrawerContent>
    </Drawer>
  );
}
