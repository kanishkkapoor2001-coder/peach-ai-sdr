"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Trash2,
  Clock,
  Mail,
  ChevronDown,
  ChevronUp,
  Save,
  Play,
  Eye,
  X,
  ArrowLeft,
  Sparkles,
  Copy,
  Check,
  Loader2,
  User,
  Building2,
  Briefcase,
  Globe,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";

// Available variables for personalization
const VARIABLES = [
  { key: "firstName", label: "First Name", icon: User, example: "John" },
  { key: "lastName", label: "Last Name", icon: User, example: "Smith" },
  { key: "fullName", label: "Full Name", icon: User, example: "John Smith" },
  { key: "email", label: "Email", icon: Mail, example: "john@school.edu" },
  { key: "jobTitle", label: "Job Title", icon: Briefcase, example: "Head of School" },
  { key: "companyName", label: "Company/School", icon: Building2, example: "International Academy" },
  { key: "schoolName", label: "School Name", icon: GraduationCap, example: "International Academy" },
  { key: "country", label: "Country", icon: Globe, example: "Singapore" },
  { key: "curriculum", label: "Curriculum", icon: GraduationCap, example: "IB, Cambridge" },
];

// Delay options
const DELAY_OPTIONS = [
  { value: 0, label: "Immediately" },
  { value: 1, label: "1 day" },
  { value: 2, label: "2 days" },
  { value: 3, label: "3 days" },
  { value: 4, label: "4 days" },
  { value: 5, label: "5 days" },
  { value: 7, label: "1 week" },
  { value: 14, label: "2 weeks" },
];

interface EmailStep {
  id: string;
  subject: string;
  body: string;
  delay: number; // days after previous email
}

