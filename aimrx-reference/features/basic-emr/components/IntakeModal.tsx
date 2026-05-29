import React from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface IntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  intakeData: {
    chiefComplaint: string;
    historyOfPresentIllness: string;
    preVisitQuestions: Array<{
      question: string;
      answer: string;
    }>;
    recentMedicalHistory: string[];
    currentMedications: string[];
  };
}

export function IntakeModal({ isOpen, onClose, intakeData }: IntakeModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="!max-w-none !w-[75vw] max-h-[90vh] p-0 bg-white rounded-lg"
        style={{
          width: "75vw !important",
          maxWidth: "none !important",
          minWidth: "75vw !important",
        }}
      >
        <DialogHeader className="p-6 pb-4 border-b border-gray-200 bg-white rounded-t-lg">
          <DialogTitle className="text-lg font-semibold">
            Patient Intake Information
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6 max-h-[75vh]">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Chief Complaint
              </h3>
              <p className="text-gray-700 leading-relaxed">
                {intakeData.chiefComplaint}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                History of Present Illness
              </h3>
              <p className="text-gray-700 leading-relaxed">
                {intakeData.historyOfPresentIllness}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Pre-Visit Questions
              </h3>
              <div className="space-y-4">
                {intakeData.preVisitQuestions.map((item, index) => (
                  <div key={index} className="space-y-1">
                    <p className="font-medium text-gray-900">{item.question}</p>
                    <p className="text-gray-700 ml-4">{item.answer}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Recent Medical History
              </h3>
              <ul className="space-y-2">
                {intakeData.recentMedicalHistory.map((item, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-gray-400 mr-2">•</span>
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Current Medications
              </h3>
              <ul className="space-y-2">
                {intakeData.currentMedications.map((item, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-gray-400 mr-2">•</span>
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
