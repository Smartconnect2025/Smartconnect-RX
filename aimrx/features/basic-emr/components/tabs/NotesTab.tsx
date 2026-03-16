"use client";

import { Textarea } from "@/components/ui/textarea";

import AddendumSection from "../AddendumSection";
import NoteHeader from "../NoteHeader";
import { Addendum } from "../../types";

interface NotesTabProps {
  providerNotes: string;
  onProviderNotesChange: (notes: string) => void;
  isFinalized: boolean;
  finalizedDate: Date | null;
  onAddAddendum: () => void;
  isAddingAddendum: boolean;
  addendums: Addendum[];
  onSaveAddendum: (content: string) => void;
  onCancelAddendum: () => void;
  children?: React.ReactNode; // For side panels (Intake, Vitals)
}

export function NotesTab({
  providerNotes,
  onProviderNotesChange,
  isFinalized,
  finalizedDate,
  onAddAddendum,
  isAddingAddendum,
  addendums,
  onSaveAddendum,
  onCancelAddendum,
  children,
}: NotesTabProps) {
  return (
    <div className="flex h-full space-x-6">
      <div className="flex-1">
        <NoteHeader
          isFinalized={isFinalized}
          finalizedDate={finalizedDate}
          handleAddAddendum={onAddAddendum}
          isAddingAddendum={isAddingAddendum}
        />

        {/* Addendum Section */}
        {isFinalized && (
          <AddendumSection
            addendums={addendums}
            isAddingAddendum={isAddingAddendum}
            onSaveAddendum={onSaveAddendum}
            onCancelAddendum={onCancelAddendum}
          />
        )}

        <Textarea
          value={providerNotes}
          onChange={(e) => onProviderNotesChange(e.target.value)}
          disabled={isFinalized}
          className="w-full h-96 font-mono text-sm border-gray-300 resize-none"
          placeholder="Enter clinical notes..."
        />
      </div>

      {children && <aside className="w-80 space-y-6">{children}</aside>}
    </div>
  );
}
