import { Edit, Plus } from "lucide-react";
import { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface MedicalDataItem {
  id: string;
  name: string;
  details: string;
}

interface MedicalDataAccordionSectionProps {
  value: string;
  title: string;
  icon: ReactNode;
  items: MedicalDataItem[];
  emptyMessage: string;
  onAdd: () => void;
  onEdit: (item: MedicalDataItem) => void;
}

export function MedicalDataAccordionSection({
  value,
  title,
  icon,
  items,
  emptyMessage,
  onAdd,
  onEdit,
}: MedicalDataAccordionSectionProps) {
  return (
    <AccordionItem value={value} className="border-b border-gray-200">
      <div className="flex items-center justify-between w-full pr-4">
        <AccordionTrigger className="px-6 py-4 hover:no-underline text-muted-foreground">
          <div className="flex items-center gap-2">
            {icon}
            <p>{title}</p>
          </div>
        </AccordionTrigger>
        <Plus
          className="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
        />
      </div>
      <AccordionContent className="px-6 pb-4">
        <ul className="space-y-3">
          {items.length === 0 ? (
            <p className="text-gray-500 text-sm">{emptyMessage}</p>
          ) : (
            items.slice(0, 3).map((item) => (
              <li
                key={item.id}
                className="bg-muted hover:bg-muted/50 p-2 rounded group relative"
              >
                <div className="font-medium text-gray-900">{item.name}</div>
                <div className="text-gray-600">{item.details}</div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 absolute top-2 right-2 opacity-0 hover:bg-gray-200 group-hover:opacity-100 transition-opacity text-muted-foreground"
                  onClick={() => onEdit(item)}
                >
                  <Edit className="h-3 w-3" />
                </Button>
              </li>
            ))
          )}
        </ul>
      </AccordionContent>
    </AccordionItem>
  );
}
