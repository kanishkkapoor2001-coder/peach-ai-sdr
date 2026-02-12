"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  AlertCircle,
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  Sparkles,
} from "lucide-react";

export interface SearchResult {
  name: string;
  title: string;
  email: string | null;
  phone: string | null;
  schoolName: string;
  location: string;
  website: string | null;
  reason: string;
  confidence: number;
  // Transformed fields
  firstName: string;
  lastName: string;
  jobTitle: string;
  schoolWebsite: string | null;
  schoolCountry: string | null;
  schoolRegion: string | null;
  researchSummary: string;
  leadScore: number | null;
}

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  duration: string;
  open: boolean;
  onClose: () => void;
  onImport: (leads: SearchResult[]) => Promise<void>;
}

export function SearchResults({
  results,
  query,
  duration,
  open,
  onClose,
  onImport,
}: SearchResultsProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set(results.map((_, i) => i)) // Select all by default
  );
  const [importing, setImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const toggleSelection = (index: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map((_, i) => i)));
    }
  };

  const handleImport = async () => {
    const selectedLeads = results.filter((_, i) => selectedIds.has(i));
    if (selectedLeads.length === 0) return;

    setImporting(true);
    try {
      await onImport(selectedLeads);
      setImportedCount(selectedLeads.length);
      setImportComplete(true);
    } catch (error) {
      console.error("Import failed:", error);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setSelectedIds(new Set(results.map((_, i) => i)));
    setImportComplete(false);
    setImportedCount(0);
    onClose();
  };

  const leadsWithEmail = results.filter((r) => r.email).length;
  const leadsWithoutEmail = results.length - leadsWithEmail;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-peach-500" />
            Search Results
          </DialogTitle>
          <DialogDescription>
            Found {results.length} leads for "{query}" in {duration}
          </DialogDescription>
        </DialogHeader>

        {importComplete ? (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Import Complete!</h3>
              <p className="text-gray-500 mt-1">
                Successfully imported {importedCount} leads
              </p>
            </div>
            <Button onClick={handleClose}>Done</Button>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
                <User className="h-4 w-4 text-gray-500" />
                <span>{results.length} leads</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full text-green-700">
                <Mail className="h-4 w-4" />
                <span>{leadsWithEmail} with email</span>
              </div>
              {leadsWithoutEmail > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 rounded-full text-yellow-700">
                  <AlertCircle className="h-4 w-4" />
                  <span>{leadsWithoutEmail} need email</span>
                </div>
              )}
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto border rounded-lg divide-y">
              {/* Select All Header */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 sticky top-0">
                <input
                  type="checkbox"
                  checked={selectedIds.size === results.length}
                  onChange={toggleAll}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-600">
                  {selectedIds.size} of {results.length} selected
                </span>
              </div>

              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    selectedIds.has(index) ? "bg-peach-50/50" : ""
                  }`}
                >
                  <div className="flex gap-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(index)}
                      onChange={() => toggleSelection(index)}
                      className="rounded border-gray-300 mt-1"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">
                              {result.name}
                            </h4>
                            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                              {Math.round(result.confidence * 100)}% match
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{result.title}</p>
                        </div>

                        {/* Contact Info */}
                        <div className="text-right text-sm">
                          {result.email ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <Mail className="h-3 w-3" />
                              <span className="truncate max-w-40">{result.email}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-yellow-600">
                              <Mail className="h-3 w-3" />
                              <span>No email</span>
                            </div>
                          )}
                          {result.phone && (
                            <div className="flex items-center gap-1 text-gray-500 mt-0.5">
                              <Phone className="h-3 w-3" />
                              <span>{result.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* School Info */}
                      <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          <span>{result.schoolName}</span>
                        </div>
                        <span className="text-gray-300">|</span>
                        <span>{result.location}</span>
                        {result.website && (
                          <>
                            <span className="text-gray-300">|</span>
                            <a
                              href={result.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-peach-600 hover:underline"
                            >
                              <Globe className="h-3 w-3" />
                              Website
                            </a>
                          </>
                        )}
                      </div>

                      {/* Selection Reason */}
                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                        {result.reason}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-2">
              <p className="text-sm text-gray-500">
                {leadsWithoutEmail > 0 && (
                  <span>
                    Note: {leadsWithoutEmail} leads don't have emails and will need to be found separately.
                  </span>
                )}
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={selectedIds.size === 0 || importing}
                >
                  {importing ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Importing...
                    </>
                  ) : (
                    `Import ${selectedIds.size} Leads`
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
