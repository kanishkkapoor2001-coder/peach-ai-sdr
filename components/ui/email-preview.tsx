"use client";

import { useState } from "react";
import { Eye, EyeOff, User, Building, Mail } from "lucide-react";

/**
 * EMAIL PREVIEW COMPONENT
 * =======================
 *
 * Shows a live preview of an email with variables replaced by actual lead data.
 * Supports toggling between raw template view and rendered preview.
 */

interface LeadData {
  firstName?: string;
  lastName?: string;
  email?: string;
  jobTitle?: string;
  schoolName?: string;
  schoolWebsite?: string;
  schoolCountry?: string;
  curriculum?: string | string[];
}

interface SenderData {
  senderName?: string;
  senderTitle?: string;
  senderCompany?: string;
}

interface EmailPreviewProps {
  subject: string;
  body: string;
  lead?: LeadData;
  sender?: SenderData;
  showToggle?: boolean;
  className?: string;
}

// Replace variables in text with actual values
function replaceVariables(
  text: string,
  lead?: LeadData,
  sender?: SenderData
): string {
  if (!text) return "";

  let result = text;

  // Lead variables
  if (lead) {
    result = result
      .replace(/\{\{firstName\}\}/g, lead.firstName || "[First Name]")
      .replace(/\{\{lastName\}\}/g, lead.lastName || "[Last Name]")
      .replace(
        /\{\{fullName\}\}/g,
        lead.firstName && lead.lastName
          ? `${lead.firstName} ${lead.lastName}`
          : "[Full Name]"
      )
      .replace(/\{\{email\}\}/g, lead.email || "[Email]")
      .replace(/\{\{jobTitle\}\}/g, lead.jobTitle || "[Job Title]")
      .replace(/\{\{schoolName\}\}/g, lead.schoolName || "[School Name]")
      .replace(/\{\{schoolWebsite\}\}/g, lead.schoolWebsite || "[School Website]")
      .replace(/\{\{schoolCountry\}\}/g, lead.schoolCountry || "[School Country]")
      .replace(
        /\{\{curriculum\}\}/g,
        Array.isArray(lead.curriculum)
          ? lead.curriculum.join(", ")
          : lead.curriculum || "[Curriculum]"
      );
  }

  // Sender variables
  if (sender) {
    result = result
      .replace(/\{\{senderName\}\}/g, sender.senderName || "[Sender Name]")
      .replace(/\{\{senderTitle\}\}/g, sender.senderTitle || "[Sender Title]")
      .replace(/\{\{senderCompany\}\}/g, sender.senderCompany || "[Company]");
  }

  return result;
}

// Highlight remaining unparsed variables
function highlightVariables(text: string): React.ReactNode {
  if (!text) return null;

  const parts = text.split(/(\{\{[^}]+\}\})/g);

  return parts.map((part, index) => {
    if (part.match(/^\{\{[^}]+\}\}$/)) {
      // This is a variable
      return (
        <span
          key={index}
          className="bg-amber-100 text-amber-800 px-1 rounded text-sm font-mono"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

export function EmailPreview({
  subject,
  body,
  lead,
  sender,
  showToggle = true,
  className = "",
}: EmailPreviewProps) {
  const [showPreview, setShowPreview] = useState(true);

  const previewSubject = replaceVariables(subject, lead, sender);
  const previewBody = replaceVariables(body, lead, sender);

  return (
    <div className={`bg-white rounded-lg border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-3">
          {lead && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="h-4 w-4" />
              <span className="font-medium">
                {lead.firstName} {lead.lastName}
              </span>
              {lead.schoolName && (
                <>
                  <span className="text-gray-400">at</span>
                  <Building className="h-4 w-4" />
                  <span>{lead.schoolName}</span>
                </>
              )}
            </div>
          )}
        </div>
        {showToggle && (
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-colors ${
              showPreview
                ? "bg-peach-100 text-peach-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {showPreview ? (
              <>
                <Eye className="h-3.5 w-3.5" />
                Preview Mode
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                Raw Template
              </>
            )}
          </button>
        )}
      </div>

      {/* Email Content */}
      <div className="p-4">
        {/* Subject */}
        <div className="mb-3">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Mail className="h-3.5 w-3.5" />
            Subject
          </div>
          <p className="font-medium text-gray-900">
            {showPreview ? previewSubject : highlightVariables(subject)}
          </p>
        </div>

        {/* Divider */}
        <div className="border-t my-3" />

        {/* Body */}
        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
          {showPreview
            ? previewBody.split("\n").map((line, i) => (
                <p key={i} className={line.trim() === "" ? "h-4" : ""}>
                  {line}
                </p>
              ))
            : body.split("\n").map((line, i) => (
                <p key={i} className={line.trim() === "" ? "h-4" : ""}>
                  {highlightVariables(line)}
                </p>
              ))}
        </div>
      </div>

      {/* Footer Info */}
      {!showPreview && (
        <div className="px-4 py-2 border-t bg-amber-50 rounded-b-lg">
          <p className="text-xs text-amber-700">
            <span className="font-medium">Variables highlighted:</span>{" "}
            These will be replaced with actual lead data when the email is sent.
          </p>
        </div>
      )}
    </div>
  );
}

// Mini preview for list views - just shows the subject with substitution
export function EmailPreviewMini({
  subject,
  lead,
}: {
  subject: string;
  lead?: LeadData;
}) {
  const previewSubject = replaceVariables(subject, lead);

  return (
    <span className="text-sm text-gray-600 truncate">
      {previewSubject}
    </span>
  );
}
