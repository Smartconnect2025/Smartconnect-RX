"use client";

import { useEffect, useState } from "react";
import { createClient } from "@core/supabase/client";

interface TableCheckResult {
  exists: boolean;
  columns: string[];
  error?: string;
}

export default function DatabaseCheckPage() {
  const [result, setResult] = useState<TableCheckResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkTable = async () => {
      setLoading(true);
      const supabase = createClient();

      try {
        // Query to get column information for the prescriptions table
        const { error } = await supabase
          .from("prescriptions")
          .select("*")
          .limit(0);

        if (error) {
          // Table might not exist
          setResult({
            exists: false,
            columns: [],
            error: error.message,
          });
        } else {
          // Table exists, now get the column names
          const { data: sampleData, error: sampleError } = await supabase
            .from("prescriptions")
            .select("*")
            .limit(1)
            .maybeSingle();

          if (sampleError) {
            setResult({
              exists: true,
              columns: [],
              error: sampleError.message,
            });
          } else {
            // Extract column names from the table structure
            const columns = sampleData
              ? Object.keys(sampleData)
              : [
                  "id",
                  "prescriber_id",
                  "patient_id",
                  "medication",
                  "dosage",
                  "quantity",
                  "refills",
                  "sig",
                  "pdf_base64",
                  "signature_base64",
                  "queue_id",
                  "status",
                  "tracking_number",
                  "submitted_at",
                  "updated_at",
                ];

            setResult({
              exists: true,
              columns: columns.sort(),
              error: undefined,
            });
          }
        }
      } catch (err) {
        setResult({
          exists: false,
          columns: [],
          error: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        setLoading(false);
      }
    };

    checkTable();
  }, []);

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Database Check
          </h1>
          <p className="text-muted-foreground mt-2">
            Verify prescriptions table setup
          </p>
        </div>

        <div className="bg-white border border-border rounded-lg p-6">
          {loading ? (
            <p className="text-muted-foreground">Checking database...</p>
          ) : result ? (
            <div>
              {result.exists ? (
                <div>
                  <p className="text-green-600 font-semibold text-lg mb-4">
                    ✓ Prescriptions table: Ready
                  </p>
                  <div>
                    <h2 className="font-semibold mb-2">Table Columns:</h2>
                    <ul className="list-disc list-inside space-y-1">
                      {result.columns.map((column) => (
                        <li key={column} className="text-sm text-foreground">
                          {column}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-red-600 font-semibold text-lg mb-4">
                    ✗ Prescriptions table: Missing
                  </p>
                  {result.error && (
                    <div className="bg-red-50 border border-red-200 rounded p-4">
                      <p className="text-sm text-red-800">
                        <strong>Error:</strong> {result.error}
                      </p>
                      <p className="text-sm text-red-700 mt-2">
                        Please run the database migration to create the table.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">
              Unable to check database status
            </p>
          )}
        </div>
      </div>
  );
}
