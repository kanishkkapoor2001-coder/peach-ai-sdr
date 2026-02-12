"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Variable, X } from "lucide-react";

/**
 * VARIABLE DROPDOWN COMPONENT
 * ============================
 *
 * Allows users to insert merge tags/variables into email content.
 * Works with any text input or textarea.
 *
 * DYNAMIC VARIABLES:
 * Variables are NOT hardcoded - they are derived from actual lead data.
 * Pass a sample lead object to generate variables from its fields.
 * This means CSV headers become available as variables automatically.
 */

export interface VariableOption {
  key: string;
  label: string;
  description: string;
  example: string;
  category?: string;
}

// Labels for common field names (for better display)
const FIELD_LABELS: Record<string, { label: string; description: string; category: string }> = {
  // Contact fields
  firstName: { label: "First Name", description: "Contact's first name", category: "Contact" },
  lastName: { label: "Last Name", description: "Contact's last name", category: "Contact" },
  fullName: { label: "Full Name", description: "Contact's full name", category: "Contact" },
  email: { label: "Email", description: "Contact's email address", category: "Contact" },
  jobTitle: { label: "Job Title", description: "Contact's position", category: "Contact" },
  phone: { label: "Phone", description: "Contact's phone number", category: "Contact" },
  linkedinUrl: { label: "LinkedIn", description: "LinkedIn profile URL", category: "Contact" },

  // School fields
  schoolName: { label: "School Name", description: "Name of the school", category: "School" },
  schoolWebsite: { label: "School Website", description: "School's website URL", category: "School" },
  schoolCountry: { label: "Country", description: "School's country", category: "School" },
  schoolRegion: { label: "Region", description: "School's region/state", category: "School" },
  curriculum: { label: "Curriculum", description: "School's curriculum type", category: "School" },
  annualFeesUsd: { label: "Annual Fees", description: "Annual fees in USD", category: "School" },
  studentCount: { label: "Student Count", description: "Number of students", category: "School" },
  deviceAccess: { label: "Device Access", description: "Student device access level", category: "School" },
  schoolType: { label: "School Type", description: "Type of school", category: "School" },

  // Sender fields
  senderName: { label: "Sender Name", description: "Your name in signature", category: "Sender" },
  senderTitle: { label: "Sender Title", description: "Your job title", category: "Sender" },
  senderCompany: { label: "Company Name", description: "Your company name", category: "Sender" },

  // Research fields
  researchSummary: { label: "Research Summary", description: "AI-generated research about the lead", category: "Research" },
  leadScore: { label: "Lead Score", description: "Calculated lead score", category: "Research" },
};

// Convert camelCase or snake_case to Title Case
function toTitleCase(str: string): string {
  return str
    .replace(/([A-Z])/g, " $1") // Add space before capitals
    .replace(/_/g, " ") // Replace underscores with spaces
    .replace(/^./, (c) => c.toUpperCase()) // Capitalize first letter
    .trim();
}

/**
 * Generate variable options from a lead object
 * This extracts all keys from the lead and creates variable options
 */
export function generateVariablesFromLead(lead: Record<string, unknown> | null): VariableOption[] {
  if (!lead) return [];

  const variables: VariableOption[] = [];
  const seenKeys = new Set<string>();

  // Process each key in the lead object
  for (const [key, value] of Object.entries(lead)) {
    // Skip internal/system fields
    if (key === "id" || key === "createdAt" || key === "updatedAt" || key === "sequence" || key === "campaignId") {
      continue;
    }

    // Skip if we've seen this key
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    // Get label info from predefined labels or generate from key
    const labelInfo = FIELD_LABELS[key] || {
      label: toTitleCase(key),
      description: `Value of ${toTitleCase(key)}`,
      category: "Custom",
    };

    // Get example value
    let example = "[No value]";
    if (value !== null && value !== undefined) {
      if (Array.isArray(value)) {
        example = value.slice(0, 3).join(", ") || "[No value]";
      } else if (typeof value === "object") {
        example = JSON.stringify(value).slice(0, 30) + "...";
      } else {
        example = String(value).slice(0, 50);
      }
    }

    variables.push({
      key,
      label: labelInfo.label,
      description: labelInfo.description,
      example,
      category: labelInfo.category,
    });
  }

  // Add fullName if firstName and lastName exist
  if (seenKeys.has("firstName") && seenKeys.has("lastName") && !seenKeys.has("fullName")) {
    const firstName = lead.firstName as string || "";
    const lastName = lead.lastName as string || "";
    variables.push({
      key: "fullName",
      label: "Full Name",
      description: "Contact's full name",
      example: `${firstName} ${lastName}`.trim() || "John Smith",
      category: "Contact",
    });
  }

  // Sort by category, then by label
  const categoryOrder = ["Contact", "School", "Sender", "Research", "Custom"];
  variables.sort((a, b) => {
    const catA = categoryOrder.indexOf(a.category || "Custom");
    const catB = categoryOrder.indexOf(b.category || "Custom");
    if (catA !== catB) return catA - catB;
    return a.label.localeCompare(b.label);
  });

  return variables;
}

