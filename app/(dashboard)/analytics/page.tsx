"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Mail,
  Users,
  Eye,
  MousePointerClick,
  MessageSquare,
  Calendar,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Sparkles,
  Target,
  Clock,
  Zap,
  Globe,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
} from "recharts";

// ============================================
// ANIMATED NUMBER
// ============================================

function AnimatedNumber({
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(current);
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <span className="tabular-nums">
      {prefix}
      {decimals > 0 ? displayValue.toFixed(decimals) : Math.floor(displayValue).toLocaleString()}
      {suffix}
    </span>
  );
}

// ============================================
// TYPES
// ============================================

interface TrackingStats {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  totalOpens: number;
  totalClicks: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
  clickToOpenRate: number;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AnalyticsPage() {
  const [stats, setStats] = useState<TrackingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");

  const campaigns = [
    { id: "all", name: "All Campaigns" },
    { id: "ib-schools-sea", name: "IB Schools SEA" },
    { id: "uk-boarding", name: "UK Boarding" },
    { id: "stem-directors", name: "STEM Directors" },
    { id: "edtech-buyers", name: "EdTech Buyers" },
  ];

  useEffect(() => {
    fetchStats();
  }, [period, selectedCampaign]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/track/stats?period=${period}`);
      const data = await res.json();
      if (!data.error) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  // Mock data for charts (would come from API in production)
  const emailTrendData = [
    { date: "Week 1", sent: 450, opened: 180, clicked: 45, replied: 18 },
    { date: "Week 2", sent: 520, opened: 210, clicked: 58, replied: 24 },
    { date: "Week 3", sent: 680, opened: 285, clicked: 72, replied: 32 },
    { date: "Week 4", sent: 750, opened: 320, clicked: 85, replied: 38 },
  ];

  const performanceByDay = [
    { day: "Mon", openRate: 42, clickRate: 8, replyRate: 4 },
    { day: "Tue", openRate: 38, clickRate: 7, replyRate: 3.5 },
    { day: "Wed", openRate: 45, clickRate: 9, replyRate: 4.5 },
    { day: "Thu", openRate: 40, clickRate: 8.5, replyRate: 4 },
    { day: "Fri", openRate: 35, clickRate: 6, replyRate: 3 },
    { day: "Sat", openRate: 25, clickRate: 4, replyRate: 2 },
    { day: "Sun", openRate: 20, clickRate: 3, replyRate: 1.5 },
  ];

  const campaignPerformance = [
    { name: "IB Schools SEA", sent: 1200, openRate: 45, replyRate: 5.2, color: "#8b5cf6" },
    { name: "UK Boarding", sent: 850, openRate: 38, replyRate: 4.1, color: "#3b82f6" },
    { name: "STEM Directors", sent: 620, openRate: 52, replyRate: 6.8, color: "#10b981" },
    { name: "EdTech Buyers", sent: 480, openRate: 41, replyRate: 4.5, color: "#f59e0b" },
  ];

  const responseDistribution = [
    { name: "Interested", value: 35, color: "#10b981" },
    { name: "Meeting Booked", value: 15, color: "#8b5cf6" },
    { name: "Not Now", value: 25, color: "#f59e0b" },
    { name: "Not Interested", value: 20, color: "#ef4444" },
    { name: "No Response", value: 5, color: "#9ca3af" },
  ];

  const hourlyPerformance = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, "0")}:00`,
    opens: Math.floor(Math.random() * 50) + (i >= 9 && i <= 17 ? 30 : 5),
  }));

  const getTrend = (current: number, benchmark: number) => {
    const diff = current - benchmark;
    const percentage = ((diff / benchmark) * 100).toFixed(1);
    return {
      positive: diff >= 0,
      percentage: Math.abs(parseFloat(percentage)),
    };
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          </div>
          <p className="text-gray-500">
            Track campaign performance, engagement trends, and conversion insights
          </p>
          {selectedCampaign !== "all" && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-violet-600 font-medium">
                Viewing: {campaigns.find((c) => c.id === selectedCampaign)?.name}
              </span>
              <button
                onClick={() => setSelectedCampaign("all")}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Campaign Selector */}
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {/* Period Selector */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            {(["7d", "30d", "90d"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  period === p
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : "90 Days"}
              </button>
            ))}
          </div>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button
            onClick={fetchStats}
            className="bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/25"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-5 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Emails Sent</span>
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-400 to-violet-600 shadow-lg shadow-violet-500/25">
              <Mail className="h-4 w-4 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            <AnimatedNumber value={stats?.sent || 2400} />
          </p>
          <div className="flex items-center gap-1 mt-2">
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            <span className="text-sm text-emerald-600 font-medium">+12.5%</span>
            <span className="text-sm text-gray-400 ml-1">vs last period</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Open Rate</span>
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/25">
              <Eye className="h-4 w-4 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            <AnimatedNumber value={stats?.openRate || 42.5} suffix="%" decimals={1} />
          </p>
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-1000"
              style={{ width: `${stats?.openRate || 42.5}%` }}
            />
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Click Rate</span>
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/25">
              <MousePointerClick className="h-4 w-4 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            <AnimatedNumber value={stats?.clickRate || 8.2} suffix="%" decimals={1} />
          </p>
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-1000"
              style={{ width: `${(stats?.clickRate || 8.2) * 5}%` }}
            />
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Reply Rate</span>
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/25">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            <AnimatedNumber value={stats?.replyRate || 4.8} suffix="%" decimals={1} />
          </p>
          <div className="flex items-center gap-1 mt-2">
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            <span className="text-sm text-emerald-600 font-medium">+0.8%</span>
            <span className="text-sm text-gray-400 ml-1">vs last period</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Meetings</span>
            <div className="p-2 rounded-lg bg-gradient-to-br from-pink-400 to-pink-600 shadow-lg shadow-pink-500/25">
              <Calendar className="h-4 w-4 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            <AnimatedNumber value={24} />
          </p>
          <div className="flex items-center gap-1 mt-2">
            <Target className="h-4 w-4 text-violet-500" />
            <span className="text-sm text-gray-600">1% conversion</span>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-3 gap-6">
        {/* Email Trend Chart */}
        <div className="col-span-2 bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-gray-900">Email Activity Trend</h3>
              <p className="text-sm text-gray-500">Sent, opened, clicked, and replied over time</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-violet-500" />
                <span className="text-gray-600">Sent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-gray-600">Opened</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-gray-600">Clicked</span>
              </div>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={emailTrendData}>
                <defs>
                  <linearGradient id="colorSentAnalytics" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sent"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#colorSentAnalytics)"
                />
                <Line
                  type="monotone"
                  dataKey="opened"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: "#10b981", strokeWidth: 0, r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="clicked"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", strokeWidth: 0, r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Response Distribution */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900">Response Types</h3>
            <p className="text-sm text-gray-500">Distribution of reply outcomes</p>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={responseDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {responseDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {responseDistribution.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-gray-600">{item.name}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-2 gap-6">
        {/* Performance by Day */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-gray-900">Performance by Day</h3>
              <p className="text-sm text-gray-500">Best days to send emails</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700">Wednesday best</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceByDay} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Bar dataKey="openRate" name="Open Rate" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="clickRate" name="Click Rate" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="replyRate" name="Reply Rate" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Best Send Times */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-gray-900">Best Send Times</h3>
              <p className="text-sm text-gray-500">Open rate by hour of day</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 rounded-lg">
              <Clock className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-medium text-violet-700">9-11 AM peak</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyPerformance}>
                <defs>
                  <linearGradient id="colorHourly" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="hour"
                  stroke="#9ca3af"
                  fontSize={10}
                  interval={3}
                />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="opens"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#colorHourly)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Campaign Performance Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Campaign Performance</h3>
              <p className="text-sm text-gray-500">Compare performance across campaigns</p>
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">
                  Campaign
                </th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">
                  Emails Sent
                </th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">
                  Open Rate
                </th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">
                  Reply Rate
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">
                  Performance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaignPerformance.map((campaign) => (
                <tr key={campaign.name} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: campaign.color }}
                      />
                      <span className="font-medium text-gray-900">{campaign.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-gray-900 font-medium">
                      {campaign.sent.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-gray-900 font-medium">{campaign.openRate}%</span>
                      {campaign.openRate >= 45 ? (
                        <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-gray-900 font-medium">{campaign.replyRate}%</span>
                      {campaign.replyRate >= 5 ? (
                        <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-32">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${campaign.openRate}%`,
                            backgroundColor: campaign.color,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights Panel */}
      <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-2xl border border-violet-100 p-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25 flex-shrink-0">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-3">AI-Powered Insights</h3>
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-white/60 rounded-xl p-4 border border-violet-100">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-gray-900">Best Performing</span>
                </div>
                <p className="text-sm text-gray-600">
                  STEM Directors campaign has 6.8% reply rate - 42% above average. Consider similar targeting.
                </p>
              </div>
              <div className="bg-white/60 rounded-xl p-4 border border-violet-100">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-violet-600" />
                  <span className="text-sm font-medium text-gray-900">Optimal Timing</span>
                </div>
                <p className="text-sm text-gray-600">
                  Emails sent on Wednesday at 9-10 AM have 35% higher open rates. Schedule sends accordingly.
                </p>
              </div>
              <div className="bg-white/60 rounded-xl p-4 border border-violet-100">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-gray-900">Quick Win</span>
                </div>
                <p className="text-sm text-gray-600">
                  UK Boarding campaign has good open rates but lower replies. Try personalizing subject lines.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
