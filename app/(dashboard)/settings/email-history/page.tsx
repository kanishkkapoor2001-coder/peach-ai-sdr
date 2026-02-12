"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Check, AlertCircle, Loader2, History, Trash2 } from "lucide-react";

export default function EmailHistoryPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<{
    success?: boolean;
    imported?: number;
    skipped?: number;
    error?: string;
  } | null>(null);
  const [historyCount, setHistoryCount] = useState<number>(0);

  // Fetch current count
  useEffect(() => {
    fetch("/api/email-history/import")
      .then((res) => res.json())
      .then((data) => setHistoryCount(data.count || 0))
      .catch(() => {});
  }, [result]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/email-history/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({ error: data.error || "Upload failed" });
      } else {
        setResult({
          success: true,
          imported: data.imported,
          skipped: data.skipped,
        });
        setFile(null);
      }
    } catch (error) {
      setResult({ error: "Upload failed. Please try again." });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Email History</h1>
        <p className="text-gray-500 mt-1">
          Import past contacts to prevent re-contacting the same people
        </p>
      </div>

      {/* Current Stats */}
      <div className="bg-white rounded-xl border p-6 shadow-sm mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 rounded-lg">
            <History className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Emails in history</p>
            <p className="text-2xl font-bold text-gray-900">{historyCount.toLocaleString()}</p>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          These emails will be excluded from search results to prevent duplicate outreach.
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Import Past Email History
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Upload a CSV file with email addresses of people you&apos;ve already contacted.
          The file should have at least an &quot;email&quot; column. Optional columns include
          name, job_title, and school_name.
        </p>

        {/* File Input */}
        <div className="border-2 border-dashed rounded-lg p-8 text-center mb-4">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            id="history-file"
          />
          <label
            htmlFor="history-file"
            className="cursor-pointer flex flex-col items-center"
          >
            <Upload className="h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">
              {file ? file.name : "Click to select a CSV file"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              CSV, XLSX, or XLS files supported
            </p>
          </label>
        </div>

        {/* Upload Button */}
        {file && (
          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import {file.name}
              </>
            )}
          </Button>
        )}

        {/* Result */}
        {result && (
          <div
            className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
              result.success
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            {result.success ? (
              <Check className="h-5 w-5 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            )}
            <div>
              {result.success ? (
                <>
                  <p className="font-medium text-green-800">Import successful!</p>
                  <p className="text-sm text-green-700">
                    Added {result.imported} new emails.
                    {result.skipped ? ` Skipped ${result.skipped} duplicates.` : ""}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-red-800">Import failed</p>
                  <p className="text-sm text-red-700">{result.error}</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Example Format */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-2">Example CSV format:</p>
          <pre className="text-xs text-gray-600 overflow-x-auto">
{`email,name,job_title,school_name
john@example.com,John Smith,Principal,Example School
jane@school.edu,Jane Doe,Head of Curriculum,Another School`}
          </pre>
        </div>
      </div>
    </div>
  );
}