// Default sender variables (always available)
const SENDER_VARIABLES: VariableOption[] = [
  { key: "senderName", label: "Sender Name", description: "Your name in signature", example: "Sarah", category: "Sender" },
  { key: "senderTitle", label: "Sender Title", description: "Your job title", example: "Partnership Manager", category: "Sender" },
  { key: "senderCompany", label: "Company Name", description: "Your company name", example: "Peach", category: "Sender" },
];

interface VariableDropdownProps {
  onInsert: (variable: string) => void;
  /** Pass a lead object to dynamically generate variables from its fields */
  sampleLead?: Record<string, unknown> | null;
  /** Alternatively, pass custom variables directly */
  variables?: VariableOption[];
  disabled?: boolean;
  className?: string;
  position?: "top" | "bottom";
}

export function VariableDropdown({
  onInsert,
  sampleLead,
  variables: customVariables,
  disabled = false,
  className = "",
  position = "bottom",
}: VariableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate variables from lead data or use custom variables
  const variables = useMemo(() => {
    if (customVariables && customVariables.length > 0) {
      return customVariables;
    }
    // Generate from sample lead + always include sender variables
    const leadVars = generateVariablesFromLead(sampleLead || null);
    // Add sender variables if not already present
    const existingKeys = new Set(leadVars.map(v => v.key));
    const senderVars = SENDER_VARIABLES.filter(v => !existingKeys.has(v.key));
    return [...leadVars, ...senderVars];
  }, [sampleLead, customVariables]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Filter variables based on search
  const filteredVariables = variables.filter(
    (v) =>
      v.label.toLowerCase().includes(search.toLowerCase()) ||
      v.key.toLowerCase().includes(search.toLowerCase()) ||
      v.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleInsert = (variable: VariableOption) => {
    onInsert(`{{${variable.key}}}`);
    setIsOpen(false);
    setSearch("");
  };

  // Group variables by category
  const groupedVariables = useMemo(() => {
    const groups: Record<string, VariableOption[]> = {};
    for (const v of filteredVariables) {
      const category = v.category || "Other";
      if (!groups[category]) groups[category] = [];
      groups[category].push(v);
    }
    return groups;
  }, [filteredVariables]);

  const categoryOrder = ["Contact", "School", "Sender", "Research", "Custom", "Other"];
  const sortedCategories = Object.keys(groupedVariables).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
          disabled
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : isOpen
            ? "bg-peach-100 text-peach-700 border border-peach-300"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200 hover:border-gray-300"
        }`}
        title="Insert personalization variable"
      >
        <Variable className="h-3.5 w-3.5" />
        Variables
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className={`absolute ${position === "top" ? "bottom-full mb-1" : "top-full mt-1"} left-0 z-50 w-80 bg-white rounded-lg border shadow-lg`}
        >
          {/* Search Header */}
          <div className="p-2 border-b">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search variables..."
                className="w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-peach-500 focus:border-peach-500"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Variable List */}
          <div className="max-h-72 overflow-y-auto">
            {filteredVariables.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                No variables match "{search}"
              </div>
            ) : (
              <div className="py-1">
                {sortedCategories.map((category, idx) => (
                  <div key={category} className={idx > 0 ? "border-t" : ""}>
                    <div className="px-3 py-1.5 bg-gray-50 sticky top-0">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {category}
                      </p>
                    </div>
                    <div className="px-2 py-1">
                      {groupedVariables[category].map((v) => (
                        <VariableItem key={v.key} variable={v} onClick={() => handleInsert(v)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Help Text */}
          <div className="border-t px-3 py-2 bg-gray-50 rounded-b-lg">
            <p className="text-xs text-gray-500">
              Click to insert. Variables are replaced with actual values when sent.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Individual variable item component
function VariableItem({
  variable,
  onClick,
}: {
  variable: VariableOption;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-2 py-1.5 rounded hover:bg-peach-50 group transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-900 group-hover:text-peach-700 truncate">
          {variable.label}
        </span>
        <code className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded group-hover:bg-peach-100 group-hover:text-peach-600 flex-shrink-0">
          {`{{${variable.key}}}`}
        </code>
      </div>
      <p className="text-xs text-gray-500 mt-0.5 truncate">
        e.g., {variable.example}
      </p>
    </button>
  );
}

/**
 * Helper hook to use with textarea or input
 *
 * Usage:
 * const { ref, insertAtCursor } = useVariableInsertion();
 * <textarea ref={ref} ... />
 * <VariableDropdown onInsert={insertAtCursor} />
 */
export function useVariableInsertion<T extends HTMLInputElement | HTMLTextAreaElement>() {
  const ref = useRef<T>(null);

  const insertAtCursor = (text: string) => {
    const element = ref.current;
    if (!element) return;

    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? 0;
    const currentValue = element.value;

    // Insert text at cursor position
    const newValue = currentValue.slice(0, start) + text + currentValue.slice(end);

    // Trigger onChange event
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement?.prototype || window.HTMLInputElement.prototype,
      "value"
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, newValue);
      const event = new Event("input", { bubbles: true });
      element.dispatchEvent(event);
    }

    // Move cursor after inserted text
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + text.length, start + text.length);
    });
  };

  return { ref, insertAtCursor };
}
