"use client";

import { useState, useEffect } from "react";
import {
  Flame,
  Plus,
  Mail,
  TrendingUp,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart3,
  Settings,
  Play,
  Pause,
  RefreshCw,
  ExternalLink,
  Info,
} from "lucide-react";

interface WarmupDomain {
  id: string;
  domain: string;
  email: string;
  status: "warming" | "paused" | "healthy" | "at_risk";
  healthScore: number;
  dailyLimit: number;
  currentDaily: number;
  totalSent: number;
  totalReceived: number;
  spamRate: number;
  inboxRate: number;
  daysActive: number;
  provider: "google" | "microsoft" | "other";
  createdAt: string;
}

interface WarmupStats {
  totalDomains: number;
  activeWarmups: number;
  avgHealthScore: number;
  avgInboxRate: number;
  emailsSentToday: number;
  emailsReceivedToday: number;
}

// Mock data
const mockDomains: WarmupDomain[] = [
  {
    id: "1",
    domain: "peach.study",
    email: "kanishk@peach.study",
    status: "warming",
    healthScore: 87,
    dailyLimit: 50,
    currentDaily: 32,
    totalSent: 456,
    totalReceived: 423,
    spamRate: 2.1,
    inboxRate: 94.5,
    daysActive: 14,
    provider: "google",
    createdAt: "2024-01-15",
  },
  {
    id: "2",
    domain: "outreach.peach.study",
    email: "sales@outreach.peach.study",
    status: "healthy",
    healthScore: 95,
    dailyLimit: 100,
    currentDaily: 78,
    totalSent: 1234,
    totalReceived: 1198,
    spamRate: 0.8,
    inboxRate: 98.2,
    daysActive: 45,
    provider: "google",
    createdAt: "2023-12-01",
  },
  {
    id: "3",
    domain: "mail.peachsdr.com",
    email: "team@mail.peachsdr.com",
    status: "at_risk",
    healthScore: 62,
    dailyLimit: 30,
    currentDaily: 15,
    totalSent: 234,
    totalReceived: 189,
    spamRate: 8.5,
    inboxRate: 78.3,
    daysActive: 7,
    provider: "microsoft",
    createdAt: "2024-02-01",
  },
];

const mockStats: WarmupStats = {
  totalDomains: 3,
  activeWarmups: 2,
  avgHealthScore: 81,
  avgInboxRate: 90.3,
  emailsSentToday: 125,
  emailsReceivedToday: 118,
};

export default function WarmupPage() {
  const [domains, setDomains] = useState<WarmupDomain[]>(mockDomains);
  const [stats, setStats] = useState<WarmupStats>(mockStats);
  const [selectedDomain, setSelectedDomain] = useState<WarmupDomain | null>(null);

  const getStatusColor = (status: WarmupDomain["status"]) => {
    switch (status) {
      case "warming":
        return "bg-amber-100 text-amber-700";
      case "healthy":
        return "bg-emerald-100 text-emerald-700";
      case "paused":
        return "bg-gray-100 text-gray-700";
      case "at_risk":
        return "bg-red-100 text-red-700";
    }
  };

  const getStatusIcon = (status: WarmupDomain["status"]) => {
    switch (status) {
      case "warming":
        return <Flame className="w-3.5 h-3.5" />;
      case "healthy":
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "paused":
        return <Pause className="w-3.5 h-3.5" />;
      case "at_risk":
        return <AlertTriangle className="w-3.5 h-3.5" />;
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-emerald-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  };

  const getHealthBg = (score: number) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-red-500";
  };

  const toggleWarmup = (domainId: string) => {
    setDomains((prev) =>
      prev.map((d) =>
        d.id === domainId
          ? {
              ...d,
              status: d.status === "paused" ? "warming" : "paused",
            }
          : d
      )
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Warmup</h1>
          <p className="text-gray-500 mt-1">
            Warm up your email domains to improve deliverability
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-violet-500/25 transition-all">
          <Plus className="w-4 h-4" />
          Add Domain
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Mail className="w-4 h-4" />
            Domains
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalDomains}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Flame className="w-4 h-4 text-orange-500" />
            Active
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.activeWarmups}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Shield className="w-4 h-4 text-emerald-500" />
            Avg Health
          </div>
          <p className={`text-2xl font-bold ${getHealthColor(stats.avgHealthScore)}`}>
            {stats.avgHealthScore}%
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            Inbox Rate
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.avgInboxRate}%</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Mail className="w-4 h-4 text-violet-500" />
            Sent Today
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.emailsSentToday}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Mail className="w-4 h-4 text-indigo-500" />
            Received Today
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.emailsReceivedToday}</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Info className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-violet-900 font-medium">How Email Warmup Works</p>
          <p className="text-sm text-violet-700 mt-1">
            We automatically send and receive emails between your domain and our network of
            trusted inboxes. This builds your sender reputation and improves deliverability
            over time. Most domains reach optimal health in 2-4 weeks.
          </p>
        </div>
      </div>

      {/* Domains List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Your Domains</h2>
        </div>

        <div className="divide-y divide-gray-100">
          {domains.map((domain) => (
            <div
              key={domain.id}
              className="px-6 py-4 hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Provider Icon */}
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                    {domain.provider === "google" ? (
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#00A4EF" d="M11.4 24H0V12.6h11.4V24z" />
                        <path fill="#FFB900" d="M24 24H12.6V12.6H24V24z" />
                        <path fill="#F25022" d="M11.4 11.4H0V0h11.4v11.4z" />
                        <path fill="#7FBA00" d="M24 11.4H12.6V0H24v11.4z" />
                      </svg>
                    )}
                  </div>

                  {/* Domain Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{domain.email}</p>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                          domain.status
                        )}`}
                      >
                        {getStatusIcon(domain.status)}
                        {domain.status.charAt(0).toUpperCase() + domain.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {domain.daysActive} days active • {domain.totalSent} sent •{" "}
                      {domain.totalReceived} received
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Health Score */}
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Health</p>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getHealthBg(domain.healthScore)} rounded-full`}
                          style={{ width: `${domain.healthScore}%` }}
                        />
                      </div>
                      <span className={`text-sm font-semibold ${getHealthColor(domain.healthScore)}`}>
                        {domain.healthScore}
                      </span>
                    </div>
                  </div>

                  {/* Inbox Rate */}
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Inbox Rate</p>
                    <p className="text-sm font-semibold text-gray-900">{domain.inboxRate}%</p>
                  </div>

                  {/* Daily Progress */}
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Today</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {domain.currentDaily}/{domain.dailyLimit}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleWarmup(domain.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        domain.status === "paused"
                          ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                      title={domain.status === "paused" ? "Resume warmup" : "Pause warmup"}
                    >
                      {domain.status === "paused" ? (
                        <Play className="w-4 h-4" />
                      ) : (
                        <Pause className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                      title="Settings"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                      title="View details"
                    >
                      <BarChart3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Warning for at-risk domains */}
              {domain.status === "at_risk" && (
                <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-800 font-medium">
                      High spam rate detected ({domain.spamRate}%)
                    </p>
                    <p className="text-xs text-red-600 mt-0.5">
                      Consider reducing daily volume and checking your DNS records
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {domains.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500/10 to-red-500/10 flex items-center justify-center">
            <Flame className="w-8 h-8 text-orange-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No domains warming up
          </h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Add your first email domain to start building sender reputation and
            improve your email deliverability.
          </p>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-violet-500/25 transition-all">
            <Plus className="w-4 h-4" />
            Add Your First Domain
          </button>
        </div>
      )}
    </div>
  );
}
