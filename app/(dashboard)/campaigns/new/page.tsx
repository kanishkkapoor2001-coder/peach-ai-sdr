"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  Search,
  Sparkles,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  X,
  AlertCircle,
  Zap,
  UserPlus,
  Mail,
  Linkedin,
  Phone,
  MessageSquare,
  Clock,
  Plus,
  Trash2,
  Brain,
  Wand2,
  Globe,
  Calendar,
  Settings2,
} from "lucide-react";

// Channel icons mapping
const channelIcons: Record<string, any> = {
  email: Mail,
  linkedin_message: Linkedin,
  linkedin_connection: Linkedin,
  sms: MessageSquare,
  whatsapp: MessageSquare,
  phone_call: Phone,
};

const channelLabels: Record<string, string> = {
  email: "Email",
  linkedin_message: "LinkedIn Message",
  linkedin_connection: "LinkedIn Connection",
  sms: "SMS",
  whatsapp: "WhatsApp",
  phone_call: "Phone Call",
};

interface Touchpoint {
  id: string;
  channel: string;
  delayDays: number;
  subject?: string;
  body?: string;
  talkingPoints?: string[];
  contentMode: "manual" | "ai"; // Whether content is manually typed or AI-generated
  aiInstructions?: string; // Instructions for AI if contentMode is 'ai'
}

type Step = "name" | "leads" | "sequence" | "review";

