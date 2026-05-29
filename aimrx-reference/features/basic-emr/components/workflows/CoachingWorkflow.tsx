"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkflowLayoutProps } from "../../types/workflow.types";
import { getWorkflowConfig } from "../../config/workflow-configs";

export function CoachingWorkflow({
  encounter,
  isFinalized,
  loading,
}: WorkflowLayoutProps) {
  const workflowConfig = getWorkflowConfig("coaching");

  // Get the first tab as default
  const defaultTab = workflowConfig.tabs[0]?.id || "session";

  return (
    <Tabs defaultValue={defaultTab} className="w-full h-full">
      <TabsList className="w-full rounded-none mt-6 mb-0 justify-start">
        {workflowConfig.tabs
          .filter((tab) => tab.visible)
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="data-[state=active]:bg-white bg-gray-100"
            >
              {tab.label}
            </TabsTrigger>
          ))}
      </TabsList>

      {workflowConfig.tabs
        .filter((tab) => tab.visible)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((tab) => {
          const TabComponent = tab.component;
          const isFirstTab = tab.id === defaultTab;

          return (
            <TabsContent
              key={tab.id}
              value={tab.id}
              className={isFirstTab ? "flex-1 p-8 pt-6" : "p-8"}
            >
              <TabComponent
                encounter={encounter}
                isFinalized={isFinalized}
                loading={loading}
              />
            </TabsContent>
          );
        })}
    </Tabs>
  );
}