export default function SequenceBuilderPage() {
  const [sequenceName, setSequenceName] = useState("New Sequence");
  const [steps, setSteps] = useState<EmailStep[]>([
    {
      id: "1",
      subject: "Quick question about {{companyName}}",
      body: `Hi {{firstName}},

I noticed {{companyName}} is doing great work in education.

I wanted to reach out because we help schools like yours [benefit].

Would you be open to a quick chat this week?

Best,
[Your Name]`,
      delay: 0,
    },
  ]);

  const [activeStep, setActiveStep] = useState<string>("1");
  const [showVariables, setShowVariables] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const [lastFocused, setLastFocused] = useState<"subject" | "body">("body");

  // Sample data for preview
  const previewData = {
    firstName: "Sarah",
    lastName: "Johnson",
    fullName: "Sarah Johnson",
    email: "sarah.johnson@intlacademy.edu",
    jobTitle: "Director of Technology",
    companyName: "International Academy Singapore",
    schoolName: "International Academy Singapore",
    country: "Singapore",
    curriculum: "IB, Cambridge",
  };

  // Add new step
  const addStep = () => {
    const newStep: EmailStep = {
      id: String(Date.now()),
      subject: "",
      body: `Hi {{firstName}},

Just following up on my previous email.

[Your follow-up message here]

Best,
[Your Name]`,
      delay: 3,
    };
    setSteps([...steps, newStep]);
    setActiveStep(newStep.id);
  };

  // Remove step
  const removeStep = (id: string) => {
    if (steps.length === 1) return;
    const newSteps = steps.filter((s) => s.id !== id);
    setSteps(newSteps);
    if (activeStep === id) {
      setActiveStep(newSteps[0].id);
    }
  };

  // Update step
  const updateStep = (id: string, field: keyof EmailStep, value: string | number) => {
    setSteps(steps.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  // Insert variable
  const insertVariable = (variable: string) => {
    const tag = `{{${variable}}}`;
    const currentStep = steps.find((s) => s.id === activeStep);
    if (!currentStep) return;

    if (lastFocused === "subject" && subjectRef.current) {
      const input = subjectRef.current;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const newValue = currentStep.subject.substring(0, start) + tag + currentStep.subject.substring(end);
      updateStep(activeStep, "subject", newValue);
      // Restore cursor position
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + tag.length, start + tag.length);
      }, 0);
    } else if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const newValue = currentStep.body.substring(0, start) + tag + currentStep.body.substring(end);
      updateStep(activeStep, "body", newValue);
      // Restore cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + tag.length, start + tag.length);
      }, 0);
    }
  };

  // Replace variables with preview data
  const replaceVariables = (text: string) => {
    let result = text;
    for (const [key, value] of Object.entries(previewData)) {
      result = result.replace(new RegExp(`{{${key}}}`, "gi"), value);
    }
    return result;
  };

  // Save sequence
  const handleSave = async () => {
    setIsSaving(true);
    // TODO: Implement save to database
    await new Promise((r) => setTimeout(r, 1000));
    setSaved(true);
    setIsSaving(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const currentStep = steps.find((s) => s.id === activeStep);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/sequences" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Input
              value={sequenceName}
              onChange={(e) => setSequenceName(e.target.value)}
              className="text-lg font-semibold border-none shadow-none px-0 focus-visible:ring-0 w-64"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setShowPreview(true)}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : saved ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saved ? "Saved!" : "Save Sequence"}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Left Sidebar - Steps Timeline */}
          <div className="w-72 flex-shrink-0">
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Steps
              </h3>

              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div key={step.id} className="relative">
                    {/* Connector Line */}
                    {index < steps.length - 1 && (
                      <div className="absolute left-5 top-14 w-0.5 h-8 bg-gray-200" />
                    )}

                    <button
                      onClick={() => setActiveStep(step.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        activeStep === step.id
                          ? "border-peach-500 bg-peach-50 shadow-sm"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            activeStep === step.id
                              ? "bg-peach-500 text-white"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate text-sm">
                            {step.subject || "No subject"}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {step.delay === 0
                              ? "Sent immediately"
                              : `Wait ${step.delay} day${step.delay > 1 ? "s" : ""}`}
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* Delay Badge between steps */}
                    {index < steps.length - 1 && (
                      <div className="flex justify-center py-1">
                        <select
                          value={steps[index + 1].delay}
                          onChange={(e) =>
                            updateStep(steps[index + 1].id, "delay", Number(e.target.value))
                          }
                          className="text-xs bg-gray-100 border-0 rounded px-2 py-1 text-gray-600"
                        >
                          {DELAY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={addStep}
                disabled={steps.length >= 5}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Email Step
              </Button>

              {steps.length >= 5 && (
                <p className="text-xs text-gray-500 text-center mt-2">
                  Maximum 5 emails per sequence
                </p>
              )}
            </div>

            {/* Variables Panel */}
            <div className="bg-white rounded-xl border shadow-sm p-4 mt-4">
              <button
                onClick={() => setShowVariables(!showVariables)}
                className="w-full flex items-center justify-between font-semibold text-gray-900"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-peach-500" />
                  Personalization
                </span>
                {showVariables ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showVariables && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-gray-500 mb-3">
                    Click to insert a variable at cursor position
                  </p>
                  {VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      onClick={() => insertVariable(v.key)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 text-left text-sm group"
                    >
                      <v.icon className="h-4 w-4 text-gray-400 group-hover:text-peach-500" />
                      <div className="flex-1">
                        <span className="text-gray-700">{v.label}</span>
                        <code className="ml-2 text-xs text-gray-400">{`{{${v.key}}}`}</code>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main Editor */}
          <div className="flex-1">
            {currentStep && (
              <div className="bg-white rounded-xl border shadow-sm">
                {/* Email Header */}
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">
                      Email {steps.findIndex((s) => s.id === activeStep) + 1}
                    </h3>
                    {steps.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeStep(activeStep)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>

                  {/* Subject Line */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subject Line
                    </label>
                    <div className="relative">
                      <Input
                        ref={subjectRef}
                        value={currentStep.subject}
                        onChange={(e) => updateStep(activeStep, "subject", e.target.value)}
                        onFocus={() => setLastFocused("subject")}
                        placeholder="Enter email subject..."
                        className="pr-10"
                      />
                      <button
                        onClick={() => {
                          setLastFocused("subject");
                          setShowVariables(true);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-peach-500"
                        title="Insert variable"
                      >
                        <Sparkles className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Email Body */}
                <div className="p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Body
                  </label>
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={currentStep.body}
                      onChange={(e) => updateStep(activeStep, "body", e.target.value)}
                      onFocus={() => setLastFocused("body")}
                      placeholder="Write your email content here..."
                      className="w-full h-96 p-4 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-peach-500 focus:border-transparent font-mono text-sm"
                    />
                    <button
                      onClick={() => {
                        setLastFocused("body");
                        setShowVariables(true);
                      }}
                      className="absolute right-3 top-3 text-gray-400 hover:text-peach-500"
                      title="Insert variable"
                    >
                      <Sparkles className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Variable hints */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs text-gray-500">Quick insert:</span>
                    {VARIABLES.slice(0, 5).map((v) => (
                      <button
                        key={v.key}
                        onClick={() => insertVariable(v.key)}
                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-peach-100 hover:text-peach-700 rounded transition-colors"
                      >
                        {`{{${v.key}}}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Delay Setting */}
                {steps.findIndex((s) => s.id === activeStep) > 0 && (
                  <div className="p-4 border-t bg-gray-50 rounded-b-xl">
                    <div className="flex items-center gap-4">
                      <Clock className="h-5 w-5 text-gray-400" />
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Send this email</span>
                        <select
                          value={currentStep.delay}
                          onChange={(e) => updateStep(activeStep, "delay", Number(e.target.value))}
                          className="border rounded-lg px-3 py-1.5 text-sm bg-white"
                        >
                          {DELAY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <span className="text-sm text-gray-600">after the previous email</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="border-b p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Email Preview</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowPreview(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-4 max-h-[70vh] overflow-y-auto space-y-6">
              {/* Preview Data Info */}
              <div className="bg-blue-50 rounded-lg p-3 text-sm">
                <p className="font-medium text-blue-900 mb-1">Preview with sample data:</p>
                <p className="text-blue-700">
                  {previewData.fullName} • {previewData.jobTitle} • {previewData.companyName}
                </p>
              </div>

              {steps.map((step, index) => (
                <div key={step.id} className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
                    <span className="font-medium text-sm">Email {index + 1}</span>
                    {index > 0 && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {step.delay === 0 ? "Immediately" : `+${step.delay} day${step.delay > 1 ? "s" : ""}`}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-medium text-gray-900 mb-3">
                      Subject: {replaceVariables(step.subject)}
                    </p>
                    <div className="text-gray-700 whitespace-pre-wrap text-sm">
                      {replaceVariables(step.body)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t p-4 flex justify-end">
              <Button onClick={() => setShowPreview(false)}>Close Preview</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
