"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/utils/tailwind-utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  // Initialize with the selected date, defaultMonth, or today (in that order of priority)
  const [currentMonth, setCurrentMonth] = React.useState<Date>(() => {
    // For single mode, check if there's a selected date
    if (props.mode === "single" && props.selected instanceof Date) {
      return props.selected;
    }

    // For multiple mode, use the first selected date if available
    if (
      props.mode === "multiple" &&
      Array.isArray(props.selected) &&
      props.selected.length > 0 &&
      props.selected[0] instanceof Date
    ) {
      return props.selected[0];
    }

    // For range mode, use the from date if available
    if (
      props.mode === "range" &&
      props.selected &&
      typeof props.selected === "object" &&
      "from" in props.selected &&
      props.selected.from instanceof Date
    ) {
      return props.selected.from;
    }

    // Fall back to defaultMonth or today
    return props.defaultMonth || new Date();
  });

  // Generate years (from 1900 to current year)
  const years = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: currentYear - 1899 }, (_, i) => 1900 + i);
  }, []);

  // Month names
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const handleMonthChange = (month: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(month);
    setCurrentMonth(newDate);
    props.onMonthChange?.(newDate);
  };

  const handleYearChange = (year: number) => {
    const newDate = new Date(currentMonth);
    newDate.setFullYear(year);
    setCurrentMonth(newDate);
    props.onMonthChange?.(newDate);
  };

  const handlePrevMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentMonth(newDate);
    props.onMonthChange?.(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentMonth(newDate);
    props.onMonthChange?.(newDate);
  };

  return (
    <div className="space-y-4 border-none">
      {/* Custom header with selects and navigation */}
      <div className="flex justify-center items-center px-1 pt-4">
        <button
          onClick={handlePrevMonth}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-9 w-9 bg-transparent p-0 opacity-50 hover:opacity-100 rounded-full border border-gray-300 hover:bg-primary/20 hover:border-none",
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex flex-col space-y-2 px-4">
          <select
            value={currentMonth.getFullYear()}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            className="py-1.5 bg-background rounded-md border border-input shadow-sm text-sm w-[120px] text-center font-semibold"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <select
            value={currentMonth.getMonth()}
            onChange={(e) => handleMonthChange(Number(e.target.value))}
            className="py-1.5 bg-background rounded-md border border-input shadow-sm text-sm w-[120px] text-center font-semibold"
          >
            {months.map((month, idx) => (
              <option key={month} value={idx}>
                {month}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleNextMonth}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-9 w-9 bg-transparent p-0 opacity-50 hover:opacity-100 rounded-full border border-gray-300 hover:bg-primary/20 hover:border-none",
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Calendar */}
      <DayPicker
        showOutsideDays={showOutsideDays}
        className={cn("p-4 border-t border-gray-200 rounded-b-md", className)}
        month={currentMonth}
        onMonthChange={setCurrentMonth}
        classNames={{
          root: "bg-white",
          caption: "hidden",
          caption_label: "hidden",
          table: "w-full border-collapse space-y-1",
          head_row: "flex justify-center",
          row: "flex w-full mt-2",
          cell: "relative p-4 text-center text-sm focus-within:relative focus-within:z-20 cursor-pointer",
          day: "rounded-full",
          day_button:
            "h-8 w-8 p-0 font-normal text-sm text-center rounded-full mx-auto hover:bg-primary/20 cursor-pointer transition-colors",
          disabled: "text-muted-foreground opacity-50 !cursor-not-allowed",
          ...classNames,
        }}
        styles={{
          ...props.styles,
        }}
        modifiersStyles={{
          selected: {
            backgroundColor: "hsl(var(--primary))",
            borderStyle: "none",
            color: "hsl(var(--primary-foreground))",
          },
          today: {
            fontWeight: "bold",
          },
        }}
        hideNavigation={true}
        {...props}
      />
    </div>
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
