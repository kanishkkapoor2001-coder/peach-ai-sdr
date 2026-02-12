"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Globe,
  Sparkles,
  Target,
  Zap,
  FileText,
  Upload,
  Check,
  AlertCircle,
  Loader2,
  Plus,
  X,
  RefreshCw,
} from "lucide-react";

interface ValueProposition {
  title: string;
  description: string;
  targetAudience?: string;
  source: "ai_discovered" | "user_provided";
}

interface TargetMarket {
  segment: string;
  description: string;
  priority: "high" | "medium" | "low";
}

interface CompanyContext {
  id: string;
  companyName: string;
  companyWebsite?: string;
  companyDescription?: string;
  industry?: string;
  valuePropositions: ValueProposition[];
  targetMarkets: TargetMarket[];
  painPoints: string[];
  differentiators: string[];
  emailTone?: string;
  senderName?: string;
  senderTitle?: string;
  signatureBlock?: string;
  websiteScrapedAt?: string;
  aiInsights?: {
    summary: string;
    keyFeatures: string[];
    competitiveAdvantages: string[];
    idealCustomerProfile: string;
    generatedAt: string;
  };
}

export default function CompanySetupPage() {
  const [company, setCompany] = useState<CompanyContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    companyName: "",
    companyWebsite: "",
    companyDescription: "",
    industry: "",
    emailTone: "professional",
    senderName: "",
    senderTitle: "",
    signatureBlock: "",
  });

  const [valuePropositions, setValuePropositions] = useState<ValueProposition[]>([]);
  const [targetMarkets, setTargetMarkets] = useState<TargetMarket[]>([]);
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [differentiators, setDifferentiators] = useState<string[]>([]);

  // Load existing company context
  useEffect(() => {
    fetchCompany();
  }, []);

  const fetchCompany = async () => {
    try {
      const response = await fetch("/api/company");
      const data = await response.json();

      if (data.company) {
        setCompany(data.company);
        setFormData({
          companyName: data.company.companyName || "",
          companyWebsite: data.company.companyWebsite || "",
          companyDescription: data.company.companyDescription || "",
          industry: data.company.industry || "",
          emailTone: data.company.emailTone || "professional",
          senderName: data.company.senderName || "",
          senderTitle: data.company.senderTitle || "",
          signatureBlock: data.company.signatureBlock || "",
        });
        setValuePropositions(data.company.valuePropositions || []);
        setTargetMarkets(data.company.targetMarkets || []);
        setPainPoints(data.company.painPoints || []);
        setDifferentiators(data.company.differentiators || []);
      }
    } catch (error) {
      console.error("Failed to fetch company:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.companyName) {
      setMessage({ type: "error", text: "Company name is required" });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const payload = {
        ...(company?.id ? { id: company.id } : {}),
        ...formData,
        valuePropositions,
        targetMarkets,
        painPoints,
        differentiators,
      };

      const response = await fetch("/api/company", {
        method: company?.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save");
      }

      setCompany(data.company);
      setMessage({ type: "success", text: "Company settings saved!" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Save failed" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnalyzeWebsite = async () => {
    if (!formData.companyWebsite) {
      setMessage({ type: "error", text: "Please enter a website URL first" });
      return;
    }

    setIsAnalyzing(true);
    setMessage(null);

    try {
      const response = await fetch("/api/company/analyze-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl: formData.companyWebsite,
          companyId: company?.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      // Update form with discovered data
      if (data.analysis) {
        setFormData(prev => ({
          ...prev,
          companyDescription: data.analysis.summary || prev.companyDescription,
        }));

        // Add AI-discovered value props
        const aiValueProps = (data.analysis.valuePropositions || []).map((vp: Omit<ValueProposition, 'source'>) => ({
          ...vp,
          source: "ai_discovered" as const,
        }));
        setValuePropositions(prev => [
          ...prev.filter(vp => vp.source === "user_provided"),
          ...aiValueProps,
        ]);

        setTargetMarkets(data.analysis.targetMarkets || []);
        setPainPoints(data.analysis.painPoints || []);
        setDifferentiators(data.analysis.differentiators || []);
      }

      setMessage({ type: "success", text: "Website analyzed! Review the discovered insights below." });

      // Refresh company data
      fetchCompany();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Analysis failed" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const addValueProposition = () => {
    setValuePropositions([
      ...valuePropositions,
      { title: "", description: "", targetAudience: "", source: "user_provided" },
    ]);
  };

  const removeValueProposition = (index: number) => {
    setValuePropositions(valuePropositions.filter((_, i) => i !== index));
  };

  const updateValueProposition = (index: number, field: keyof ValueProposition, value: string) => {
    setValuePropositions(valuePropositions.map((vp, i) =>
      i === index ? { ...vp, [field]: value } : vp
    ));
  };

  const addTargetMarket = () => {
    setTargetMarkets([
      ...targetMarkets,
      { segment: "", description: "", priority: "medium" },
    ]);
  };

  const removeTargetMarket = (index: number) => {
    setTargetMarkets(targetMarkets.filter((_, i) => i !== index));
  };

  const updateTargetMarket = (index: number, field: keyof TargetMarket, value: string) => {
    setTargetMarkets(targetMarkets.map((tm, i) =>
      i === index ? { ...tm, [field]: value } : tm
    ));
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Company Setup</h1>
        <p className="text-gray-500 mt-1">
          Configure your company context for personalized email generation
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
            message.type === "success"
              ? "bg-green-50 border border-green-200"
              : "bg-red-50 border border-red-200"
          }`}
        >
          {message.type === "success" ? (
            <Check className="h-5 w-5 text-green-600 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          )}
          <p className={message.type === "success" ? "text-green-800" : "text-red-800"}>
            {message.text}
          </p>
        </div>
      )}

      {/* Basic Info */}
      <div className="bg-white rounded-xl border p-6 shadow-sm mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Building2 className="h-5 w-5 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name *
            </label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              placeholder="Acme Inc."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.companyWebsite}
                  onChange={(e) => setFormData({ ...formData, companyWebsite: e.target.value })}
                  placeholder="https://example.com"
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Button
                  onClick={handleAnalyzeWebsite}
                  disabled={isAnalyzing || !formData.companyWebsite}
                  variant="outline"
                  className="whitespace-nowrap"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Auto-Discover
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Click &quot;Auto-Discover&quot; to automatically extract value propositions from your website
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Description
            </label>
            <textarea
              value={formData.companyDescription}
              onChange={(e) => setFormData({ ...formData, companyDescription: e.target.value })}
              placeholder="Brief description of what your company does..."
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Industry
            </label>
            <input
              type="text"
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              placeholder="e.g., EdTech, SaaS, Healthcare"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Value Propositions */}
      <div className="bg-white rounded-xl border p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Zap className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Value Propositions</h2>
              <p className="text-sm text-gray-500">What makes your product valuable</p>
            </div>
          </div>
          <Button onClick={addValueProposition} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

        {valuePropositions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No value propositions yet.</p>
            <p className="text-sm">Use &quot;Auto-Discover&quot; or add manually.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {valuePropositions.map((vp, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  vp.source === "ai_discovered" ? "bg-purple-50 border-purple-200" : "bg-gray-50"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    vp.source === "ai_discovered"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-gray-200 text-gray-600"
                  }`}>
                    {vp.source === "ai_discovered" ? "AI Discovered" : "Manual"}
                  </span>
                  <button
                    onClick={() => removeValueProposition(index)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={vp.title}
                    onChange={(e) => updateValueProposition(index, "title", e.target.value)}
                    placeholder="Value prop title"
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  />
                  <textarea
                    value={vp.description}
                    onChange={(e) => updateValueProposition(index, "description", e.target.value)}
                    placeholder="Description..."
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  />
                  <input
                    type="text"
                    value={vp.targetAudience || ""}
                    onChange={(e) => updateValueProposition(index, "targetAudience", e.target.value)}
                    placeholder="Target audience (optional)"
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Target Markets */}
      <div className="bg-white rounded-xl border p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <Target className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Target Markets</h2>
              <p className="text-sm text-gray-500">Who you&apos;re selling to</p>
            </div>
          </div>
          <Button onClick={addTargetMarket} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

        {targetMarkets.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No target markets defined yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {targetMarkets.map((tm, index) => (
              <div key={index} className="p-4 rounded-lg border bg-gray-50">
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => removeTargetMarket(index)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tm.segment}
                      onChange={(e) => updateTargetMarket(index, "segment", e.target.value)}
                      placeholder="Market segment"
                      className="flex-1 px-3 py-2 border rounded-lg text-sm bg-white"
                    />
                    <select
                      value={tm.priority}
                      onChange={(e) => updateTargetMarket(index, "priority", e.target.value)}
                      className="px-3 py-2 border rounded-lg text-sm bg-white"
                    >
                      <option value="high">High Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="low">Low Priority</option>
                    </select>
                  </div>
                  <textarea
                    value={tm.description}
                    onChange={(e) => updateTargetMarket(index, "description", e.target.value)}
                    placeholder="Description..."
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pain Points & Differentiators */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3">Pain Points Solved</h3>
          <div className="space-y-2">
            {painPoints.map((point, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={point}
                  onChange={(e) => {
                    const updated = [...painPoints];
                    updated[index] = e.target.value;
                    setPainPoints(updated);
                  }}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm"
                />
                <button
                  onClick={() => setPainPoints(painPoints.filter((_, i) => i !== index))}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              onClick={() => setPainPoints([...painPoints, ""])}
              variant="ghost"
              size="sm"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Pain Point
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3">Key Differentiators</h3>
          <div className="space-y-2">
            {differentiators.map((diff, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={diff}
                  onChange={(e) => {
                    const updated = [...differentiators];
                    updated[index] = e.target.value;
                    setDifferentiators(updated);
                  }}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm"
                />
                <button
                  onClick={() => setDifferentiators(differentiators.filter((_, i) => i !== index))}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              onClick={() => setDifferentiators([...differentiators, ""])}
              variant="ghost"
              size="sm"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Differentiator
            </Button>
          </div>
        </div>
      </div>

      {/* Email Settings */}
      <div className="bg-white rounded-xl border p-6 shadow-sm mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-orange-50 rounded-lg">
            <FileText className="h-5 w-5 text-orange-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Email Settings</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Tone
            </label>
            <select
              value={formData.emailTone}
              onChange={(e) => setFormData({ ...formData, emailTone: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="friendly">Friendly</option>
              <option value="formal">Formal</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sender Name
            </label>
            <input
              type="text"
              value={formData.senderName}
              onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
              placeholder="John Smith"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sender Title
            </label>
            <input
              type="text"
              value={formData.senderTitle}
              onChange={(e) => setFormData({ ...formData, senderTitle: e.target.value })}
              placeholder="Sales Manager"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Signature Block
            </label>
            <textarea
              value={formData.signatureBlock}
              onChange={(e) => setFormData({ ...formData, signatureBlock: e.target.value })}
              placeholder="Best regards,\nJohn Smith\nSales Manager | Acme Inc."
              rows={3}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Save Company Settings
            </>
          )}
        </Button>
      </div>

      {/* AI Insights (if available) */}
      {company?.aiInsights && (
        <div className="mt-8 bg-purple-50 rounded-xl border border-purple-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-purple-900">AI Insights</h2>
            <span className="text-xs text-purple-600">
              Generated {new Date(company.aiInsights.generatedAt).toLocaleDateString()}
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-purple-900 mb-1">Ideal Customer Profile</h3>
              <p className="text-sm text-purple-800">{company.aiInsights.idealCustomerProfile}</p>
            </div>

            {company.aiInsights.keyFeatures.length > 0 && (
              <div>
                <h3 className="font-medium text-purple-900 mb-1">Key Features</h3>
                <div className="flex flex-wrap gap-2">
                  {company.aiInsights.keyFeatures.map((feature, i) => (
                    <span key={i} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm">
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