export default function NewCampaignPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step state
  const [currentStep, setCurrentStep] = useState<Step>("name");

  // Campaign basics
  const [campaignName, setCampaignName] = useState("");
  const [campaignDescription, setCampaignDescription] = useState("");

  // Lead import mode
  const [leadMode, setLeadMode] = useState<"csv" | "search" | "manual" | "mix" | null>(null);

  // CSV state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({});

  // AI Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [leadLimit, setLeadLimit] = useState(20);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchElapsed, setSearchElapsed] = useState(0);
  const [searchMeta, setSearchMeta] = useState<{
    duplicatesRemoved?: number;
    noContactRemoved?: number;
    duration?: string;
  }>({});

  // Manual leads state
  const [manualLeads, setManualLeads] = useState<any[]>([]);

  // Sequence type
  const [sequenceType, setSequenceType] = useState<"ai" | "manual" | null>(null);

  // Manual sequence touchpoints
  const [touchpoints, setTouchpoints] = useState<Touchpoint[]>([
    { id: "1", channel: "email", delayDays: 0, subject: "", body: "", contentMode: "manual" },
  ]);

  // AI sequence criteria
  const [aiCriteria, setAiCriteria] = useState({
    considerSeniority: true,
    considerIndustry: true,
    considerEngagement: true,
    preferredChannels: ["email", "linkedin_message"],
    sequenceLength: 4,
    notes: "",
    // New AI generation parameters
    tone: "professional" as "professional" | "casual" | "friendly" | "formal",
    emailLength: "medium" as "short" | "medium" | "long",
    personalizationLevel: "high" as "low" | "medium" | "high",
    callToAction: "meeting" as "meeting" | "reply" | "link" | "custom",
    customCTA: "",
  });

  // AI touchpoints (preloaded based on sequence length)
  const [aiTouchpoints, setAiTouchpoints] = useState<Touchpoint[]>([]);

  // Scheduling settings
  const [schedulingSettings, setSchedulingSettings] = useState({
    timezone: "Asia/Kolkata",
    sendingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"] as string[],
    sendingTimeStart: "09:00",
    sendingTimeEnd: "18:00",
    defaultIntervalDays: 3,
  });

  // Common state
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Handle CSV file selection
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        setError("CSV file must have at least a header row and one data row");
        return;
      }

      const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
      setCsvHeaders(headers);

      // Auto-map common column names
      const autoMapping: Record<string, string> = {};
      const mappings: Record<string, string[]> = {
        firstName: ["first_name", "firstname", "first name", "given name", "name"],
        lastName: ["last_name", "lastname", "last name", "surname", "family name"],
        email: ["email", "email address", "e-mail"],
        jobTitle: ["job_title", "jobtitle", "job title", "title", "position", "role"],
        schoolName: ["school_name", "schoolname", "school name", "school", "company", "organization"],
        schoolCountry: ["school_country", "country", "location"],
        linkedinUrl: ["linkedin", "linkedin_url", "linkedin url"],
        phone: ["phone", "phone_number", "mobile"],
      };

      headers.forEach((header) => {
        const lowerHeader = header.toLowerCase();
        for (const [field, aliases] of Object.entries(mappings)) {
          if (aliases.includes(lowerHeader) || lowerHeader === field.toLowerCase()) {
            autoMapping[field] = header;
            break;
          }
        }
      });
      setCsvMapping(autoMapping);

      // Parse preview rows
      const previewRows = lines.slice(1, 6).map((line) => {
        const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => {
          row[h] = values[i] || "";
        });
        return row;
      });
      setCsvPreview(previewRows);
    };
    reader.readAsText(file);
  };

  // Handle AI Search
  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 10) {
      setError("Please enter a more detailed search query (at least 10 characters)");
      return;
    }

    setIsSearching(true);
    setError(null);
    setSearchElapsed(0);
    setSearchResults([]);

    const startTime = Date.now();
    const intervalId = setInterval(() => {
      setSearchElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      const response = await fetch("/api/leads/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, limit: leadLimit }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Search failed");
      }

      setSearchResults(data.leads || []);
      setSearchMeta({
        duplicatesRemoved: data.duplicatesRemoved || 0,
        noContactRemoved: data.noContactRemoved || 0,
        duration: data.duration,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      clearInterval(intervalId);
      setIsSearching(false);
    }
  };

  // Generate touchpoints based on count (for manual sequences)
  const generateTouchpoints = (count: number) => {
    const newTouchpoints: Touchpoint[] = [];
    for (let i = 0; i < count; i++) {
      newTouchpoints.push({
        id: Date.now().toString() + i,
        channel: "email",
        delayDays: i * schedulingSettings.defaultIntervalDays,
        subject: "",
        body: "",
        contentMode: "manual",
      });
    }
    setTouchpoints(newTouchpoints);
  };

  // Generate AI touchpoints based on sequence length and preferred channels
  const generateAiTouchpoints = (count: number, channels: string[], intervalDays: number) => {
    const newTouchpoints: Touchpoint[] = [];
    for (let i = 0; i < count; i++) {
      // Rotate through preferred channels
      const channelIndex = i % channels.length;
      const channel = channels[channelIndex] || "email";
      newTouchpoints.push({
        id: `ai-${Date.now()}-${i}`,
        channel,
        delayDays: i * intervalDays,
        subject: "",
        body: "",
        contentMode: "ai",
        aiInstructions: "",
      });
    }
    setAiTouchpoints(newTouchpoints);
  };

  // Update AI touchpoint
  const updateAiTouchpoint = (id: string, updates: Partial<Touchpoint>) => {
    setAiTouchpoints(aiTouchpoints.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  // Add touchpoint
  const addTouchpoint = () => {
    const lastTouchpoint = touchpoints[touchpoints.length - 1];
    setTouchpoints([
      ...touchpoints,
      {
        id: Date.now().toString(),
        channel: "email",
        delayDays: (lastTouchpoint?.delayDays || 0) + schedulingSettings.defaultIntervalDays,
        subject: "",
        body: "",
        contentMode: "manual",
      },
    ]);
  };

  // Remove touchpoint
  const removeTouchpoint = (id: string) => {
    if (touchpoints.length > 1) {
      setTouchpoints(touchpoints.filter((t) => t.id !== id));
    }
  };

  // Update interval for a specific touchpoint relative to previous
  const updateTouchpointInterval = (id: string, intervalFromPrev: number) => {
    const index = touchpoints.findIndex((t) => t.id === id);
    if (index <= 0) return;

    const prevDay = touchpoints[index - 1].delayDays;
    updateTouchpoint(id, { delayDays: prevDay + intervalFromPrev });
  };

  // Update touchpoint
  const updateTouchpoint = (id: string, updates: Partial<Touchpoint>) => {
    setTouchpoints(touchpoints.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  // Get total leads count
  const getTotalLeads = () => {
    let count = 0;
    if (csvPreview.length > 0) count += csvPreview.length;
    if (searchResults.length > 0) count += searchResults.length;
    if (manualLeads.length > 0) count += manualLeads.length;
    return count;
  };

  // Create campaign
  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) {
      setError("Please enter a campaign name");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Step 1: Create the campaign
      const campaignResponse = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName,
          description: campaignDescription,
          source: leadMode,
          sequenceType,
          aiCriteria: sequenceType === "ai" ? aiCriteria : null,
        }),
      });

      const campaignData = await campaignResponse.json();
      if (!campaignResponse.ok) throw new Error(campaignData.error || "Failed to create campaign");

      const campaignId = campaignData.campaign.id;

      // Step 2: Import leads
      let leadsToImport: any[] = [];

      if (csvFile && csvPreview.length > 0) {
        const text = await csvFile.text();
        const lines = text.split("\n").filter((line) => line.trim());
        const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));

        leadsToImport = lines.slice(1).map((line) => {
          const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
          return {
            firstName: values[headers.indexOf(csvMapping.firstName)] || "Unknown",
            lastName: values[headers.indexOf(csvMapping.lastName)] || "",
            email: values[headers.indexOf(csvMapping.email)] || "",
            jobTitle: values[headers.indexOf(csvMapping.jobTitle)] || "Unknown",
            schoolName: values[headers.indexOf(csvMapping.schoolName)] || "Unknown",
            schoolCountry: values[headers.indexOf(csvMapping.schoolCountry)] || null,
            linkedinUrl: values[headers.indexOf(csvMapping.linkedinUrl)] || null,
            phone: values[headers.indexOf(csvMapping.phone)] || null,
          };
        }).filter((lead) => lead.email);
      }

      if (searchResults.length > 0) {
        leadsToImport = [...leadsToImport, ...searchResults];
      }

      if (manualLeads.length > 0) {
        leadsToImport = [...leadsToImport, ...manualLeads];
      }

      if (leadsToImport.length > 0) {
        console.log(`[Campaign Create] Importing ${leadsToImport.length} leads to campaign ${campaignId}`);
        const importResponse = await fetch("/api/leads/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leads: leadsToImport,
            source: leadMode,
            campaignId,
          }),
        });

        const importData = await importResponse.json();
        if (!importResponse.ok) {
          console.error("[Campaign Create] Lead import failed:", importData);
          throw new Error(importData.error || "Failed to import leads");
        }
        console.log(`[Campaign Create] Successfully imported ${importData.imported} leads`);
      }

      // Step 3: Create sequence template
      if (sequenceType === "manual" && touchpoints.length > 0) {
        await fetch("/api/sequence-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId,
            name: `${campaignName} Sequence`,
            generationType: "manual",
            touchpoints,
            schedulingSettings,
          }),
        });
      } else if (sequenceType === "ai" && aiTouchpoints.length > 0) {
        // Create AI sequence template with touchpoints structure
        await fetch("/api/sequence-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId,
            name: `${campaignName} AI Sequence`,
            generationType: "ai",
            touchpoints: aiTouchpoints,
            aiCriteria,
            schedulingSettings,
          }),
        });
      }

      router.push(`/campaigns/${campaignId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setIsCreating(false);
    }
  };

  // Step navigation
  const canProceed = () => {
    switch (currentStep) {
      case "name":
        return campaignName.trim().length > 0;
      case "leads":
        return leadMode !== null && (csvPreview.length > 0 || searchResults.length > 0 || manualLeads.length > 0);
      case "sequence":
        return sequenceType !== null;
      case "review":
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (currentStep === "name") setCurrentStep("leads");
    else if (currentStep === "leads") setCurrentStep("sequence");
    else if (currentStep === "sequence") setCurrentStep("review");
  };

  const prevStep = () => {
    if (currentStep === "leads") setCurrentStep("name");
    else if (currentStep === "sequence") setCurrentStep("leads");
    else if (currentStep === "review") setCurrentStep("sequence");
  };

  const steps = [
    { key: "name", label: "Campaign" },
    { key: "leads", label: "Leads" },
    { key: "sequence", label: "Sequence" },
    { key: "review", label: "Review" },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.push("/campaigns")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Campaign</h1>
          <p className="text-gray-500">Set up your outreach campaign step by step</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => (
          <div key={step.key} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                currentStep === step.key
                  ? "bg-peach-500 text-white"
                  : steps.findIndex((s) => s.key === currentStep) > index
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {steps.findIndex((s) => s.key === currentStep) > index ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                index + 1
              )}
            </div>
            <span
              className={`ml-2 text-sm font-medium ${
                currentStep === step.key ? "text-gray-900" : "text-gray-500"
              }`}
            >
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <div className="w-24 h-0.5 bg-gray-200 mx-4" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Campaign Name */}
      {currentStep === "name" && (
        <div className="bg-white rounded-xl border p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Campaign Name *
            </label>
            <Input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g., Q1 IB Schools Outreach"
              className="text-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (optional)
            </label>
            <textarea
              value={campaignDescription}
              onChange={(e) => setCampaignDescription(e.target.value)}
              placeholder="Brief description of this campaign's goals..."
              className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
              rows={3}
            />
          </div>
        </div>
      )}

      {/* Step 2: Lead Import */}
      {currentStep === "leads" && (
        <div className="space-y-6">
          {/* Import Mode Selection */}
          {!leadMode && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                onClick={() => setLeadMode("csv")}
                className="bg-white rounded-xl border p-6 hover:border-peach-300 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <FileSpreadsheet className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Upload CSV</h3>
                    <p className="text-gray-500 text-sm">Import leads from a spreadsheet</p>
                  </div>
                </div>
              </div>

              <div
                onClick={() => setLeadMode("search")}
                className="bg-white rounded-xl border p-6 hover:border-peach-300 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">AI Search</h3>
                    <p className="text-gray-500 text-sm">Find prospects with natural language</p>
                  </div>
                </div>
              </div>

              <div
                onClick={() => setLeadMode("manual")}
                className="bg-white rounded-xl border p-6 hover:border-peach-300 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <UserPlus className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Add Manually</h3>
                    <p className="text-gray-500 text-sm">Enter leads one by one</p>
                  </div>
                </div>
              </div>

              <div
                onClick={() => setLeadMode("mix")}
                className="bg-white rounded-xl border p-6 hover:border-peach-300 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Zap className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Mix & Match</h3>
                    <p className="text-gray-500 text-sm">Combine multiple import methods</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CSV Upload */}
          {(leadMode === "csv" || leadMode === "mix") && (
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">CSV Upload</h3>
                {leadMode === "mix" && (
                  <Button variant="ghost" size="sm" onClick={() => { setCsvFile(null); setCsvPreview([]); }}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {!csvFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50"
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500">Click to upload CSV</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleCsvFileChange}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-green-700 font-medium">{csvFile.name}</span>
                    <span className="text-green-600 text-sm">({csvPreview.length} rows)</span>
                  </div>

                  {/* Column Mapping */}
                  <div className="grid grid-cols-3 gap-3">
                    {["email", "firstName", "lastName", "jobTitle", "schoolName"].map((field) => (
                      <div key={field}>
                        <label className="block text-xs text-gray-500 mb-1">
                          {field === "email" ? "Email *" : field.replace(/([A-Z])/g, " $1").trim()}
                        </label>
                        <select
                          value={csvMapping[field] || ""}
                          onChange={(e) => setCsvMapping({ ...csvMapping, [field]: e.target.value })}
                          className="w-full px-2 py-1.5 border rounded text-sm"
                        >
                          <option value="">Select</option>
                          {csvHeaders.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Search */}
          {(leadMode === "search" || leadMode === "mix") && (
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">AI Lead Search</h3>
              </div>

              <div className="flex gap-3 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Describe your ideal prospects..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isSearching) handleSearch();
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={[10, 20, 50, 100].includes(leadLimit) ? leadLimit : "custom"}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "custom") {
                        // Keep current value, focus will go to input
                      } else {
                        setLeadLimit(Number(val));
                      }
                    }}
                    className="px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value={10}>10 leads</option>
                    <option value={20}>20 leads</option>
                    <option value={50}>50 leads</option>
                    <option value={100}>100 leads</option>
                    <option value="custom">Custom...</option>
                  </select>
                  {![10, 20, 50, 100].includes(leadLimit) && (
                    <Input
                      type="number"
                      value={leadLimit}
                      onChange={(e) => setLeadLimit(Math.max(1, Number(e.target.value)))}
                      className="w-20"
                      min={1}
                      max={500}
                    />
                  )}
                </div>
                <Button onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {searchElapsed}s
                    </>
                  ) : (
                    "Search"
                  )}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="text-green-700 font-medium">Found {searchResults.length} usable leads</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {(searchMeta.duplicatesRemoved ?? 0) > 0 && (
                        <span>{searchMeta.duplicatesRemoved} duplicates removed</span>
                      )}
                      {(searchMeta.noContactRemoved ?? 0) > 0 && (
                        <span className="text-amber-600">{searchMeta.noContactRemoved} without contact info removed</span>
                      )}
                      {searchMeta.duration && (
                        <span>({searchMeta.duration})</span>
                      )}
                    </div>
                  </div>

                  {/* Lead Preview Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Title</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">School</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Contact</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {searchResults.map((lead, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-3 py-2">
                                <p className="font-medium text-gray-900">{lead.name || `${lead.firstName} ${lead.lastName}`}</p>
                              </td>
                              <td className="px-3 py-2 text-gray-600 max-w-[150px] truncate">
                                {lead.jobTitle || lead.title || "-"}
                              </td>
                              <td className="px-3 py-2">
                                <p className="text-gray-900 max-w-[150px] truncate">{lead.schoolName}</p>
                                {lead.location && (
                                  <p className="text-xs text-gray-500 truncate">{lead.location}</p>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-col gap-0.5">
                                  {(lead.email || lead.originalEmail) && (
                                    <span className="inline-flex items-center gap-1 text-xs text-green-700">
                                      <Mail className="h-3 w-3" />
                                      <span className="truncate max-w-[120px]">{lead.email || lead.originalEmail}</span>
                                    </span>
                                  )}
                                  {lead.linkedinUrl && (
                                    <span className="inline-flex items-center gap-1 text-xs text-blue-700">
                                      <Linkedin className="h-3 w-3" />
                                      LinkedIn
                                    </span>
                                  )}
                                  {lead.phone && (
                                    <span className="inline-flex items-center gap-1 text-xs text-purple-700">
                                      <Phone className="h-3 w-3" />
                                      <span className="truncate max-w-[100px]">{lead.phone}</span>
                                    </span>
                                  )}
                                  {!lead.email && !lead.originalEmail && !lead.linkedinUrl && !lead.phone && (
                                    <span className="text-xs text-amber-600">No contact info</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                {lead.confidence ? (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    lead.confidence >= 0.8 ? "bg-green-100 text-green-700" :
                                    lead.confidence >= 0.6 ? "bg-amber-100 text-amber-700" :
                                    "bg-gray-100 text-gray-600"
                                  }`}>
                                    {Math.round(lead.confidence * 100)}%
                                  </span>
                                ) : lead.leadScore ? (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    lead.leadScore >= 8 ? "bg-green-100 text-green-700" :
                                    lead.leadScore >= 6 ? "bg-amber-100 text-amber-700" :
                                    "bg-gray-100 text-gray-600"
                                  }`}>
                                    {lead.leadScore}/10
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Warning if leads without contact info */}
                  {searchResults.some(l => !l.email && !l.originalEmail && !l.linkedinUrl && !l.phone) && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                      <span className="text-sm text-amber-700">
                        Some leads have no contact information and may not be useful for outreach.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Manual Lead Entry */}
          {(leadMode === "manual" || leadMode === "mix") && (
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Add Leads Manually</h3>
                <span className="text-sm text-gray-500">{manualLeads.length} lead{manualLeads.length !== 1 ? 's' : ''} added</span>
              </div>

              {/* Add New Lead Form */}
              <div className="border rounded-lg p-4 mb-4 bg-gray-50">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">First Name *</label>
                    <Input
                      id="manual-firstName"
                      placeholder="John"
                      className="bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Last Name</label>
                    <Input
                      id="manual-lastName"
                      placeholder="Smith"
                      className="bg-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Email *</label>
                    <Input
                      id="manual-email"
                      type="email"
                      placeholder="john@school.edu"
                      className="bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Job Title</label>
                    <Input
                      id="manual-jobTitle"
                      placeholder="Head of Technology"
                      className="bg-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">School/Company *</label>
                    <Input
                      id="manual-schoolName"
                      placeholder="International School"
                      className="bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Phone</label>
                    <Input
                      id="manual-phone"
                      placeholder="+1 555-0123"
                      className="bg-white"
                    />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-xs text-gray-500 mb-1">LinkedIn URL</label>
                  <Input
                    id="manual-linkedin"
                    placeholder="https://linkedin.com/in/johnsmith"
                    className="bg-white"
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    const firstName = (document.getElementById('manual-firstName') as HTMLInputElement)?.value;
                    const lastName = (document.getElementById('manual-lastName') as HTMLInputElement)?.value;
                    const email = (document.getElementById('manual-email') as HTMLInputElement)?.value;
                    const jobTitle = (document.getElementById('manual-jobTitle') as HTMLInputElement)?.value;
                    const schoolName = (document.getElementById('manual-schoolName') as HTMLInputElement)?.value;
                    const phone = (document.getElementById('manual-phone') as HTMLInputElement)?.value;
                    const linkedinUrl = (document.getElementById('manual-linkedin') as HTMLInputElement)?.value;

                    if (!firstName || !email || !schoolName) {
                      setError('Please fill in First Name, Email, and School/Company');
                      return;
                    }

                    if (!email.includes('@')) {
                      setError('Please enter a valid email address');
                      return;
                    }

                    setManualLeads([...manualLeads, {
                      firstName,
                      lastName: lastName || '',
                      email,
                      jobTitle: jobTitle || 'Unknown',
                      schoolName,
                      phone: phone || null,
                      linkedinUrl: linkedinUrl || null,
                    }]);

                    // Clear form
                    (document.getElementById('manual-firstName') as HTMLInputElement).value = '';
                    (document.getElementById('manual-lastName') as HTMLInputElement).value = '';
                    (document.getElementById('manual-email') as HTMLInputElement).value = '';
                    (document.getElementById('manual-jobTitle') as HTMLInputElement).value = '';
                    (document.getElementById('manual-schoolName') as HTMLInputElement).value = '';
                    (document.getElementById('manual-phone') as HTMLInputElement).value = '';
                    (document.getElementById('manual-linkedin') as HTMLInputElement).value = '';
                    setError(null);
                  }}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Lead
                </Button>
              </div>

              {/* List of Added Leads */}
              {manualLeads.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Added Leads:</p>
                  {manualLeads.map((lead, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center text-blue-700 font-medium text-sm">
                          {lead.firstName[0]}{lead.lastName?.[0] || ''}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{lead.firstName} {lead.lastName}</p>
                          <p className="text-sm text-gray-500">{lead.email} • {lead.schoolName}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setManualLeads(manualLeads.filter((_, i) => i !== index))}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {getTotalLeads() > 0 && (
            <div className="bg-peach-50 rounded-lg p-4 flex items-center gap-3">
              <Zap className="h-5 w-5 text-peach-600" />
              <span className="font-medium text-peach-800">
                {getTotalLeads()} leads ready to import
              </span>
            </div>
          )}

          {leadMode && (
            <div className="flex items-center gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setLeadMode(null)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to import options
              </Button>
              <span className="text-sm text-gray-500">or continue with the buttons below</span>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Sequence Configuration */}
      {currentStep === "sequence" && (
        <div className="space-y-6">
          {/* Sequence Type Selection */}
          {!sequenceType && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                onClick={() => {
                  setSequenceType("ai");
                  // Initialize AI touchpoints when selecting AI sequence type
                  generateAiTouchpoints(aiCriteria.sequenceLength, aiCriteria.preferredChannels, schedulingSettings.defaultIntervalDays);
                }}
                className="bg-white rounded-xl border p-6 hover:border-purple-300 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Brain className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">AI-Generated Sequence</h3>
                    <p className="text-gray-500 text-sm">
                      AI determines the best touchpoints, channels, and cadence based on your leads
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Seniority-aware</span>
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Industry-optimized</span>
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Multi-channel</span>
                    </div>
                  </div>
                </div>
              </div>

              <div
                onClick={() => setSequenceType("manual")}
                className="bg-white rounded-xl border p-6 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Wand2 className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Manual Sequence</h3>
                    <p className="text-gray-500 text-sm">
                      Design your own sequence with full control over channels, timing, and templates
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Full control</span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Custom templates</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Sequence Configuration */}
          {sequenceType === "ai" && (
            <div className="space-y-6">
              {/* AI Sequence Settings Card */}
              <div className="bg-white rounded-xl border p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Settings2 className="h-5 w-5 text-gray-500" />
                    <h3 className="font-semibold text-gray-900">Sequence Settings</h3>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSequenceType(null)}>
                    <ArrowLeft className="h-3 w-3 mr-1" />
                    Back to options
                  </Button>
                </div>

                {/* Number of Touchpoints */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of touchpoints
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={aiCriteria.sequenceLength}
                      onChange={(e) => {
                        const newLength = Number(e.target.value);
                        setAiCriteria({ ...aiCriteria, sequenceLength: newLength });
                        generateAiTouchpoints(newLength, aiCriteria.preferredChannels, schedulingSettings.defaultIntervalDays);
                      }}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={aiCriteria.sequenceLength}
                      onChange={(e) => {
                        const newLength = Math.min(20, Math.max(1, Number(e.target.value)));
                        setAiCriteria({ ...aiCriteria, sequenceLength: newLength });
                        generateAiTouchpoints(newLength, aiCriteria.preferredChannels, schedulingSettings.defaultIntervalDays);
                      }}
                      className="w-20 text-center"
                      min={1}
                      max={20}
                    />
                    <span className="text-sm text-gray-500">touchpoints</span>
                  </div>
                </div>

                {/* Default Interval */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default interval between touchpoints
                  </label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      value={schedulingSettings.defaultIntervalDays}
                      onChange={(e) => {
                        const interval = Math.max(1, Number(e.target.value));
                        setSchedulingSettings({ ...schedulingSettings, defaultIntervalDays: interval });
                        // Update AI touchpoints with new interval
                        setAiTouchpoints(aiTouchpoints.map((t, i) => ({
                          ...t,
                          delayDays: i * interval,
                        })));
                      }}
                      className="w-20 text-center"
                      min={1}
                    />
                    <span className="text-sm text-gray-500">days between each step</span>
                  </div>
                </div>

                {/* Timezone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Globe className="h-4 w-4 inline mr-1" />
                    Timezone
                  </label>
                  <select
                    value={schedulingSettings.timezone}
                    onChange={(e) => setSchedulingSettings({ ...schedulingSettings, timezone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="Asia/Kolkata">India (IST)</option>
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="Europe/London">London (GMT/BST)</option>
                    <option value="Europe/Paris">Central Europe (CET)</option>
                    <option value="Asia/Singapore">Singapore (SGT)</option>
                    <option value="Asia/Tokyo">Japan (JST)</option>
                    <option value="Australia/Sydney">Sydney (AEST)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>

                {/* Sending Days */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    Send on these days
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "monday", label: "Mon" },
                      { key: "tuesday", label: "Tue" },
                      { key: "wednesday", label: "Wed" },
                      { key: "thursday", label: "Thu" },
                      { key: "friday", label: "Fri" },
                      { key: "saturday", label: "Sat" },
                      { key: "sunday", label: "Sun" },
                    ].map((day) => (
                      <button
                        key={day.key}
                        onClick={() => {
                          const isSelected = schedulingSettings.sendingDays.includes(day.key);
                          setSchedulingSettings({
                            ...schedulingSettings,
                            sendingDays: isSelected
                              ? schedulingSettings.sendingDays.filter((d) => d !== day.key)
                              : [...schedulingSettings.sendingDays, day.key],
                          });
                        }}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          schedulingSettings.sendingDays.includes(day.key)
                            ? "bg-violet-100 border-violet-300 text-violet-700"
                            : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sending Time Window */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="h-4 w-4 inline mr-1" />
                    Sending time window
                  </label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="time"
                      value={schedulingSettings.sendingTimeStart}
                      onChange={(e) => setSchedulingSettings({ ...schedulingSettings, sendingTimeStart: e.target.value })}
                      className="w-32"
                    />
                    <span className="text-gray-500">to</span>
                    <Input
                      type="time"
                      value={schedulingSettings.sendingTimeEnd}
                      onChange={(e) => setSchedulingSettings({ ...schedulingSettings, sendingTimeEnd: e.target.value })}
                      className="w-32"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Emails will be sent randomly within this window</p>
                </div>
              </div>

              {/* AI Generation Settings Card */}
              <div className="bg-white rounded-xl border p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <Brain className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-900">AI Generation Settings</h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    AI should consider:
                  </label>
                  <div className="space-y-2">
                    {[
                      { key: "considerSeniority", label: "Job seniority level", desc: "C-suite gets different approach than managers" },
                      { key: "considerIndustry", label: "Industry/school type", desc: "Tailor messaging to institution type" },
                      { key: "considerEngagement", label: "Engagement signals", desc: "Adjust based on opens, clicks, replies" },
                    ].map((item) => (
                      <label key={item.key} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={aiCriteria[item.key as keyof typeof aiCriteria] as boolean}
                          onChange={(e) => setAiCriteria({ ...aiCriteria, [item.key]: e.target.checked })}
                          className="mt-0.5"
                        />
                        <div>
                          <p className="font-medium text-gray-900">{item.label}</p>
                          <p className="text-sm text-gray-500">{item.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Preferred channels:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(channelLabels).map(([key, label]) => {
                      const Icon = channelIcons[key];
                      const isSelected = aiCriteria.preferredChannels.includes(key);
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            const newChannels = isSelected
                              ? aiCriteria.preferredChannels.filter((c) => c !== key)
                              : [...aiCriteria.preferredChannels, key];
                            setAiCriteria({
                              ...aiCriteria,
                              preferredChannels: newChannels,
                            });
                            // Regenerate touchpoints with new channels
                            if (newChannels.length > 0) {
                              generateAiTouchpoints(aiCriteria.sequenceLength, newChannels, schedulingSettings.defaultIntervalDays);
                            }
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                            isSelected
                              ? "bg-peach-50 border-peach-300 text-peach-700"
                              : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

              {/* Email Tone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Tone
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: "professional", label: "Professional", desc: "Business-like, respectful" },
                    { value: "casual", label: "Casual", desc: "Relaxed, conversational" },
                    { value: "friendly", label: "Friendly", desc: "Warm, personable" },
                    { value: "formal", label: "Formal", desc: "Traditional, reserved" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setAiCriteria({ ...aiCriteria, tone: option.value as typeof aiCriteria.tone })}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        aiCriteria.tone === option.value
                          ? "bg-peach-50 border-peach-300 text-peach-700"
                          : "bg-white border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <p className="font-medium text-sm">{option.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{option.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Email Length */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Length
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "short", label: "Short", desc: "Under 75 words" },
                    { value: "medium", label: "Medium", desc: "75-125 words" },
                    { value: "long", label: "Long", desc: "125-200 words" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setAiCriteria({ ...aiCriteria, emailLength: option.value as typeof aiCriteria.emailLength })}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        aiCriteria.emailLength === option.value
                          ? "bg-peach-50 border-peach-300 text-peach-700"
                          : "bg-white border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <p className="font-medium text-sm">{option.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{option.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Personalization Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personalization Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "low", label: "Low", desc: "Generic templates" },
                    { value: "medium", label: "Medium", desc: "Name + company" },
                    { value: "high", label: "High", desc: "Deep research-based" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setAiCriteria({ ...aiCriteria, personalizationLevel: option.value as typeof aiCriteria.personalizationLevel })}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        aiCriteria.personalizationLevel === option.value
                          ? "bg-purple-50 border-purple-300 text-purple-700"
                          : "bg-white border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <p className="font-medium text-sm">{option.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{option.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Email Goal / Call to Action */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Goal
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  What action do you want the prospect to take after reading your emails?
                </p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {[
                    { value: "meeting", label: "📅 Book a Meeting", desc: "Get them to schedule a demo or call" },
                    { value: "reply", label: "💬 Get a Reply", desc: "Start a conversation, learn about their needs" },
                    { value: "link", label: "🔗 Click a Link", desc: "Drive traffic to a landing page or resource" },
                    { value: "custom", label: "✏️ Custom Goal", desc: "Define your own specific objective" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setAiCriteria({ ...aiCriteria, callToAction: option.value as typeof aiCriteria.callToAction })}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        aiCriteria.callToAction === option.value
                          ? "bg-green-50 border-green-300 text-green-700"
                          : "bg-white border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <p className="font-medium text-sm">{option.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{option.desc}</p>
                    </button>
                  ))}
                </div>
                {aiCriteria.callToAction === "custom" && (
                  <div className="mt-3">
                    <label className="block text-xs text-gray-500 mb-1">What's your goal?</label>
                    <Input
                      value={aiCriteria.customCTA}
                      onChange={(e) => setAiCriteria({ ...aiCriteria, customCTA: e.target.value })}
                      placeholder="e.g., Get them to try our free pilot program, Request a case study..."
                    />
                  </div>
                )}
              </div>

              {/* Additional Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Instructions (optional)
                </label>
                <textarea
                  value={aiCriteria.notes}
                  onChange={(e) => setAiCriteria({ ...aiCriteria, notes: e.target.value })}
                  placeholder="Any specific instructions for AI generation... e.g., mention specific pain points, avoid certain topics, etc."
                  className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                  rows={3}
                />
              </div>
              </div>

              {/* AI Touchpoints Preview Card */}
              <div className="bg-white rounded-xl border p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    <h3 className="font-semibold text-gray-900">Touchpoints Preview ({aiTouchpoints.length})</h3>
                  </div>
                  <p className="text-sm text-gray-500">
                    Total duration: {aiTouchpoints.length > 0 ? aiTouchpoints[aiTouchpoints.length - 1].delayDays : 0} days
                  </p>
                </div>

                {aiTouchpoints.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Sparkles className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">Adjust the sequence length above to see touchpoints</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {aiTouchpoints.map((touchpoint, index) => {
                      const Icon = channelIcons[touchpoint.channel] || Mail;
                      return (
                        <div key={touchpoint.id} className="border rounded-lg p-4 bg-purple-50/50">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-semibold text-sm">
                              {index + 1}
                            </div>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-purple-600" />
                              <select
                                value={touchpoint.channel}
                                onChange={(e) => updateAiTouchpoint(touchpoint.id, { channel: e.target.value })}
                                className="px-2 py-1 border rounded text-sm bg-white"
                              >
                                {Object.entries(channelLabels).map(([key, label]) => (
                                  <option key={key} value={key}>{label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center gap-2 ml-auto">
                              <Clock className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-500">Day</span>
                              <Input
                                type="number"
                                value={touchpoint.delayDays}
                                onChange={(e) => updateAiTouchpoint(touchpoint.id, { delayDays: Math.max(0, Number(e.target.value)) })}
                                className="w-16 text-center"
                                min={0}
                              />
                              {index > 0 && (
                                <span className="text-xs text-gray-400">
                                  (+{touchpoint.delayDays - aiTouchpoints[index - 1].delayDays}d from prev)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* AI Instructions for this touchpoint */}
                          <div className="mt-3 pt-3 border-t border-purple-100">
                            <div className="flex items-start gap-2">
                              <Brain className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-xs text-purple-600 mb-1">AI-generated content • Optional instructions:</p>
                                <Input
                                  placeholder="e.g., Focus on their curriculum, be more casual, mention case study..."
                                  value={touchpoint.aiInstructions || ""}
                                  onChange={(e) => updateAiTouchpoint(touchpoint.id, { aiInstructions: e.target.value })}
                                  className="text-sm bg-white"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-purple-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-purple-700 font-medium">AI will personalize each touchpoint</p>
                      <p className="text-xs text-purple-600 mt-0.5">
                        Content will be generated based on each lead's data, your tone/length preferences, and any per-touchpoint instructions
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Manual Sequence Builder */}
          {sequenceType === "manual" && (
            <div className="space-y-6">
              {/* Sequence Settings Card */}
              <div className="bg-white rounded-xl border p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Settings2 className="h-5 w-5 text-gray-500" />
                    <h3 className="font-semibold text-gray-900">Sequence Settings</h3>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSequenceType(null)}>
                    <ArrowLeft className="h-3 w-3 mr-1" />
                    Back to options
                  </Button>
                </div>

                {/* Number of Touchpoints */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of touchpoints
                  </label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      value={touchpoints.length}
                      onChange={(e) => {
                        const count = Math.min(20, Math.max(1, Number(e.target.value)));
                        generateTouchpoints(count);
                      }}
                      className="w-20 text-center"
                      min={1}
                      max={20}
                    />
                    <span className="text-sm text-gray-500">touchpoints in this sequence</span>
                  </div>
                </div>

                {/* Default Interval */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default interval between touchpoints
                  </label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      value={schedulingSettings.defaultIntervalDays}
                      onChange={(e) => {
                        const interval = Math.max(1, Number(e.target.value));
                        setSchedulingSettings({ ...schedulingSettings, defaultIntervalDays: interval });
                        // Update existing touchpoints with new interval
                        setTouchpoints(touchpoints.map((t, i) => ({
                          ...t,
                          delayDays: i * interval,
                        })));
                      }}
                      className="w-20 text-center"
                      min={1}
                    />
                    <span className="text-sm text-gray-500">days between each step</span>
                  </div>
                </div>

                {/* Timezone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Globe className="h-4 w-4 inline mr-1" />
                    Timezone
                  </label>
                  <select
                    value={schedulingSettings.timezone}
                    onChange={(e) => setSchedulingSettings({ ...schedulingSettings, timezone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="Asia/Kolkata">India (IST)</option>
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="Europe/London">London (GMT/BST)</option>
                    <option value="Europe/Paris">Central Europe (CET)</option>
                    <option value="Asia/Singapore">Singapore (SGT)</option>
                    <option value="Asia/Tokyo">Japan (JST)</option>
                    <option value="Australia/Sydney">Sydney (AEST)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>

                {/* Sending Days */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    Send on these days
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "monday", label: "Mon" },
                      { key: "tuesday", label: "Tue" },
                      { key: "wednesday", label: "Wed" },
                      { key: "thursday", label: "Thu" },
                      { key: "friday", label: "Fri" },
                      { key: "saturday", label: "Sat" },
                      { key: "sunday", label: "Sun" },
                    ].map((day) => (
                      <button
                        key={day.key}
                        onClick={() => {
                          const isSelected = schedulingSettings.sendingDays.includes(day.key);
                          setSchedulingSettings({
                            ...schedulingSettings,
                            sendingDays: isSelected
                              ? schedulingSettings.sendingDays.filter((d) => d !== day.key)
                              : [...schedulingSettings.sendingDays, day.key],
                          });
                        }}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          schedulingSettings.sendingDays.includes(day.key)
                            ? "bg-violet-100 border-violet-300 text-violet-700"
                            : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sending Time Window */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="h-4 w-4 inline mr-1" />
                    Sending time window
                  </label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="time"
                      value={schedulingSettings.sendingTimeStart}
                      onChange={(e) => setSchedulingSettings({ ...schedulingSettings, sendingTimeStart: e.target.value })}
                      className="w-32"
                    />
                    <span className="text-gray-500">to</span>
                    <Input
                      type="time"
                      value={schedulingSettings.sendingTimeEnd}
                      onChange={(e) => setSchedulingSettings({ ...schedulingSettings, sendingTimeEnd: e.target.value })}
                      className="w-32"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Emails will be sent randomly within this window</p>
                </div>
              </div>

              {/* Touchpoints Builder Card */}
              <div className="bg-white rounded-xl border p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Touchpoints ({touchpoints.length})</h3>
                  <p className="text-sm text-gray-500">
                    Total duration: {touchpoints.length > 0 ? touchpoints[touchpoints.length - 1].delayDays : 0} days
                  </p>
                </div>

              <div className="space-y-4">
                {touchpoints.map((touchpoint, index) => (
                  <div key={touchpoint.id} className="border rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-peach-100 text-peach-700 font-semibold text-sm">
                        {index + 1}
                      </div>
                      <select
                        value={touchpoint.channel}
                        onChange={(e) => updateTouchpoint(touchpoint.id, { channel: e.target.value })}
                        className="px-3 py-2 border rounded-lg text-sm"
                      >
                        {Object.entries(channelLabels).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2 ml-auto">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-500">Day</span>
                        <Input
                          type="number"
                          value={touchpoint.delayDays}
                          onChange={(e) => updateTouchpoint(touchpoint.id, { delayDays: Math.max(0, Number(e.target.value)) })}
                          className="w-16 text-center"
                          min={0}
                        />
                        {index > 0 && (
                          <span className="text-xs text-gray-400">
                            (+{touchpoint.delayDays - touchpoints[index - 1].delayDays}d from prev)
                          </span>
                        )}
                      </div>
                      {touchpoints.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTouchpoint(touchpoint.id)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* Content Mode Toggle */}
                    <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded-lg">
                      <span className="text-xs text-gray-500 mr-2">Content:</span>
                      <button
                        onClick={() => updateTouchpoint(touchpoint.id, { contentMode: "manual", aiInstructions: "" })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          touchpoint.contentMode === "manual"
                            ? "bg-blue-100 text-blue-700 border border-blue-200"
                            : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        <Wand2 className="h-3 w-3" />
                        Write Manually
                      </button>
                      <button
                        onClick={() => updateTouchpoint(touchpoint.id, { contentMode: "ai", subject: "", body: "" })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          touchpoint.contentMode === "ai"
                            ? "bg-purple-100 text-purple-700 border border-purple-200"
                            : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        <Brain className="h-3 w-3" />
                        AI Generated
                      </button>
                    </div>

                    {/* AI Instructions Mode */}
                    {touchpoint.contentMode === "ai" && (
                      <div className="space-y-3">
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <Sparkles className="h-4 w-4 text-purple-600 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm text-purple-700 font-medium">AI will generate personalized content</p>
                              <p className="text-xs text-purple-600 mt-0.5">Content will be generated based on each lead's data when the campaign runs</p>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Instructions for AI (optional)</label>
                          <textarea
                            placeholder="e.g., Focus on their curriculum, mention recent news about their school, keep it casual..."
                            value={touchpoint.aiInstructions || ""}
                            onChange={(e) => updateTouchpoint(touchpoint.id, { aiInstructions: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                            rows={2}
                          />
                        </div>
                      </div>
                    )}

                    {/* Manual Content Mode */}
                    {touchpoint.contentMode === "manual" && touchpoint.channel === "email" && (
                      <div className="space-y-3">
                        <Input
                          placeholder="Subject line..."
                          value={touchpoint.subject || ""}
                          onChange={(e) => updateTouchpoint(touchpoint.id, { subject: e.target.value })}
                        />
                        <textarea
                          placeholder="Email body template... Use {{firstName}}, {{schoolName}} for personalization"
                          value={touchpoint.body || ""}
                          onChange={(e) => updateTouchpoint(touchpoint.id, { body: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                          rows={4}
                        />
                      </div>
                    )}

                    {touchpoint.contentMode === "manual" && (touchpoint.channel === "linkedin_message" || touchpoint.channel === "linkedin_connection") && (
                      <textarea
                        placeholder="LinkedIn message template..."
                        value={touchpoint.body || ""}
                        onChange={(e) => updateTouchpoint(touchpoint.id, { body: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                        rows={3}
                      />
                    )}

                    {touchpoint.contentMode === "manual" && touchpoint.channel === "phone_call" && (
                      <textarea
                        placeholder="Talking points for the call..."
                        value={touchpoint.body || ""}
                        onChange={(e) => updateTouchpoint(touchpoint.id, { body: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                        rows={3}
                      />
                    )}

                    {touchpoint.contentMode === "manual" && (touchpoint.channel === "sms" || touchpoint.channel === "whatsapp") && (
                      <textarea
                        placeholder={`${touchpoint.channel === "sms" ? "SMS" : "WhatsApp"} message...`}
                        value={touchpoint.body || ""}
                        onChange={(e) => updateTouchpoint(touchpoint.id, { body: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                        rows={2}
                      />
                    )}
                  </div>
                ))}
              </div>

              <Button variant="outline" onClick={addTouchpoint} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Touchpoint
              </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Review */}
      {currentStep === "review" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Campaign Summary</h3>

            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">Campaign Name</span>
                <span className="font-medium">{campaignName}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">Leads</span>
                <span className="font-medium">{getTotalLeads()} leads</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">Lead Source</span>
                <span className="font-medium capitalize">{leadMode}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">Sequence Type</span>
                <span className="font-medium capitalize">{sequenceType}</span>
              </div>
              {sequenceType === "manual" && (
                <>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-500">Touchpoints</span>
                    <span className="font-medium">{touchpoints.length} steps</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-500">AI-Generated Content</span>
                    <span className="font-medium">
                      {touchpoints.filter(t => t.contentMode === "ai").length} of {touchpoints.length} touchpoints
                    </span>
                  </div>
                </>
              )}
              {sequenceType === "ai" && (
                <>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-500">Touchpoints</span>
                    <span className="font-medium">{aiTouchpoints.length} steps</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-500">Total Duration</span>
                    <span className="font-medium">
                      {aiTouchpoints.length > 0 ? aiTouchpoints[aiTouchpoints.length - 1].delayDays : 0} days
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-500">Channels</span>
                    <span className="font-medium">
                      {aiCriteria.preferredChannels.map((c) => channelLabels[c]).join(", ")}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-500">Timezone</span>
                    <span className="font-medium">{schedulingSettings.timezone}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-500">Sending Days</span>
                    <span className="font-medium capitalize">
                      {schedulingSettings.sendingDays.length === 7
                        ? "All days"
                        : schedulingSettings.sendingDays.map(d => d.slice(0, 3)).join(", ")}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-500">Sending Window</span>
                    <span className="font-medium">
                      {schedulingSettings.sendingTimeStart} - {schedulingSettings.sendingTimeEnd}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {sequenceType === "ai" && (
            <div className="space-y-4">
              {/* Touchpoints Preview */}
              {aiTouchpoints.length > 0 && (
                <div className="bg-white rounded-xl border p-4">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    Touchpoints Timeline
                  </h4>
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {aiTouchpoints.map((tp, idx) => {
                      const Icon = channelIcons[tp.channel] || Mail;
                      return (
                        <div key={tp.id} className="flex items-center">
                          <div className="flex flex-col items-center">
                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                              <Icon className="h-5 w-5 text-purple-600" />
                            </div>
                            <span className="text-xs text-gray-500 mt-1">Day {tp.delayDays}</span>
                          </div>
                          {idx < aiTouchpoints.length - 1 && (
                            <div className="w-8 h-0.5 bg-purple-200 mx-1" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Brain className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-purple-800">AI will generate personalized content for each touchpoint</p>
                    <p className="text-sm text-purple-600">
                      Based on lead data, your {aiCriteria.tone} tone preference, and {aiCriteria.emailLength} length setting
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {sequenceType === "manual" && touchpoints.some(t => t.contentMode === "ai") && (
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Brain className="h-5 w-5 text-purple-600 mt-0.5" />
                <div>
                  <p className="font-medium text-purple-800">
                    {touchpoints.filter(t => t.contentMode === "ai").length} touchpoint{touchpoints.filter(t => t.contentMode === "ai").length !== 1 ? 's' : ''} will have AI-generated content
                  </p>
                  <p className="text-sm text-purple-600">
                    AI will personalize content for each lead based on their data when sending
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg mt-6">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-6 border-t">
        {currentStep === "name" ? (
          <Button variant="outline" onClick={() => router.push("/campaigns")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        ) : (
          <Button variant="outline" onClick={prevStep}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        )}

        {currentStep !== "review" ? (
          <Button onClick={nextStep} disabled={!canProceed()}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleCreateCampaign} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Create Campaign
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
