"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Edit } from "lucide-react";

interface DetailViewProps {
  title: string;
  description: string;
  sections: {
    title: string;
    fields: {
      label: string;
      value: string | number | React.ReactNode;
      editable?: boolean;
      onEdit?: () => void;
    }[];
  }[];
  status?: {
    label: string;
    color?: string;
  };
  onClose?: () => void;
}

export function DetailView({
  title,
  description,
  sections,
  status,
}: DetailViewProps) {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2">
        <div className="space-y-1">
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex items-center">
          {status && (
            <Badge
              variant="outline"
              style={
                status.color
                  ? {
                      backgroundColor: `${status.color}10`,
                      color: status.color,
                      borderColor: status.color,
                    }
                  : undefined
              }
            >
              {status.label}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-12rem)] pr-4">
          <div className="space-y-6">
            {sections.map((section, index) => (
              <div key={index} className="space-y-4">
                <h3 className="font-semibold text-lg">{section.title}</h3>
                <div className="space-y-2">
                  {section.fields.map((field, fieldIndex) => (
                    <div
                      key={fieldIndex}
                      className="flex items-center justify-between py-2"
                    >
                      <div className="space-y-0.5">
                        <label className="text-sm text-muted-foreground">
                          {field.label}
                        </label>
                        <div className="font-medium">
                          {field.value || (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </div>
                      </div>
                      {field.editable && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={field.onEdit}
                          className="h-8 w-8 border border-border"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {index < sections.length - 1 && <Separator className="my-4" />}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
