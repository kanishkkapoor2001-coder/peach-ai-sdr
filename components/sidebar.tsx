"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Users,
  Mail,
  Inbox,
  LayoutDashboard,
  Calendar,
  Settings,
  Database,
  History,
  Building2,
  Globe,
  Zap,
  Target,
  ChevronDown,
  Sparkles,
  BarChart3,
  BotMessageSquare,
  Lightbulb,
  Flame,
  LogOut,
  User,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "AI Agent", href: "/agent", icon: BotMessageSquare, badge: "New" },
  { name: "Campaigns", href: "/campaigns", icon: Zap, badge: "3" },
  { name: "Leads", href: "/leads", icon: Users },
  { name: "Sequences", href: "/sequences", icon: Mail },
  { name: "Inbox", href: "/inbox", icon: Inbox },
  { name: "CRM Sync", href: "/crm", icon: Database },
  { name: "Meetings", href: "/meetings", icon: Calendar },
  { name: "Meeting Insights", href: "/meetings/insights", icon: Lightbulb },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Warmup", href: "/warmup", icon: Flame, badge: "New" },
];

const settingsNavigation = [
  { name: "Company Setup", href: "/settings/company", icon: Building2 },
  { name: "Sending Domains", href: "/settings/domains", icon: Globe },
  { name: "Email Settings", href: "/settings", icon: Settings },
  { name: "Notion CRM", href: "/settings/notion", icon: Database },
  { name: "Lead Scoring", href: "/settings/scoring", icon: Target },
  { name: "Calendly", href: "/settings/calendly", icon: Calendar },
  { name: "Email History", href: "/settings/email-history", icon: History },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [companyName, setCompanyName] = useState<string>("AI SDR");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    // Fetch company name from API
    fetch("/api/company")
      .then((res) => res.json())
      .then((data) => {
        if (data.company?.companyName) {
          setCompanyName(data.company.companyName);
        }
      })
      .catch(() => {
        // Keep default if fetch fails
      });

    // Open settings if currently on a settings page
    if (pathname.startsWith("/settings")) {
      setSettingsOpen(true);
    }
  }, [pathname]);

  const isNavActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  };

  return (
    <div className="flex h-full w-64 flex-col bg-white border-r border-gray-200/80">
      {/* Logo */}
      <div className="flex h-16 items-center px-5 border-b border-gray-200/80">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25 group-hover:shadow-violet-500/40 transition-shadow">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-emerald-400 rounded-full border-2 border-white" />
          </div>
          <div>
            <span className="font-bold text-gray-900 text-lg tracking-tight">{companyName}</span>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">AI Sales Agent</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="mb-2">
          <p className="px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Main
          </p>
          {navigation.map((item) => {
            const isActive = isNavActive(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-violet-500/10 to-indigo-500/10 text-violet-700 shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive && "text-violet-600")} />
                <span className="flex-1">{item.name}</span>
                {item.badge && (
                  <span
                    className={cn(
                      "px-2 py-0.5 text-[10px] font-bold rounded-full",
                      item.badge === "New"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-violet-100 text-violet-700"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Settings Section */}
      <div className="border-t border-gray-200/80 p-3">
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200",
            settingsOpen || pathname.startsWith("/settings")
              ? "bg-gray-100 text-gray-900"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          )}
        >
          <Settings className="h-5 w-5" />
          <span className="flex-1 text-left">Settings</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              settingsOpen && "rotate-180"
            )}
          />
        </button>

        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            settingsOpen ? "max-h-96 opacity-100 mt-1" : "max-h-0 opacity-0"
          )}
        >
          <div className="space-y-0.5 pl-2">
            {settingsNavigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-violet-50 text-violet-700"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* User Profile Section */}
      <div className="border-t border-gray-200/80 p-3">
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl hover:bg-gray-100 transition-all duration-200"
          >
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white text-sm font-semibold">
              {session?.user?.name?.[0]?.toUpperCase() || session?.user?.email?.[0]?.toUpperCase() || <User className="h-4 w-4" />}
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-gray-900 truncate">
                {session?.user?.name || session?.user?.email?.split("@")[0] || "User"}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {session?.user?.email || ""}
              </p>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-gray-400 transition-transform duration-200",
                userMenuOpen && "rotate-180"
              )}
            />
          </button>

          {/* User dropdown menu */}
          {userMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
