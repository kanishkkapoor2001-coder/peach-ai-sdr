"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Mail,
  MessageSquare,
  Calendar,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Sparkles,
  Send,
  Eye,
  MousePointerClick,
  Zap,
  Target,
  Activity,
  ChevronRight,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Types
interface DashboardStats {
  leads: { total: number; change: number };
  emailsSent: { total: number; change: number };
  replies: { total: number; change: number };
  meetings: { total: number; change: number };
  openRate: number;
  clickRate: number;
  replyRate: number;
}

interface ChartData {
  name: string;
  sent: number;
  opened: number;
  clicked: number;
}

interface PipelineData {
  stage: string;
  count: number;
  color: string;
}

interface RecentActivity {
  id: string;
  type: "email_sent" | "reply" | "meeting" | "open";
  leadName: string;
  time: string;
}

// Animated counter component
function AnimatedNumber({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setDisplayValue(Math.floor(progress * value));
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return <span className="tabular-nums">{displayValue.toLocaleString()}</span>;
}

// Stat Card Component
function StatCard({
  title,
  value,
  change,
  icon: Icon,
  gradient,
}: {
  title: string;
  value: number;
  change: number;
  icon: React.ElementType;
  gradient: string;
}) {
  const isPositive = change >= 0;

  return (
    <div className="stat-card group">
      <div className="flex items-start justify-between">
        <div
          className={`p-3 rounded-xl ${gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            isPositive
              ? "bg-emerald-50 text-emerald-600"
              : "bg-red-50 text-red-600"
          }`}
        >
          {isPositive ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {Math.abs(change)}%
        </div>
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold text-gray-900">
          <AnimatedNumber value={value} />
        </p>
        <p className="text-sm text-gray-500 mt-1">{title}</p>
      </div>
    </div>
  );
}

// Quick Action Card
function QuickActionCard({
  title,
  description,
  icon: Icon,
  href,
  gradient,
  badge,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  gradient: string;
  badge?: string;
}) {
  return (
    <Link href={href}>
      <div className="group relative overflow-hidden rounded-2xl border bg-white p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-xl ${gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}
          >
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 group-hover:text-violet-600 transition-colors">
                {title}
              </h3>
              {badge && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-gradient-to-r from-violet-500 to-indigo-500 text-white rounded-full">
                  {badge}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-violet-500 group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [pipelineData, setPipelineData] = useState<PipelineData[]>([]);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch real data from the dashboard stats API
      const statsRes = await fetch("/api/dashboard/stats");
      const data = await statsRes.json();

      if (data.error) {
        console.error("Dashboard stats error:", data.error);
        // Set empty states on error
        setStats({
          leads: { total: 0, change: 0 },
          emailsSent: { total: 0, change: 0 },
          replies: { total: 0, change: 0 },
          meetings: { total: 0, change: 0 },
          openRate: 0,
          clickRate: 0,
          replyRate: 0,
        });
        setPipelineData([]);
        setActivities([]);
        setChartData([]);
        return;
      }

      // Set stats from real data (API returns nested structure)
      setStats({
        leads: {
          total: data.stats?.leads?.total ?? 0,
          change: data.stats?.leads?.change ?? 0
        },
        emailsSent: {
          total: data.stats?.emailsSent?.total ?? 0,
          change: data.stats?.emailsSent?.change ?? 0
        },
        replies: {
          total: data.stats?.replies?.total ?? 0,
          change: data.stats?.replies?.change ?? 0
        },
        meetings: {
          total: data.stats?.meetings?.total ?? 0,
          change: data.stats?.meetings?.change ?? 0
        },
        openRate: data.stats?.openRate ?? 0,
        clickRate: data.stats?.clickRate ?? 0,
        replyRate: data.stats?.replyRate ?? 0,
      });

      // Set pipeline data from real counts
      if (data.pipeline && data.pipeline.length > 0) {
        setPipelineData(data.pipeline);
      } else {
        setPipelineData([
          { stage: "New", count: 0, color: "#8b5cf6" },
          { stage: "Approved", count: 0, color: "#6366f1" },
          { stage: "Emailing", count: 0, color: "#3b82f6" },
          { stage: "Replied", count: 0, color: "#10b981" },
          { stage: "Meeting", count: 0, color: "#f59e0b" },
        ]);
      }

      // Set recent activities from real data
      if (data.recentActivity && data.recentActivity.length > 0) {
        setActivities(data.recentActivity);
      } else {
        setActivities([]);
      }

      // Generate chart data from daily stats if available
      if (data.dailyStats && data.dailyStats.length > 0) {
        setChartData(data.dailyStats);
      } else {
        // Empty chart data when no activity
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        setChartData(days.map((day) => ({
          name: day,
          sent: 0,
          opened: 0,
          clicked: 0,
        })));
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      // Set empty states on error
      setStats({
        leads: { total: 0, change: 0 },
        emailsSent: { total: 0, change: 0 },
        replies: { total: 0, change: 0 },
        meetings: { total: 0, change: 0 },
        openRate: 0,
        clickRate: 0,
        replyRate: 0,
      });
      setPipelineData([]);
      setActivities([]);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-violet-100 border-t-violet-500 animate-spin mx-auto" />
            <Sparkles className="h-6 w-6 text-violet-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-gray-500 mt-4">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back! 👋
          </h1>
          <p className="text-gray-500 mt-1">
            Here&apos;s what&apos;s happening with your outreach today
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/campaigns/new">
            <Button className="gap-2 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 shadow-lg shadow-violet-500/25">
              <Zap className="h-4 w-4" />
              New Campaign
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Leads"
          value={stats?.leads.total || 0}
          change={stats?.leads.change || 0}
          icon={Users}
          gradient="bg-gradient-to-br from-violet-500 to-purple-600"
        />
        <StatCard
          title="Emails Sent"
          value={stats?.emailsSent.total || 0}
          change={stats?.emailsSent.change || 0}
          icon={Send}
          gradient="bg-gradient-to-br from-blue-500 to-cyan-500"
        />
        <StatCard
          title="Replies"
          value={stats?.replies.total || 0}
          change={stats?.replies.change || 0}
          icon={MessageSquare}
          gradient="bg-gradient-to-br from-emerald-500 to-teal-500"
        />
        <StatCard
          title="Meetings Booked"
          value={stats?.meetings.total || 0}
          change={stats?.meetings.change || 0}
          icon={Calendar}
          gradient="bg-gradient-to-br from-orange-500 to-amber-500"
        />
      </div>

      {/* Performance Metrics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-violet-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <p className="text-white/80 text-sm">Open Rate</p>
              <p className="text-2xl font-bold">{stats?.openRate || 0}%</p>
            </div>
          </div>
          <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-1000"
              style={{ width: `${stats?.openRate || 0}%` }}
            />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <MousePointerClick className="h-5 w-5" />
            </div>
            <div>
              <p className="text-white/80 text-sm">Click Rate</p>
              <p className="text-2xl font-bold">{stats?.clickRate || 0}%</p>
            </div>
          </div>
          <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-1000"
              style={{ width: `${stats?.clickRate || 0}%` }}
            />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <p className="text-white/80 text-sm">Reply Rate</p>
              <p className="text-2xl font-bold">{stats?.replyRate || 0}%</p>
            </div>
          </div>
          <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-1000"
              style={{ width: `${stats?.replyRate || 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Email Activity Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Email Activity</h2>
              <p className="text-sm text-gray-500">Last 7 days performance</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-violet-500" />
                <span className="text-xs text-gray-500">Sent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-xs text-gray-500">Opened</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-xs text-gray-500">Clicked</span>
              </div>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorClicked" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
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
                  fillOpacity={1}
                  fill="url(#colorSent)"
                />
                <Area
                  type="monotone"
                  dataKey="opened"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorOpened)"
                />
                <Area
                  type="monotone"
                  dataKey="clicked"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorClicked)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pipeline Overview */}
        <div className="bg-white rounded-2xl border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Pipeline</h2>
            <Link href="/leads" className="text-sm text-violet-600 hover:text-violet-700 flex items-center gap-1">
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-4">
            {pipelineData.map((item) => (
              <div key={item.stage} className="group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-gray-600">{item.stage}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{item.count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 group-hover:opacity-80"
                    style={{
                      backgroundColor: item.color,
                      width: `${(item.count / 50) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Total in pipeline</span>
              <span className="font-semibold text-gray-900">
                {pipelineData.reduce((sum, item) => sum + item.count, 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <QuickActionCard
              title="Source New Leads"
              description="Find prospects with AI-powered search"
              icon={Target}
              href="/leads"
              gradient="bg-gradient-to-br from-violet-500 to-purple-600"
            />
            <QuickActionCard
              title="Write AI Emails"
              description="Generate personalized outreach sequences"
              icon={Sparkles}
              href="/sequences"
              gradient="bg-gradient-to-br from-blue-500 to-cyan-500"
              badge="AI"
            />
            <QuickActionCard
              title="Check Inbox"
              description="Review and respond to lead replies"
              icon={MessageSquare}
              href="/inbox"
              gradient="bg-gradient-to-br from-emerald-500 to-teal-500"
            />
            <QuickActionCard
              title="View Deliverability"
              description="Monitor email health and warmup status"
              icon={Activity}
              href="/deliverability"
              gradient="bg-gradient-to-br from-orange-500 to-amber-500"
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            <span className="px-2 py-1 text-xs font-medium bg-emerald-50 text-emerald-600 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Live
            </span>
          </div>
          <div className="space-y-4">
            {activities.length > 0 ? (
              activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div
                    className={`p-2 rounded-lg ${
                      activity.type === "email_sent"
                        ? "bg-blue-100 text-blue-600"
                        : activity.type === "open"
                        ? "bg-violet-100 text-violet-600"
                        : activity.type === "reply"
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-orange-100 text-orange-600"
                    }`}
                  >
                    {activity.type === "email_sent" && <Send className="h-4 w-4" />}
                    {activity.type === "open" && <Eye className="h-4 w-4" />}
                    {activity.type === "reply" && <MessageSquare className="h-4 w-4" />}
                    {activity.type === "meeting" && <Calendar className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.type === "email_sent" && "Email sent to"}
                      {activity.type === "open" && "Email opened by"}
                      {activity.type === "reply" && "Reply from"}
                      {activity.type === "meeting" && "Meeting with"}{" "}
                      <span className="text-violet-600">{activity.leadName}</span>
                    </p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No recent activity</p>
                <p className="text-sm text-gray-400">Start by sourcing some leads!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
