"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Plus, X } from "lucide-react";
import { getLeadFields } from "@/lib/utils/csv-parser";

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: (count: number) => void;
  campaignId?: string; // Optional campaign ID to import leads directly into a campaign
}

type ImportStep = "upload" | "mapping" | "preview" | "importing" | "complete";

interface PreviewData {
  headers: string[];
  mappings: Record<string, string>;
  preview: Array<Record<string, unknown>>;
  totalRows: number;
  filename: string;
}

// Custom field definition
interface CustomField {
  id: string;
  name: string;
}

export function ImportModal({ open, onClose, onImportComplete, campaignId }: ImportModalProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    duplicatesRemoved: number;
    invalidCount: number;
  } | null>(null);

  // Custom fields management
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [newCustomFieldName, setNewCustomFieldName] = useState("");
  const [showAddCustomField, setShowAddCustomField] = useState(false);

  const leadFields = getLeadFields();

  // Combine standard fields with custom fields
  const allFields = [
    ...leadFields,
    ...customFields.map((cf) => ({
      field: `custom_${cf.id}`,
      label: `${cf.name} (Custom)`,
      required: false,
    })),
  ];

  const handleFileDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      await processFile(droppedFile);
    }
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      await processFile(selectedFile);
    }
  }, []);

  const processFile = async (selectedFile: File) => {
    setError(null);
    setFile(selectedFile);

    // Validate file type
    const validTypes = [".csv", ".xlsx", ".xls"];
    const isValid = validTypes.some((ext) => selectedFile.name.toLowerCase().endsWith(ext));

    if (!isValid) {
      setError("Please upload a CSV or Excel file (.csv, .xlsx, .xls)");
      return;
    }

    // Get preview from API
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("/api/leads/import", {
        method: "PUT", // PUT for preview
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to parse file");
      }

      const data = await response.json();
      setPreviewData(data);
      setMappings(data.mappings);
      setStep("mapping");

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    }
  };

  const handleMappingChange = (header: string, field: string) => {
    setMappings((prev) => ({ ...prev, [header]: field }));
  };

  const handleAddCustomField = () => {
    if (!newCustomFieldName.trim()) return;

    const newField: CustomField = {
      id: Date.now().toString(),
      name: newCustomFieldName.trim(),
    };

    setCustomFields((prev) => [...prev, newField]);
    setNewCustomFieldName("");
    setShowAddCustomField(false);
  };

  const handleRemoveCustomField = (id: string) => {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
    // Also remove any mappings using this custom field
    setMappings((prev) => {
      const updated = { ...prev };
      for (const [header, field] of Object.entries(updated)) {
        if (field === `custom_${id}`) {
          updated[header] = "_skip";
        }
      }
      return updated;
    });
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setStep("importing");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mappings", JSON.stringify(mappings));
      formData.append("customFields", JSON.stringify(customFields));
      if (campaignId) {
        formData.append("campaignId", campaignId);
      }

      const response = await fetch("/api/leads/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Import failed");
      }

      setImportResult({
        imported: data.imported,
        duplicatesRemoved: data.duplicatesRemoved,
        invalidCount: data.invalidCount,
      });
      setStep("complete");
      onImportComplete(data.imported);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("mapping");
    } finally {
      setImporting(false);
    }
  };

  const resetModal = () => {
    setStep("upload");
    setFile(null);
    setPreviewData(null);
    setMappings({});
    setError(null);
    setImportResult(null);
    setCustomFields([]);
    setNewCustomFieldName("");
    setShowAddCustomField(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Leads from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file with your leads data
          </DialogDescription>
        </DialogHeader>

        {/* Upload Step */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              onDrop={handleFileDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed rounded-lg p-8 text-center hover:border-peach-500 transition-colors cursor-pointer"
            >
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">
                  Drag and drop your file here, or click to browse
                </p>
                <p className="text-sm text-gray-400">
                  Supports CSV, XLSX, XLS files
                </p>
              </label>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Mapping Step */}
        {step === "mapping" && previewData && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <FileSpreadsheet className="h-4 w-4" />
              <span>{previewData.filename}</span>
              <span className="text-gray-300">|</span>
              <span>{previewData.totalRows} rows</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Map Columns</h3>
                  <p className="text-sm text-gray-500">
                    Match your CSV columns to lead fields. Add custom fields if needed.
                  </p>
                </div>
              </div>

              {/* Custom Fields Section */}
              {customFields.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-blue-700">Custom Fields</p>
                  <div className="flex flex-wrap gap-2">
                    {customFields.map((cf) => (
                      <span
                        key={cf.id}
                        className="inline-flex items-center gap-1 bg-white text-blue-700 px-2 py-1 rounded text-sm border border-blue-200"
                      >
                        {cf.name}
                        <button
                          onClick={() => handleRemoveCustomField(cf.id)}
                          className="text-blue-400 hover:text-blue-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Custom Field */}
              {showAddCustomField ? (
                <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                  <Input
                    value={newCustomFieldName}
                    onChange={(e) => setNewCustomFieldName(e.target.value)}
                    placeholder="Enter field name (e.g., 'Source', 'Campaign')"
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddCustomField();
                      if (e.key === "Escape") setShowAddCustomField(false);
                    }}
                    autoFocus
                  />
                  <Button size="sm" onClick={handleAddCustomField}>
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowAddCustomField(false);
                      setNewCustomFieldName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddCustomField(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Custom Field
                </Button>
              )}

              <div className="grid gap-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                {previewData.headers.map((header) => (
                  <div key={header} className="flex items-center gap-3 py-1">
                    <span className="text-sm text-gray-600 w-44 truncate font-mono bg-gray-50 px-2 py-1 rounded" title={header}>
                      {header}
                    </span>
                    <span className="text-gray-300">→</span>
                    <Select
                      value={mappings[header] || "_skip"}
                      onValueChange={(value) => handleMappingChange(header, value)}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_skip">
                          <span className="text-gray-400">Skip this column</span>
                        </SelectItem>
                        <div className="px-2 py-1 text-xs text-gray-500 bg-gray-50">
                          Standard Fields
                        </div>
                        {leadFields.filter(f => f.field !== "_skip").map((field) => (
                          <SelectItem key={field.field} value={field.field}>
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </SelectItem>
                        ))}
                        {customFields.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-xs text-gray-500 bg-blue-50">
                              Custom Fields
                            </div>
                            {customFields.map((cf) => (
                              <SelectItem key={cf.id} value={`custom_${cf.id}`}>
                                {cf.name}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview Table */}
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900">Preview (first 5 rows)</h3>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {previewData.headers.slice(0, 6).map((header) => (
                        <th key={header} className="px-3 py-2 text-left text-gray-500 truncate max-w-32 text-xs">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {previewData.preview.map((row, i) => (
                      <tr key={i}>
                        {previewData.headers.slice(0, 6).map((header) => (
                          <td key={header} className="px-3 py-2 truncate max-w-32 text-xs">
                            {String(row[header] || "-")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={resetModal}>
                Back
              </Button>
              <Button onClick={handleImport}>
                Import {previewData.totalRows} Leads
              </Button>
            </div>
          </div>
        )}

        {/* Importing Step */}
        {step === "importing" && (
          <div className="py-8 text-center">
            <div className="animate-spin h-12 w-12 border-4 border-peach-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600">Importing leads...</p>
            <p className="text-sm text-gray-400 mt-1">This may take a moment</p>
          </div>
        )}

        {/* Complete Step */}
        {step === "complete" && importResult && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Import Complete!</h3>
              <p className="text-gray-500 mt-1">
                Successfully imported {importResult.imported} leads
              </p>
            </div>

            {(importResult.duplicatesRemoved > 0 || importResult.invalidCount > 0) && (
              <div className="text-sm text-gray-500 space-y-1">
                {importResult.duplicatesRemoved > 0 && (
                  <p>{importResult.duplicatesRemoved} duplicates removed</p>
                )}
                {importResult.invalidCount > 0 && (
                  <p>{importResult.invalidCount} invalid rows skipped</p>
                )}
              </div>
            )}

            <Button onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
