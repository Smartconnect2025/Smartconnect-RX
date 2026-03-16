import { format } from "date-fns";
import { Lock } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";

interface NoteHeaderProps {
  isFinalized: boolean;
  finalizedDate: Date | null;
  handleAddAddendum?: () => void;
  isAddingAddendum?: boolean;
}

const NoteHeader: React.FC<NoteHeaderProps> = ({
  isFinalized,
  finalizedDate,
  handleAddAddendum,
  isAddingAddendum = false,
}) => {
  return (
    <>
      {isFinalized && (
        <div className="border-t border-gray-200 pt-4 mt-0">
          <div className="rounded-md p-1.5 mb-4 flex items-center gap-2 text-xs text-muted-foreground bg-slate-100">
            <Lock className="h-3 w-3" />
            <span>
              Note finalized on{" "}
              {finalizedDate
                ? format(finalizedDate, "MMMM d, yyyy 'at' h:mm a")
                : "Unknown"}
            </span>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4 border-t border-b border-gray-200 py-4">
        <div>
          <p className="font-semibold">Provider Note</p>
          <p className="text-xs text-muted-foreground">Dr. Jack Dimar</p>
        </div>
        {isFinalized && (
          <Button
            onClick={handleAddAddendum}
            variant="default"
            disabled={isAddingAddendum}
          >
            Add Addendum
          </Button>
        )}
      </div>
    </>
  );
};

export default NoteHeader;
