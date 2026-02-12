"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Target,
  User,
  Building2,
  MessageSquare,
  Sparkles,
  Loader2,
  Check,
  AlertCircle,
  RotateCcw,
  Info,
} from "lucide-react";

// Weight categories for display
const WEIGHT_CATEGORIES = {
  roleFit: {
    title: "Role Fit",
    description: "Points based on decision-making power",
    icon: User,
    color: "blue",
    weights: [
      { key: "rolePrincipal", label: "Principal / Head of School", description: "Decision maker" },
      { key: "roleCurriculumHead", label: "Curriculum / Academic Head", description: "Key influencer" },
      { key: "roleITDirector", label: "IT / Technology Director", description: "Tech buyer" },
      { key: "roleDepartmentHead", label: "Department Head", description: "Limited authority" },
    ],
  },
  schoolFit: {
    title: "School Fit",
    description: "Points based on school characteristics",
    icon: Building2,
    color: "green",
    weights: [
      { key: "premiumFees", label: "Premium Fees (>$10k/year)", description: "Strong budget" },
      { key: "midRangeFees", label: "Mid-Range Fees ($5-10k)", description: "Reasonable budget" },
      { key: "oneToOneDevices", label: "1:1 Device Program", description: "Tech-ready students" },
      { key: "sharedDevices", label: "Shared Devices", description: "May need convincing" },
      { key: "internationalSchool", label: "International School", description: "Usually tech-forward" },
      { key: "ibCurriculum", label: "IB Curriculum", description: "Inquiry-based learning" },
      { key: "igcseCurriculum", label: "Cambridge/IGCSE", description: "Open to digital" },
    ],
  },
  engagement: {
    title: "Engagement",
    description: "Points based on email interactions",
    icon: MessageSquare,
    color: "purple",
    weights: [
      { key: "positiveReply", label: "Positive Reply Sentiment", description: "Actively interested" },
      { key: "neutralReply", label: "Neutral Reply", description: "Engaged" },
      { key: "multipleOpens", label: "Multiple Email Opens (3+)", description: "Curious" },
      { key: "linkClicked", label: "Clicked Links", description: "Active interest" },
    ],
  },
  context: {
    title: "Context",
    description: "Points based on relevance signals",
    icon: Sparkles,
    color: "orange",
    weights: [
      { key: "recentNews", label: "Recent School News/Growth", description: "Change = opportunity" },
      { key: "aiPolicyMentioned", label: "AI/Tech Policy Mentioned", description: "Thinking about AI" },
    ],
  },
};

interface ScoringWeights {
  [key: string]: number;
}

export default function ScoringSettingsPage() {
  const [weights, setWeights] = useState<ScoringWeights>({});
  const [originalWeights, setOriginalWeights] = useState<ScoringWeights>({});
  const [isDefault, setIsDefault] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch current weights
  useEffect(() => {
    fetchWeights();
  }, []);

  const fetchWeights = async () => {
    try {
      const response = await fetch("/api/settings/scoring");
      const data = await response.json();
      setWeights(data.weights);
      setOriginalWeights(data.weights);
      setIsDefault(data.isDefault);
    } catch (error) {
      console.error("Failed to fetch weights:", error);
      setMessage({ type: "error", text: "Failed to load scoring settings" });
    } finally {
      setLoading(false);
    }
  };

  const handleWeightChange = (key: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setWeights({ ...weights, [key]: Math.min(10, Math.max(0, numValue)) });
  };

  const hasChanges = JSON.stringify(weights) !== JSON.stringify(originalWeights);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/scoring", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save");
      }

      setOriginalWeights(weights);
      setIsDefault(false);
      setMessage({ type: "success", text: "Scoring weights saved!" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset all scoring weights to defaults?")) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/scoring?action=reset", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset");
      }

      setWeights(data.weights);
      setOriginalWeights(data.weights);
      setIsDefault(true);
      setMessage({ type: "success", text: "Scoring weights reset to defaults" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Reset failed" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lead Scoring Settings</h1>
            <p className="text-gray-500 mt-1">
              Customize how leads are scored (0-10 scale)
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isDefault && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                Using defaults
              </span>
            )}
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={saving || isDefault}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
          </div>
        </div>
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

      {/* Info box */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">How Scoring Works</h3>
            <p className="text-sm text-blue-800 mt-1">
              Each factor adds points to a lead&apos;s score. The total is capped at 10.
              Leads with scores 8+ are &quot;Hot&quot;, 6-7 are &quot;Warm&quot;, 4-5 are &quot;Cool&quot;, and below 4 are &quot;Cold&quot;.
            </p>
          </div>
        </div>
      </div>

      {/* Weight Categories */}
      <div className="space-y-6">
        {Object.entries(WEIGHT_CATEGORIES).map(([categoryKey, category]) => {
          const Icon = category.icon;
          const colorClasses = {
            blue: "bg-blue-50 text-blue-600",
            green: "bg-green-50 text-green-600",
            purple: "bg-purple-50 text-purple-600",
            orange: "bg-orange-50 text-orange-600",
          }[category.color];

          return (
            <div key={categoryKey} className="bg-white rounded-xl border p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${colorClasses}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{category.title}</h2>
                  <p className="text-sm text-gray-500">{category.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {category.weights.map((weight) => (
                  <div
                    key={weight.key}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="font-medium text-gray-900 text-sm">{weight.label}</div>
                      <div className="text-xs text-gray-500">{weight.description}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={weights[weight.key] ?? 0}
                        onChange={(e) => handleWeightChange(weight.key, e.target.value)}
                        className="w-20 text-center"
                        min={0}
                        max={10}
                        step={0.5}
                      />
                      <span className="text-xs text-gray-400 w-8">pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Save Button */}
      <div className="mt-8 flex items-center justify-between sticky bottom-4 bg-white p-4 rounded-xl border shadow-lg">
        <div className="text-sm text-gray-500">
          {hasChanges ? (
            <span className="text-amber-600 font-medium">You have unsaved changes</span>
          ) : (
            "All changes saved"
          )}
        </div>
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
