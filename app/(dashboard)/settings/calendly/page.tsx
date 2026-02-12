"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  Loader2,
  Check,
  AlertCircle,
  ExternalLink,
  Copy,
  RefreshCw,
} from "lucide-react";

interface CalendlyStatus {
  connected: boolean;
  user?: {
    name: string;
    email: string;
    schedulingUrl: string;
  };
  eventTypes?: {
    name: string;
    url: string;
  }[];
  error?: string;
}

export default function CalendlySettingsPage() {
  const [status, setStatus] = useState<CalendlyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Webhook URL for Calendly
  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhooks/calendly`
    : "";

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    setTesting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/calendly/test");
      const data = await response.json();
      setStatus(data);

      if (data.connected) {
        setMessage({ type: "success", text: "Connected to Calendly!" });
      } else {
        setMessage({
          type: "error",
          text: data.error || "Not connected. Please add your API key to .env",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "Failed to test connection",
      });
    } finally {
      setLoading(false);
      setTesting(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <h1 className="text-2xl font-bold text-gray-900">Calendly Integration</h1>
        <p className="text-gray-500 mt-1">
          Connect Calendly to automatically handle meeting bookings
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

      {/* Connection Status */}
      <div className="bg-white rounded-xl border p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${status?.connected ? "bg-green-50" : "bg-gray-100"}`}>
              <Calendar className={`h-5 w-5 ${status?.connected ? "text-green-600" : "text-gray-400"}`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Connection Status</h2>
              <p className="text-sm text-gray-500">
                {status?.connected ? "Connected to Calendly" : "Not connected"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={testConnection}
            disabled={testing}
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Test Connection
              </>
            )}
          </Button>
        </div>

        {status?.connected && status.user && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Account</span>
              <span className="text-sm font-medium">{status.user.name} ({status.user.email})</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Scheduling URL</span>
              <a
                href={status.user.schedulingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                {status.user.schedulingUrl}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        {!status?.connected && (
          <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <h3 className="font-medium text-amber-800 mb-2">Setup Required</h3>
            <ol className="text-sm text-amber-700 space-y-2">
              <li>1. Go to <a href="https://calendly.com/integrations" target="_blank" rel="noopener noreferrer" className="underline">Calendly Integrations</a></li>
              <li>2. Create a Personal Access Token under &quot;API & Webhooks&quot;</li>
              <li>3. Add <code className="bg-amber-100 px-1 rounded">CALENDLY_API_KEY=your_token</code> to your .env file</li>
              <li>4. Restart the server and test connection again</li>
            </ol>
          </div>
        )}
      </div>

      {/* Event Types */}
      {status?.connected && status.eventTypes && status.eventTypes.length > 0 && (
        <div className="bg-white rounded-xl border p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Event Types</h2>
          <div className="space-y-3">
            {status.eventTypes.map((et, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <span className="font-medium text-gray-900">{et.name}</span>
                <a
                  href={et.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  View
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Webhook Setup */}
      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Webhook Setup</h2>
        <p className="text-sm text-gray-500 mb-4">
          Configure Calendly to send booking notifications to this endpoint. This enables automatic meeting prep generation.
        </p>

        <div className="flex items-center gap-2 mb-4">
          <Input
            value={webhookUrl}
            readOnly
            className="font-mono text-sm"
          />
          <Button variant="outline" onClick={copyWebhookUrl}>
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-medium text-blue-800 mb-2">How to Setup Webhooks</h3>
          <ol className="text-sm text-blue-700 space-y-2">
            <li>1. Go to <a href="https://calendly.com/integrations/webhooks" target="_blank" rel="noopener noreferrer" className="underline">Calendly Webhooks</a></li>
            <li>2. Click &quot;Add Webhook&quot;</li>
            <li>3. Paste the URL above as the endpoint</li>
            <li>4. Select &quot;invitee.created&quot; and &quot;invitee.canceled&quot; events</li>
            <li>5. Save the webhook</li>
          </ol>
        </div>
      </div>

      {/* How It Works */}
      <div className="mt-8 p-6 bg-gray-50 rounded-xl border">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">How Calendly Integration Works</h2>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-blue-600 font-bold">1</span>
            </div>
            <h3 className="font-medium text-gray-900 mb-1">Lead Ready to Book</h3>
            <p className="text-sm text-gray-500">
              AI detects when a lead is ready to schedule and includes your Calendly link in the draft reply.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-blue-600 font-bold">2</span>
            </div>
            <h3 className="font-medium text-gray-900 mb-1">Meeting Booked</h3>
            <p className="text-sm text-gray-500">
              When they book, Calendly notifies us via webhook. Lead status updates to &quot;meeting_booked&quot;.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-blue-600 font-bold">3</span>
            </div>
            <h3 className="font-medium text-gray-900 mb-1">Auto Prep Generated</h3>
            <p className="text-sm text-gray-500">
              AI generates a meeting prep document with talking points, objections, and insights.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
