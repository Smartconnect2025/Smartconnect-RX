"use client";

import { useState, useEffect, useCallback } from "react";

interface LabDataTabProps {
  patientId: string;
}

interface SectionHeaderProps {
  title: string;
  description?: string;
}

interface LabResult {
  id: string;
  testName: string;
  value: number;
  unit: string;
  normalRangeMin?: number;
  normalRangeMax?: number;
  date: string;
  status: "normal" | "abnormal" | "critical";
}

interface LabCategory {
  category: string;
  tests: LabResult[];
}

interface LabDataResponse {
  categories: LabCategory[];
  message?: string;
}

const SectionHeader = ({ title, description }: SectionHeaderProps) => (
  <div className="mb-6">
    <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
    {description && <p className="text-sm text-gray-600">{description}</p>}
  </div>
);

interface LabResultCardProps {
  result: LabResult;
}

const LabResultCard = ({ result }: LabResultCardProps) => {
  const getStatusColor = (status: LabResult["status"]) => {
    switch (status) {
      case "normal":
        return "bg-green-50 border-green-200 text-green-800";
      case "abnormal":
        return "bg-yellow-50 border-yellow-200 text-yellow-800";
      case "critical":
        return "bg-red-50 border-red-200 text-red-800";
      default:
        return "bg-gray-50 border-gray-200 text-gray-800";
    }
  };

  const getStatusIcon = (status: LabResult["status"]) => {
    switch (status) {
      case "normal":
        return "✓";
      case "abnormal":
        return "⚠";
      case "critical":
        return "⚠";
      default:
        return "•";
    }
  };

  const isInRange =
    result.normalRangeMin !== undefined && result.normalRangeMax !== undefined
      ? result.value >= result.normalRangeMin &&
        result.value <= result.normalRangeMax
      : true;

  const getProgressPercentage = () => {
    if (
      result.normalRangeMin === undefined ||
      result.normalRangeMax === undefined
    )
      return 50;
    const range = result.normalRangeMax - result.normalRangeMin;
    const position = result.value - result.normalRangeMin;
    return Math.min(100, Math.max(0, (position / range) * 100));
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-gray-900">{result.testName}</h4>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(result.status)}`}
        >
          {getStatusIcon(result.status)} {result.status.toUpperCase()}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-gray-900">
            {result.value}{" "}
            <span className="text-sm font-normal text-gray-500">
              {result.unit}
            </span>
          </span>
          <span className="text-sm text-gray-500">{result.date}</span>
        </div>

        {result.normalRangeMin !== undefined &&
          result.normalRangeMax !== undefined && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Reference Range</span>
                <span>
                  {result.normalRangeMin} - {result.normalRangeMax}{" "}
                  {result.unit}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${isInRange ? "bg-green-500" : "bg-red-500"}`}
                  style={{
                    width: `${getProgressPercentage()}%`,
                  }}
                />
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

interface LabCategoryProps {
  category: LabCategory;
}

const LabCategorySection = ({ category }: LabCategoryProps) => (
  <div className="mb-8">
    <SectionHeader title={category.category} />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {category.tests.map((test) => (
        <LabResultCard key={test.id} result={test} />
      ))}
    </div>
  </div>
);

const LoadingState = () => (
  <div className="flex items-center justify-center py-12">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-gray-600">Loading lab results...</p>
    </div>
  </div>
);

const ErrorState = ({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) => (
  <div className="flex items-center justify-center py-12">
    <div className="text-center">
      <p className="text-red-600 mb-2">Error loading lab results</p>
      <p className="text-gray-600 text-sm mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg"
      >
        Retry
      </button>
    </div>
  </div>
);

const NoDataState = ({ message }: { message?: string }) => (
  <div className="flex items-center justify-center py-12">
    <div className="text-center max-w-md">
      <p className="text-gray-600 mb-2">No lab results available</p>
      <p className="text-sm text-gray-500">
        {message ||
          "Lab results will appear here once tests are completed and integrated"}
      </p>
    </div>
  </div>
);

export function LabDataTab({ patientId }: LabDataTabProps) {
  const [labData, setLabData] = useState<LabDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLabData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/labs/junction/results?patientId=${patientId}`,
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch lab data");
      }

      setLabData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchLabData();
  }, [fetchLabData]);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={fetchLabData} />;
  }

  if (!labData || labData.categories.length === 0) {
    return <NoDataState message={labData?.message} />;
  }

  const handleDownloadReport = () => {
    // Create a simple text report of all lab results
    const reportContent = [
      "LABORATORY RESULTS REPORT",
      "=" .repeat(50),
      "",
      `Generated: ${new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })}`,
      `Total Tests: ${labData.categories.reduce((total, cat) => total + cat.tests.length, 0)}`,
      "",
    ];

    labData.categories.forEach((category) => {
      reportContent.push("");
      reportContent.push(category.category.toUpperCase());
      reportContent.push("-".repeat(50));

      category.tests.forEach((test) => {
        reportContent.push("");
        reportContent.push(`Test: ${test.testName}`);
        reportContent.push(`Value: ${test.value} ${test.unit}`);
        reportContent.push(`Status: ${test.status.toUpperCase()}`);
        if (test.normalRangeMin !== undefined && test.normalRangeMax !== undefined) {
          reportContent.push(`Reference Range: ${test.normalRangeMin} - ${test.normalRangeMax} ${test.unit}`);
        }
        reportContent.push(`Date: ${test.date}`);
      });
    });

    const blob = new Blob([reportContent.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lab-results-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header with summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Laboratory Results
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {labData.categories.reduce(
                (total, cat) => total + cat.tests.length,
                0,
              )}{" "}
              tests
            </span>
            <button
              onClick={handleDownloadReport}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Report
            </button>
          </div>
        </div>

        {labData.message && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">{labData.message}</p>
          </div>
        )}

        {/* Quick status summary */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {["normal", "abnormal", "critical"].map((status) => {
            const count = labData.categories.reduce(
              (total, cat) =>
                total +
                cat.tests.filter((test) => test.status === status).length,
              0,
            );
            const color =
              status === "normal"
                ? "text-green-600"
                : status === "abnormal"
                  ? "text-yellow-600"
                  : "text-red-600";
            return (
              <div key={status} className="text-center">
                <div className={`text-xl sm:text-2xl font-bold ${color}`}>
                  {count}
                </div>
                <div className="text-xs sm:text-sm text-gray-500 capitalize">
                  {status}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lab result categories */}
      {labData.categories.map((category, index) => (
        <LabCategorySection key={index} category={category} />
      ))}
    </div>
  );
}
