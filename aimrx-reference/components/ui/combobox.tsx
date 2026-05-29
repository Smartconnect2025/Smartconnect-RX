"use client";
import * as React from "react";
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

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select option",
  searchPlaceholder = "Search...",
  emptyMessage = "No option found.",
  disabled = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleSelect = (currentValue: string) => {
    onValueChange(currentValue === value ? "" : currentValue);
    setOpen(false);
  };

  const selectedOption = options.find((option) => option.value === value);

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
      {selectedOption ? selectedOption.label : placeholder}
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  const ComboboxContent = (
    <Command
      filter={(value, search) => {
        const option = options.find((option) => option.value === value);
        if (!option || !search) return 1;
        const searchLower = search.toLowerCase();
        return option.label.toLowerCase().includes(searchLower) ||
          option.value.toLowerCase().includes(searchLower)
          ? 1
          : 0;
      }}
    >
      <CommandInput placeholder={searchPlaceholder} />
      <CommandList>
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        <CommandGroup className="max-h-[200px] overflow-auto">
          {options.map((option) => (
            <CommandItem
              key={option.value}
              value={option.value}
              onSelect={() => handleSelect(option.value)}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  value === option.value ? "opacity-100" : "opacity-0"
                )}
              />
              {option.label}
            </CommandItem>
          ))}
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
