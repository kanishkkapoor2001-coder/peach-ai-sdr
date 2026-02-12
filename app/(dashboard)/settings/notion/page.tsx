"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Database,
  Check,
  X,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Save,
  Loader2,
} from "lucide-react";

interface NotionStatus {
  connected: boolean;
  databases: {
    company: boolean;
    crm: boolean;
    tasks: boolean;
  };
  error?: string;
}

export default function NotionSettingsPage() {
  const [status, setStatus] = useState<NotionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form state for Notion configuration
  const [config, setConfig] = useState({
    notionApiKey: "",
    notionCrmDbId: "",
    notionTasksDbId: "",
    notionCompanyDbId: "",
  });

  // Load saved settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch("/api/settings");
        const data = await response.json();
        const settings = data.settings || {};

        setConfig({
          notionApiKey: settings.notion_api_key || "",
          notionCrmDbId: settings.notion_crm_db_id || "",
          notionTasksDbId: settings.notion_tasks_db_id || "",
          notionCompanyDbId: settings.notion_company_db_id || "",
        });
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };

    loadSettings();
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setTesting(true);
    try {
      const response = await fetch("/api/notion/sync");
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      setStatus({
        connected: false,
        databases: { company: false, crm: false, tasks: false },
        error: "Failed to check connection",
      });
    } finally {
      setTesting(false);
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            notion_api_key: config.notionApiKey,
            notion_crm_db_id: config.notionCrmDbId,
            notion_tasks_db_id: config.notionTasksDbId,
            notion_company_db_id: config.notionCompanyDbId,
          },
        }),
      });

      if (response.ok) {
        setSaved(true);
        // Re-check connection after saving
        setTimeout(() => checkConnection(), 500);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Database className="h-7 w-7" />
          Notion CRM Integration
        </h1>
        <p className="text-gray-500 mt-2">
          Connect your Notion workspace to automatically sync leads to your CRM.
        </p>
      </div>

      {/* Connection Status */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Connection Status</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={checkConnection}
            disabled={testing}
          >
            {testing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Test Connection
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Checking connection...
          </div>
        ) : status ? (
          <div className="space-y-4">
            {/* Overall Status */}
            <div
              className={`flex items-center gap-2 p-3 rounded-lg ${
                status.connected ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {status.connected ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              <span className="font-medium">
                {status.connected ? "Connected to Notion" : "Not Connected"}
              </span>
            </div>

            {/* Database Status */}
            {status.connected && (
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(status.databases).map(([db, connected]) => (
                  <div
                    key={db}
                    className={`p-3 rounded-lg border ${
                      connected ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {connected ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <X className="h-4 w-4 text-red-600" />
                      )}
                      <span className="capitalize font-medium">
                        {db === "crm" ? "CRM" : db} DB
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {status.error && (
              <p className="text-sm text-red-600">{status.error}</p>
            )}
          </div>
        ) : null}
      </div>

      {/* Configuration Form */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-semibold text-gray-900">Notion Configuration</h2>
            <p className="text-sm text-gray-500 mt-1">
              Enter your Notion API key and database IDs below
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saved ? "Saved!" : "Save Configuration"}
          </Button>
        </div>

        <div className="space-y-4">
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notion API Key (Integration Secret)
            </label>
            <Input
              type="password"
              value={config.notionApiKey}
              onChange={(e) => setConfig({ ...config, notionApiKey: e.target.value })}
              placeholder="secret_..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Get this from{" "}
              <a
                href="https://www.notion.so/my-integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="text-peach-600 hover:underline"
              >
                notion.so/my-integrations
              </a>
            </p>
          </div>

          {/* CRM DB ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CRM Database ID
            </label>
            <Input
              value={config.notionCrmDbId}
              onChange={(e) => setConfig({ ...config, notionCrmDbId: e.target.value })}
              placeholder="22cf9681ebaa802fa1c0faa597a9a936"
            />
            <p className="text-xs text-gray-500 mt-1">
              For storing contacts/leads
            </p>
          </div>

          {/* Tasks DB ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tasks Database ID
            </label>
            <Input
              value={config.notionTasksDbId}
              onChange={(e) => setConfig({ ...config, notionTasksDbId: e.target.value })}
              placeholder="256f9681ebaa8020b114dadbd4e4399f"
            />
            <p className="text-xs text-gray-500 mt-1">
              For follow-up tasks
            </p>
          </div>

          {/* Company/Schools DB ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company/Schools Database ID
            </label>
            <Input
              value={config.notionCompanyDbId}
              onChange={(e) => setConfig({ ...config, notionCompanyDbId: e.target.value })}
              placeholder="256f9681ebaa80a1836ce6d6ab757f2c"
            />
            <p className="text-xs text-gray-500 mt-1">
              For storing school/company information
            </p>
          </div>
        </div>

        {/* Help text */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-sm font-medium text-blue-900 mb-2">How to find Database IDs</h3>
          <p className="text-sm text-blue-700">
            Open your database as a full page in Notion. The URL will look like:
          </p>
          <code className="block mt-2 p-2 bg-blue-100 rounded text-xs text-blue-900">
            notion.so/workspace/<strong className="text-blue-600">database-id-here</strong>?v=...
          </code>
          <p className="text-sm text-blue-700 mt-2">
            Copy the 32-character ID before the &quot;?&quot;
          </p>
        </div>
      </div>

      {/* What Gets Synced */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="font-semibold text-gray-900 mb-4">What Gets Synced</h2>
        <p className="text-sm text-gray-500 mb-4">
          When a lead replies to your emails or books a meeting, they&apos;re automatically synced to Notion:
        </p>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="p-3 bg-purple-50 rounded-lg">
            <p className="font-medium text-purple-900">Company</p>
            <p className="text-purple-700 text-xs mt-1">
              School name, website, country, curriculum, fees, student count
            </p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="font-medium text-blue-900">Contact (CRM)</p>
            <p className="text-blue-700 text-xs mt-1">
              Name, email, role, lead score, fit reasons, status
            </p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="font-medium text-green-900">Follow-up Task</p>
            <p className="text-green-700 text-xs mt-1">
              Linked to contact, due in 1 day, email channel
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
