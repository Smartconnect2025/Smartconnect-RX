"use client";

import { Plus, X } from "lucide-react";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  BillingDiagnosis,
  BillingGroup as BillingGroupType,
  BillingProcedure,
  COMMON_CPT_CODES,
} from "../../types/billing.types";

interface BillingGroupProps {
  group: BillingGroupType;
  isFinalized: boolean;
  onProcedureCodeChange: (groupId: string, value: string) => void;
  onModifiersChange: (groupId: string, value: string) => void;
  onTogglePrimaryDx: (dxId: string, groupId: string) => void;
  onRemoveDx: (dxId: string, groupId: string) => void;
  onRemoveProcedure: (procId: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onAddDiagnosis: (groupId: string) => void;
  getProcedureDescription: (code: string) => string;
}

export const BillingGroup: React.FC<BillingGroupProps> = ({
  group,
  isFinalized,
  onProcedureCodeChange,
  onModifiersChange,
  onTogglePrimaryDx,
  onRemoveDx,
  onRemoveProcedure,
  onRemoveGroup,
  onAddDiagnosis,
}) => {
  const [localModifiers, setLocalModifiers] = useState(group.modifiers || "");

  useEffect(() => {
    setLocalModifiers(group.modifiers || "");
  }, [group.modifiers]);

  const handleModifiersChange = (value: string) => {
    setLocalModifiers(value);
  };

  const handleModifiersBlur = () => {
    if (localModifiers !== (group.modifiers || "")) {
      onModifiersChange(group.id, localModifiers);
    }
  };

  return (
    <div className="space-y-4 border border-gray-200 rounded-sm p-4">
      {/* Billing Group Header */}
      <div className="flex items-center justify-between py-4 bg-gray-100 rounded-sm px-4 border border-gray-200">
        <div className="flex-1 mr-6">
          <Select
            value={group.procedureCode}
            onValueChange={(value) => onProcedureCodeChange(group.id, value)}
            disabled={isFinalized}
          >
            <SelectTrigger className="w-full border border-gray-200 shadow-sm p-3 h-auto bg-white rounded-md hover:bg-gray-50">
              <SelectValue className="text-left">
                <div className="flex items-center space-x-3">
                  <span className="font-medium text-gray-900">
                    {group.procedureCode}
                  </span>
                  <span className="text-gray-700">
                    {group.procedureDescription}
                  </span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="w-[600px]">
              {Object.entries(COMMON_CPT_CODES).map(([code, description]) => (
                <SelectItem key={code} value={code}>
                  <div className="flex items-center space-x-3">
                    <span className="font-medium">{code}</span>
                    <span>{description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-3">
          <Input
            placeholder="Modifiers (e.g. 25, 5)"
            className="w-40 text-sm bg-white border-gray-200"
            value={localModifiers}
            onChange={(e) => handleModifiersChange(e.target.value)}
            onBlur={handleModifiersBlur}
            disabled={isFinalized}
          />
          {!isFinalized && (
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-gray-600 p-1"
              onClick={() => onRemoveGroup(group.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Diagnoses & Procedures Section */}
      <>
        {/* Diagnoses List */}
        {group.diagnoses.map((diagnosis: BillingDiagnosis) => (
          <div
            key={diagnosis.id}
            className="flex items-center justify-between py-2 bg-white rounded-sm px-4 shadow-xs border border-gray-200"
          >
            <div className="flex items-center space-x-3">
              <span className="font-medium text-gray-900">
                {diagnosis.description}
              </span>
              <span className="text-gray-600">{diagnosis.icdCode}</span>
            </div>
            <div className="flex items-center space-x-3">
              {diagnosis.isPrimary && isFinalized && (
                <span className="px-2 py-1 bg-black text-white rounded-full text-sm font-medium">
                  Primary
                </span>
              )}
              {!isFinalized && (
                <button
                  onClick={() => onTogglePrimaryDx(diagnosis.id, group.id)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    diagnosis.isPrimary
                      ? "bg-black text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {diagnosis.isPrimary ? "Primary" : "Make Primary"}
                </button>
              )}
              {!isFinalized && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-gray-600 p-1"
                  onClick={() => onRemoveDx(diagnosis.id, group.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}

        {/* Procedures List */}
        {group.procedures.map((procedure: BillingProcedure) => (
          <div
            key={procedure.id}
            className="flex items-center justify-between py-3 bg-white rounded-sm px-4 shadow-sm"
          >
            <div className="flex items-center space-x-3">
              <span className="font-medium text-gray-900">
                {procedure.description}
              </span>
              <span className="text-gray-600">{procedure.cptCode}</span>
            </div>
            <div className="flex items-center space-x-3">
              {!isFinalized && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-gray-600 p-1"
                  onClick={() => onRemoveProcedure(procedure.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}

        {/* Add Dx Button */}
        {!isFinalized && (
          <div className="pt-2">
            <Button
              variant="outline"
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
              onClick={() => onAddDiagnosis(group.id)}
            >
              <Plus className="h-4 w-4" />
              <span>Add Dx</span>
            </Button>
          </div>
        )}
      </>
    </div>
  );
};
