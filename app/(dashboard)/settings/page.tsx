"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Save,
  RefreshCw,
  FileText,
  Sparkles,
  BookOpen,
  Target,
  AlertCircle,
  Check,
} from "lucide-react";

// Default content from the prompt files
import { SKILL_PROMPT } from "@/lib/prompts/skill";
import { PEACH_OVERVIEW } from "@/lib/prompts/peach-overview";
import { VALUE_PROPOSITIONS } from "@/lib/prompts/value-propositions";

type TabId = "skill" | "overview" | "angles";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const TABS: Tab[] = [
  {
    id: "skill",
    label: "Email Skill",
    icon: <Sparkles className="h-4 w-4" />,
    description: "How AI writes email sequences (workflow, structure, rules)",
  },
  {
    id: "overview",
    label: "Product Overview",
    icon: <BookOpen className="h-4 w-4" />,
    description: "What your product does (for accurate email claims)",
  },
  {
    id: "angles",
    label: "Value Propositions",
    icon: <Target className="h-4 w-4" />,
    description: "Angles/hooks to use in emails based on research",
  },
];

const STORAGE_KEYS = {
  skill: "peach-sdr-skill-prompt",
  overview: "peach-sdr-overview",
  angles: "peach-sdr-angles",
};

const DEFAULTS = {
  skill: SKILL_PROMPT,
  overview: PEACH_OVERVIEW,
  angles: VALUE_PROPOSITIONS,
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("skill");
  const [content, setContent] = useState<Record<TabId, string>>({
    skill: "",
    overview: "",
    angles: "",
  });
  const [hasChanges, setHasChanges] = useState<Record<TabId, boolean>>({
    skill: false,
    overview: false,
    angles: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const loaded: Record<TabId, string> = {
      skill: "",
      overview: "",
      angles: "",
    };

    for (const tab of TABS) {
      const stored = localStorage.getItem(STORAGE_KEYS[tab.id]);
      loaded[tab.id] = stored || DEFAULTS[tab.id];
    }

    setContent(loaded);
  }, []);

  // Handle content change
  const handleChange = (value: string) => {
    setContent((prev) => ({ ...prev, [activeTab]: value }));
    setHasChanges((prev) => ({
      ...prev,
      [activeTab]: value !== DEFAULTS[activeTab],
    }));
    setSaved(false);
  };

  // Save to localStorage
  const handleSave = async () => {
    setSaving(true);

    // Save to localStorage
    for (const tab of TABS) {
      if (content[tab.id] !== DEFAULTS[tab.id]) {
        localStorage.setItem(STORAGE_KEYS[tab.id], content[tab.id]);
      } else {
        localStorage.removeItem(STORAGE_KEYS[tab.id]);
      }
    }

    // Also save to API for server-side use
    try {
      await fetch("/api/settings/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
    } catch (error) {
      console.error("Failed to save to server:", error);
    }

    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 500);
  };

  // Reset to default
  const handleReset = () => {
    if (confirm(`Reset "${TABS.find((t) => t.id === activeTab)?.label}" to default?`)) {
      setContent((prev) => ({ ...prev, [activeTab]: DEFAULTS[activeTab] }));
      setHasChanges((prev) => ({ ...prev, [activeTab]: false }));
      localStorage.removeItem(STORAGE_KEYS[activeTab]);
    }
  };

  const currentTab = TABS.find((t) => t.id === activeTab)!;
  const anyChanges = Object.values(hasChanges).some(Boolean);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Email Generation Settings</h1>
        <p className="text-gray-500 mt-1">
          Customize how AI generates cold email sequences. These prompts define your product,
          value propositions, and email writing style.
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">How this works</p>
          <p className="mt-1">
            These prompts are used when generating email sequences. The <strong>Product Overview</strong>{" "}
            tells AI what your product does, <strong>Value Propositions</strong> define angles to use,
            and <strong>Email Skill</strong> controls the writing style and structure.
          </p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Tabs */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-lg border p-2 space-y-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-start gap-3 p-3 rounded-md text-left transition-colors ${
                  activeTab === tab.id
                    ? "bg-peach-50 text-peach-900"
                    : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                <div
                  className={`mt-0.5 ${
                    activeTab === tab.id ? "text-peach-600" : "text-gray-400"
                  }`}
                >
                  {tab.icon}
                </div>
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {tab.label}
                    {hasChanges[tab.id] && (
                      <span className="w-2 h-2 bg-orange-500 rounded-full" />
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{tab.description}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Save/Reset Actions */}
          <div className="mt-4 space-y-2">
            <Button
              className="w-full"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : saved ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saved ? "Saved!" : "Save All Changes"}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleReset}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset to Default
            </Button>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1">
          <div className="bg-white rounded-lg border">
            {/* Editor Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-gray-400" />
                <span className="font-medium">{currentTab.label}</span>
                {hasChanges[activeTab] && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                    Modified
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400">
                {content[activeTab].length.toLocaleString()} characters
              </div>
            </div>

            {/* Textarea */}
            <textarea
              value={content[activeTab]}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full h-[600px] p-4 font-mono text-sm resize-none focus:outline-none"
              placeholder={`Enter your ${currentTab.label.toLowerCase()} content...`}
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
