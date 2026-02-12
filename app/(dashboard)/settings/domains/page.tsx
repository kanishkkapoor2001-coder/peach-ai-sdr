"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Check,
  Mail,
  Globe,
  RefreshCw,
  X,
  Settings,
} from "lucide-react";

interface Domain {
  id: string;
  domain: string;
  fromEmail: string;
  fromName: string;
  sentToday: number;
  dailyLimit: number;
  remainingCapacity: number;
  isActive: boolean;
  warmupDays: number;
  sendingMethod: string;
  smtpHost: string | null;
  smtpConfigured: boolean;
}

const SMTP_PRESETS: Record<string, { host: string; port: number; notes: string }> = {
  gmail: { host: "smtp.gmail.com", port: 587, notes: "Use App Password from myaccount.google.com/apppasswords" },
  outlook: { host: "smtp.office365.com", port: 587, notes: "Use your Microsoft 365 password" },
  zoho: { host: "smtp.zoho.com", port: 587, notes: "Use your Zoho Mail password" },
};

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newDomain, setNewDomain] = useState({
    domain: "",
    fromEmail: "",
    fromName: "",
    sendingMethod: "smtp", // Default to SMTP for warmed domains
    smtpPreset: "gmail",
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpPassword: "",
  });
  const [testingSmtp, setTestingSmtp] = useState<string | null>(null);
  const [smtpTestResult, setSmtpTestResult] = useState<{ id: string; success: boolean; error?: string } | null>(null);

  // Resend check
  const [resendConfigured, setResendConfigured] = useState<boolean | null>(null);

  // Fetch domains
  const fetchDomains = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/domains");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch domains");
      }

      setDomains(data.domains || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load domains");
    } finally {
      setLoading(false);
    }
  };

  // Check Resend configuration
  const checkResend = async () => {
    try {
      const response = await fetch("/api/domains/check-resend");
      const data = await response.json();
      setResendConfigured(data.configured);
    } catch {
      setResendConfigured(false);
    }
  };

  useEffect(() => {
    fetchDomains();
    checkResend();
  }, []);

  // Handle SMTP preset change
  const handlePresetChange = (preset: string) => {
    const config = SMTP_PRESETS[preset];
    if (config) {
      setNewDomain({ ...newDomain, smtpPreset: preset, smtpHost: config.host, smtpPort: config.port });
    }
  };

  // Test SMTP connection
  const handleTestSmtp = async (domainId: string) => {
    setTestingSmtp(domainId);
    setSmtpTestResult(null);
    try {
      const response = await fetch(`/api/domains/test?id=${domainId}`, { method: "POST" });
      const data = await response.json();
      setSmtpTestResult({ id: domainId, success: data.success, error: data.error });
    } catch {
      setSmtpTestResult({ id: domainId, success: false, error: "Connection test failed" });
    } finally {
      setTestingSmtp(null);
    }
  };

  // Add domain
  const handleAddDomain = async () => {
    if (!newDomain.domain || !newDomain.fromEmail || !newDomain.fromName) {
      return;
    }

    setIsAdding(true);
    try {
      const response = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: newDomain.domain,
          fromEmail: newDomain.fromEmail,
          fromName: newDomain.fromName,
          sendingMethod: newDomain.sendingMethod,
          smtpHost: newDomain.smtpHost,
          smtpPort: newDomain.smtpPort,
          smtpUser: newDomain.fromEmail,
          smtpPassword: newDomain.smtpPassword,
          warmupStartDate: new Date().toISOString(),
          isActive: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add domain");
      }

      setNewDomain({ domain: "", fromEmail: "", fromName: "", sendingMethod: "smtp", smtpPreset: "gmail", smtpHost: "smtp.gmail.com", smtpPort: 587, smtpPassword: "" });
      setShowAddModal(false);
      await fetchDomains();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add domain");
    } finally {
      setIsAdding(false);
    }
  };

  // Delete domain
  const handleDeleteDomain = async (id: string) => {
    if (!confirm("Are you sure you want to delete this domain?")) return;

    try {
      const response = await fetch(`/api/domains?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete domain");
      }

      await fetchDomains();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete domain");
    }
  };

  // Toggle domain active status
  const handleToggleActive = async (domain: Domain) => {
    try {
      const response = await fetch("/api/domains", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: domain.id,
          isActive: !domain.isActive,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update domain");
      }

      await fetchDomains();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update domain");
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sending Domains</h1>
          <p className="text-gray-500 mt-1">
            Configure email domains for sending cold emails
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={fetchDomains} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Domain
          </Button>
        </div>
      </div>

      {/* Resend Warning */}
      {resendConfigured === false && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Resend API not configured</p>
            <p className="text-sm text-amber-700 mt-1">
              To send emails, you need to add your Resend API key to <code className="bg-amber-100 px-1 rounded">.env.local</code>:
            </p>
            <pre className="bg-amber-100 rounded p-2 mt-2 text-sm text-amber-900">
              RESEND_API_KEY=re_your_api_key_here
            </pre>
            <p className="text-sm text-amber-700 mt-2">
              Get your API key at{" "}
              <a
                href="https://resend.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                resend.com
              </a>{" "}
              (free for up to 3,000 emails/month)
            </p>
          </div>
        </div>
      )}

      {/* Setup Guide */}
      {domains.length === 0 && !loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">Quick Setup Guide</h3>
          <ol className="list-decimal list-inside text-sm text-blue-800 space-y-2">
            <li>
              <strong>Get a Resend account</strong> - Sign up at{" "}
              <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline">
                resend.com
              </a>{" "}
              (free tier: 3,000 emails/month)
            </li>
            <li>
              <strong>Add your domain to Resend</strong> - Verify DNS records for your sending domain
            </li>
            <li>
              <strong>Add your API key</strong> - Put <code className="bg-blue-100 px-1 rounded">RESEND_API_KEY=re_...</code> in your <code className="bg-blue-100 px-1 rounded">.env.local</code>
            </li>
            <li>
              <strong>Add a sending domain below</strong> - Configure the from email and name
            </li>
          </ol>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-700">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Domains List */}
      <div className="bg-white rounded-xl border shadow-sm">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">Loading domains...</p>
          </div>
        ) : domains.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No sending domains configured
            </h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Add a domain to start sending cold emails. You&apos;ll need to verify it in Resend first.
            </p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Domain
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {domains.map((domain) => (
              <div
                key={domain.id}
                className={`p-4 ${!domain.isActive ? "bg-gray-50" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      domain.isActive ? "bg-green-100" : "bg-gray-100"
                    }`}>
                      <Globe className={`h-5 w-5 ${
                        domain.isActive ? "text-green-600" : "text-gray-400"
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{domain.domain}</p>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          domain.sendingMethod === "smtp"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {domain.sendingMethod === "smtp" ? "SMTP" : "Resend"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {domain.fromName} &lt;{domain.fromEmail}&gt;
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Configuration Warning */}
                    {domain.sendingMethod === "smtp" && !domain.smtpConfigured && (
                      <div className="flex items-center gap-1 text-amber-600">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-xs font-medium">Password missing</span>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {domain.sentToday} / {domain.dailyLimit}
                      </p>
                      <p className="text-xs text-gray-500">sent today</p>
                    </div>

                    {/* Warmup Progress */}
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {domain.warmupDays} days
                      </p>
                      <p className="text-xs text-gray-500">warmup</p>
                    </div>

                    {/* Test SMTP Connection */}
                    {domain.sendingMethod === "smtp" && domain.smtpConfigured && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestSmtp(domain.id)}
                        disabled={testingSmtp === domain.id}
                        className={
                          smtpTestResult?.id === domain.id
                            ? smtpTestResult.success
                              ? "border-green-500 text-green-600"
                              : "border-red-500 text-red-600"
                            : ""
                        }
                      >
                        {testingSmtp === domain.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : smtpTestResult?.id === domain.id ? (
                          smtpTestResult.success ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <AlertCircle className="h-4 w-4" />
                          )
                        ) : (
                          "Test"
                        )}
                      </Button>
                    )}

                    {/* Status Toggle */}
                    <button
                      onClick={() => handleToggleActive(domain)}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        domain.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {domain.isActive ? "Active" : "Paused"}
                    </button>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeleteDomain(domain.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Capacity Bar */}
                <div className="mt-3 ml-14">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        domain.remainingCapacity > 0 ? "bg-green-500" : "bg-red-500"
                      }`}
                      style={{
                        width: `${Math.min(100, (domain.sentToday / domain.dailyLimit) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {domain.remainingCapacity} emails remaining today
                  </p>

                  {/* SMTP Test Error */}
                  {smtpTestResult?.id === domain.id && !smtpTestResult.success && smtpTestResult.error && (
                    <p className="text-xs text-red-600 mt-2">
                      Connection failed: {smtpTestResult.error}
                    </p>
                  )}

                  {/* Configuration Warning for SMTP without password */}
                  {domain.sendingMethod === "smtp" && !domain.smtpConfigured && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                      <strong>⚠️ SMTP password not configured.</strong> This domain cannot send emails until you add your App Password.
                      {domain.smtpHost === "smtp.gmail.com" && (
                        <span> Get one at{" "}
                          <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline">
                            myaccount.google.com/apppasswords
                          </a>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warmup Schedule Info */}
      <div className="mt-6 bg-gray-50 border rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Warmup Schedule
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          To protect your domain reputation, daily sending limits increase gradually:
        </p>
        <div className="grid grid-cols-5 gap-2 text-center text-sm">
          {[
            { week: "Week 1", limit: 10 },
            { week: "Week 2", limit: 25 },
            { week: "Week 3", limit: 50 },
            { week: "Week 4", limit: 75 },
            { week: "Week 5+", limit: 100 },
          ].map((tier) => (
            <div key={tier.week} className="bg-white rounded p-2 border">
              <p className="text-gray-500 text-xs">{tier.week}</p>
              <p className="font-semibold text-gray-900">{tier.limit}/day</p>
            </div>
          ))}
        </div>
      </div>

      {/* Add Domain Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="border-b p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Globe className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Add Sending Domain</h2>
                  <p className="text-sm text-gray-500">Configure a new email domain</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowAddModal(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-4 space-y-4">
              {/* Email Provider Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Provider *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "gmail", label: "Gmail", icon: "📧" },
                    { id: "outlook", label: "Outlook", icon: "📬" },
                    { id: "zoho", label: "Zoho", icon: "✉️" },
                  ].map((provider) => (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => handlePresetChange(provider.id)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        newDomain.smtpPreset === provider.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <span className="text-xl">{provider.icon}</span>
                      <p className="text-sm font-medium mt-1">{provider.label}</p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {SMTP_PRESETS[newDomain.smtpPreset]?.notes}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Email *
                </label>
                <Input
                  type="email"
                  value={newDomain.fromEmail}
                  onChange={(e) => {
                    const email = e.target.value;
                    const domain = email.includes("@") ? email.split("@")[1] : "";
                    setNewDomain({ ...newDomain, fromEmail: email, domain: domain });
                  }}
                  placeholder="sales@yourdomain.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your full email address (domain will be auto-filled)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  App Password *
                </label>
                <Input
                  type="password"
                  value={newDomain.smtpPassword}
                  onChange={(e) => setNewDomain({ ...newDomain, smtpPassword: e.target.value })}
                  placeholder="xxxx xxxx xxxx xxxx"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {newDomain.smtpPreset === "gmail" ? (
                    <>
                      Get it from{" "}
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        myaccount.google.com/apppasswords
                      </a>
                    </>
                  ) : newDomain.smtpPreset === "outlook" ? (
                    "Use your Microsoft 365 account password"
                  ) : (
                    "Use your Zoho Mail password"
                  )}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Name *
                </label>
                <Input
                  value={newDomain.fromName}
                  onChange={(e) => setNewDomain({ ...newDomain, fromName: e.target.value })}
                  placeholder="Jane Smith"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The name that appears in the recipient&apos;s inbox
                </p>
              </div>

              {/* Hidden domain field - auto-filled from email */}
              <input type="hidden" value={newDomain.domain} />
            </div>

            <div className="border-t p-4 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddDomain}
                disabled={!newDomain.domain || !newDomain.fromEmail || !newDomain.fromName || !newDomain.smtpPassword || isAdding}
              >
                {isAdding ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Domain
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
