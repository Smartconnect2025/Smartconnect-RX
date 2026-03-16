import { format } from "date-fns";
import { Clock } from "lucide-react";
import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Addendum } from "../types";

interface AddendumSectionProps {
  addendums: Addendum[];
  isAddingAddendum: boolean;
  onSaveAddendum: (content: string) => void;
  onCancelAddendum: () => void;
}
const AddendumSection: React.FC<AddendumSectionProps> = ({
  addendums,
  isAddingAddendum,
  onSaveAddendum,
  onCancelAddendum,
}) => {
  const [newAddendumContent, setNewAddendumContent] = useState("");
  const handleSaveAddendum = () => {
    if (newAddendumContent.trim()) {
      onSaveAddendum(newAddendumContent);
      setNewAddendumContent("");
    }
  };
  return (
    <div className="space-y-4 pb-4">
      {isAddingAddendum && (
        <div className="border-b border-gray-200 pb-4">
          <p className="text-sm font-medium mb-2">Addendum</p>
          <Textarea
            className="min-h-[150px] font-mono mb-3 w-full"
            value={newAddendumContent}
            onChange={(e) => setNewAddendumContent(e.target.value)}
            placeholder="Enter addendum text here..."
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancelAddendum}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAddendum}
              disabled={!newAddendumContent.trim()}
            >
              Save Addendum
            </Button>
          </div>
        </div>
      )}

      {addendums.map((addendum) => (
        <div
          key={addendum.id}
          className="rounded-md p-4 mb-4 border border-gray-200 bg-slate-50"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Clock className="h-3 w-3" />
            <span>
              Addendum added on{" "}
              {format(addendum.createdAt, "MMMM d, yyyy 'at' h:mm a")}
            </span>
          </div>
          <div className="whitespace-pre-wrap font-mono text-sm">
            {addendum.content}
          </div>
        </div>
      ))}
    </div>
  );
};
export default AddendumSection;
