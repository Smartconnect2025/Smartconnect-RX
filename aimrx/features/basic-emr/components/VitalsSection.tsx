import React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface VitalsSectionProps {
  vitalsEdit: {
    bp: string;
    hr: string;
    temp: string;
    resp: string;
    spo2: string;
    weight: string;
    height: string;
    bmi: string;
  };
  onVitalsChange: (field: string, value: string) => void;
  isFinalized: boolean;
}

export function VitalsSection({
  vitalsEdit,
  onVitalsChange,
  isFinalized,
}: VitalsSectionProps) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-sm p-4">
      <h4 className="font-medium text-gray-900 mb-4">Vitals</h4>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-gray-700">BP:</Label>
          <div className="flex items-center space-x-2">
            <Input
              value={vitalsEdit.bp}
              onChange={(e) => onVitalsChange("bp", e.target.value)}
              disabled={isFinalized}
              placeholder="120/80"
              className="w-20 h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm text-gray-700">HR:</Label>
          <div className="flex items-center space-x-2">
            <Input
              type="number"
              value={vitalsEdit.hr}
              onChange={(e) => onVitalsChange("hr", e.target.value)}
              disabled={isFinalized}
              placeholder="72"
              className="w-20 h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm text-gray-700">Temp:</Label>
          <div className="flex items-center space-x-2">
            <Input
              type="number"
              step="0.1"
              value={vitalsEdit.temp}
              onChange={(e) => onVitalsChange("temp", e.target.value)}
              disabled={isFinalized}
              placeholder="98.6"
              className="w-20 h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm text-gray-700">Resp:</Label>
          <div className="flex items-center space-x-2">
            <Input
              type="number"
              value={vitalsEdit.resp}
              onChange={(e) => onVitalsChange("resp", e.target.value)}
              disabled={isFinalized}
              placeholder="16"
              className="w-20 h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm text-gray-700">SpO2:</Label>
          <div className="flex items-center space-x-2">
            <Input
              type="number"
              value={vitalsEdit.spo2}
              onChange={(e) => onVitalsChange("spo2", e.target.value)}
              disabled={isFinalized}
              placeholder="98"
              className="w-20 h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm text-gray-700">Weight:</Label>
          <div className="flex items-center space-x-2">
            <Input
              type="number"
              step="0.1"
              value={vitalsEdit.weight}
              onChange={(e) => onVitalsChange("weight", e.target.value)}
              disabled={isFinalized}
              placeholder="180"
              className="w-20 h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm text-gray-700">Height:</Label>
          <div className="flex items-center space-x-2">
            <Input
              value={vitalsEdit.height}
              onChange={(e) => onVitalsChange("height", e.target.value)}
              disabled={isFinalized}
              placeholder="5'10 or 70"
              className="w-20 h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm text-gray-700">BMI:</Label>
          <div className="flex items-center space-x-2">
            <Input
              value={vitalsEdit.bmi}
              disabled={true}
              placeholder="25.1"
              className="w-20 h-8 text-sm bg-gray-100 cursor-not-allowed"
              title="BMI is automatically calculated from weight and height"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
