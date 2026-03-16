"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/utils/tailwind-utils";
import { UseFormReturn } from "react-hook-form";
import { commonMedications, frequencyOptions, statusOptions } from "../schemas";

interface CurrentMedicationFieldProps {
  form: UseFormReturn<Record<string, unknown>>;
  index: number;
  onRemove: () => void;
  fieldPrefix?: string; // e.g., "medications" or "medicalHistory.medications"
}

export function CurrentMedicationField({
  form,
  index,
  onRemove,
  fieldPrefix = "medications",
}: CurrentMedicationFieldProps) {
  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Medication {index + 1}</h4>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-red-500 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4">
        <FormField
          control={form.control}
          name={`${fieldPrefix}.${index}.name`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Medication Name</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select medication" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {commonMedications.map((medication) => (
                    <SelectItem key={medication} value={medication}>
                      {medication}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name={`${fieldPrefix}.${index}.dosage`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dosage</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 10mg, 1 tablet" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`${fieldPrefix}.${index}.frequency`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>How often do you take it?</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {frequencyOptions.map((frequency) => (
                      <SelectItem key={frequency} value={frequency}>
                        {frequency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name={`${fieldPrefix}.${index}.startDate`}
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>When did you start taking this?</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground",
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date > new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`${fieldPrefix}.${index}.currentStatus`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Status</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );
}
