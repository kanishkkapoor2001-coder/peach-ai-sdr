"use client";

import { Sidebar } from "@/components/sidebar";
import { ChatWidget } from "@/components/chatbot/chat-widget";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50">
        {children}
      </main>
      <ChatWidget />
    </div>
  );
}
