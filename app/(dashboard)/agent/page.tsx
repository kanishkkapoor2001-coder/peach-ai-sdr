"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Loader2,
  Sparkles,
  Bot,
  User,
  CheckCircle2,
  Circle,
  AlertCircle,
  RotateCcw,
  Settings,
  Zap,
  Users,
  Mail,
  Database,
  Calendar,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  actions?: AgentAction[];
}

interface AgentAction {
  id: string;
  type: "navigate" | "create" | "update" | "delete" | "send" | "search" | "analyze";
  description: string;
  status: "pending" | "running" | "completed" | "failed" | "waiting_approval";
  target?: string;
  result?: string;
  error?: string;
}

interface AgentCapability {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  examples: string[];
}

const AGENT_CAPABILITIES: AgentCapability[] = [
  {
    id: "campaigns",
    name: "Campaign Management",
    description: "Create, manage, and analyze email campaigns",
    icon: Zap,
    examples: [
      "Create a new campaign targeting EdTech decision makers",
      "Show me my best performing campaigns",
      "Pause the campaign that has the lowest open rate",
    ],
  },
  {
    id: "leads",
    name: "Lead Operations",
    description: "Import, search, enrich, and manage leads",
    icon: Users,
    examples: [
      "Import leads from my CSV file",
      "Find all leads from IB schools in Southeast Asia",
      "Enrich leads that are missing company information",
    ],
  },
  {
    id: "emails",
    name: "Email Automation",
    description: "Generate, schedule, and send personalized emails",
    icon: Mail,
    examples: [
      "Generate email sequences for my new leads",
      "Show me emails that got replies",
      "Draft a follow-up email for leads who opened but didn't reply",
    ],
  },
  {
    id: "crm",
    name: "CRM Management",
    description: "Track contacts, update stages, and manage relationships",
    icon: Database,
    examples: [
      "Move all qualified leads to the next stage",
      "Show me contacts that haven't been contacted in 2 weeks",
      "Add notes to contacts who had meetings this week",
    ],
  },
  {
    id: "meetings",
    name: "Meeting Intelligence",
    description: "Analyze meetings and extract insights",
    icon: Calendar,
    examples: [
      "Show me insights from my recent meetings",
      "Find meetings where interest was shown",
      "Create follow-up tasks for meetings with action items",
    ],
  },
];

const SUGGESTED_PROMPTS = [
  "Create a new outreach campaign for tech startups",
  "Show me all leads that replied positively",
  "Generate email sequences for my uncontacted leads",
  "What are my top performing email subjects?",
  "Find contacts who are ready for a meeting",
];

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentActions, setCurrentActions] = useState<AgentAction[]>([]);
  const [showCapabilities, setShowCapabilities] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentActions]);

  useEffect(() => {
    if (!isProcessing) {
      inputRef.current?.focus();
    }
  }, [isProcessing]);

  const sendToAgent = async (userContent: string, allMessages: Message[]) => {
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({
            role: m.role === "system" ? "user" : m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get agent response");
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Agent error:", error);
      throw error;
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userContent = input.trim();
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userContent,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsProcessing(true);
    setShowCapabilities(false);

    // Show initial processing action
    const analyzeAction: AgentAction = {
      id: `action-${Date.now()}-analyze`,
      type: "analyze",
      description: "Understanding your request...",
      status: "running",
    };
    setCurrentActions([analyzeAction]);

    try {
      // Get response from agent API
      const data = await sendToAgent(userContent, updatedMessages);

      // Update analyzing action to complete
      setCurrentActions((prev) =>
        prev.map((a) =>
          a.id === analyzeAction.id
            ? { ...a, status: "completed" as const, description: "Request analyzed" }
            : a
        )
      );

      // Add any additional actions from the response
      if (data.actions && data.actions.length > 0) {
        await new Promise((r) => setTimeout(r, 300));
        setCurrentActions((prev) => [...prev, ...data.actions]);
      }

      // Wait a moment for animation
      await new Promise((r) => setTimeout(r, 500));

      // Create assistant message
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.message || "I understand your request. How can I help further?",
        timestamp: new Date(),
        actions: [
          { ...analyzeAction, status: "completed" as const, description: "Request analyzed" },
          ...(data.actions || []),
        ],
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setCurrentActions([]);
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content:
          "I apologize, but I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setCurrentActions([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  const handleApproveAction = async (actionId: string) => {
    // TODO: Implement action approval
    console.log("Approving action:", actionId);
  };

  const handleClearChat = () => {
    setMessages([]);
    setShowCapabilities(true);
    setCurrentActions([]);
  };

  const getActionIcon = (action: AgentAction) => {
    switch (action.status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "running":
        return <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "waiting_approval":
        return <Circle className="w-4 h-4 text-amber-500 fill-amber-500" />;
      default:
        return <Circle className="w-4 h-4 text-gray-300" />;
    }
  };

  const renderMessageContent = (content: string, isUser: boolean) => {
    // Simple markdown-like rendering
    const lines = content.split("\n");

    return (
      <div className={`text-sm leading-relaxed ${isUser ? "" : "prose prose-sm max-w-none"}`}>
        {lines.map((line, i) => {
          // Bold headers
          if (line.startsWith("## ")) {
            return (
              <h3 key={i} className="font-bold text-base mt-4 first:mt-0 mb-2">
                {line.substring(3)}
              </h3>
            );
          }
          if (line.startsWith("**") && line.endsWith("**")) {
            return (
              <p key={i} className="font-semibold mt-3 first:mt-0">
                {line.replace(/\*\*/g, "")}
              </p>
            );
          }
          // Bold inline
          if (line.includes("**")) {
            const parts = line.split(/\*\*(.+?)\*\*/g);
            return (
              <p key={i}>
                {parts.map((part, j) =>
                  j % 2 === 1 ? (
                    <strong key={j}>{part}</strong>
                  ) : (
                    <span key={j}>{part}</span>
                  )
                )}
              </p>
            );
          }
          // List items
          if (line.startsWith("- ")) {
            return (
              <p key={i} className="ml-4 flex items-start gap-2">
                <span className="text-violet-500 mt-1.5">•</span>
                <span>{line.substring(2)}</span>
              </p>
            );
          }
          // Numbered list
          if (line.match(/^\d+\.\s/)) {
            return (
              <p key={i} className="ml-4">
                {line}
              </p>
            );
          }
          // Empty line
          if (!line.trim()) {
            return <br key={i} />;
          }
          // Regular paragraph
          return <p key={i}>{line}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">AI Sales Agent</h1>
                <p className="text-xs text-gray-500">
                  {isProcessing ? (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse" />
                      Working...
                    </span>
                  ) : (
                    "Ready to help"
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearChat}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
              title="Clear conversation"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <Link
              href="/settings"
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
            >
              <Settings className="w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {/* Welcome State */}
          {messages.length === 0 && showCapabilities && (
            <div className="max-w-4xl mx-auto px-6 py-12">
              <div className="text-center mb-12">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-violet-500/25">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  What can I help you with?
                </h2>
                <p className="text-gray-500 max-w-md mx-auto">
                  I'm your AI sales agent. Tell me what you want to accomplish
                  and I'll handle the details.
                </p>
              </div>

              {/* Capabilities Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
                {AGENT_CAPABILITIES.map((capability) => (
                  <div
                    key={capability.id}
                    className="p-5 rounded-2xl bg-white border border-gray-200 hover:border-violet-300 hover:shadow-lg transition-all duration-200 group cursor-pointer"
                    onClick={() => handleSuggestionClick(capability.examples[0])}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 flex items-center justify-center group-hover:from-violet-500/20 group-hover:to-indigo-500/20 transition-colors">
                        <capability.icon className="w-5 h-5 text-violet-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {capability.name}
                        </h3>
                        <p className="text-sm text-gray-500 mb-3">
                          {capability.description}
                        </p>
                        <p className="text-xs text-violet-600 font-medium">
                          "{capability.examples[0]}"
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Suggestions */}
              <div className="text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                  Quick Actions
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTED_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(prompt)}
                      className="px-4 py-2 rounded-full bg-white border border-gray-200 text-sm text-gray-700 hover:border-violet-300 hover:bg-violet-50 transition-all duration-200"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-4 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[70%] ${
                      message.role === "user" ? "order-first" : ""
                    }`}
                  >
                    {/* Actions Log */}
                    {message.role === "assistant" &&
                      message.actions &&
                      message.actions.length > 0 && (
                        <div className="mb-3 p-4 rounded-xl bg-gray-100/80 border border-gray-200">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            Actions Performed
                          </p>
                          <div className="space-y-2">
                            {message.actions.map((action) => (
                              <div
                                key={action.id}
                                className="flex items-start gap-3"
                              >
                                {getActionIcon(action)}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-700">
                                    {action.description}
                                  </p>
                                  {action.result && (
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {action.result}
                                    </p>
                                  )}
                                  {action.status === "waiting_approval" && (
                                    <div className="flex items-center gap-2 mt-2">
                                      <button
                                        onClick={() =>
                                          handleApproveAction(action.id)
                                        }
                                        className="px-3 py-1 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 transition-colors"
                                      >
                                        Approve
                                      </button>
                                      <button className="px-3 py-1 rounded-lg bg-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-300 transition-colors">
                                        Modify
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Message Content */}
                    <div
                      className={`rounded-2xl px-5 py-4 ${
                        message.role === "user"
                          ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/20"
                          : "bg-white text-gray-800 shadow-sm border border-gray-100"
                      }`}
                    >
                      {renderMessageContent(
                        message.content,
                        message.role === "user"
                      )}
                    </div>
                  </div>
                  {message.role === "user" && (
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-600" />
                    </div>
                  )}
                </div>
              ))}

              {/* Processing State */}
              {isProcessing && currentActions.length > 0 && (
                <div className="flex gap-4 justify-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="max-w-[70%]">
                    <div className="p-4 rounded-xl bg-gray-100/80 border border-gray-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Working on it...
                        </p>
                      </div>
                      <div className="space-y-2">
                        {currentActions.map((action) => (
                          <div
                            key={action.id}
                            className="flex items-start gap-3"
                          >
                            {getActionIcon(action)}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-700">
                                {action.description}
                              </p>
                              {action.result && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {action.result}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white p-4">
          <form
            onSubmit={handleSubmit}
            className="max-w-4xl mx-auto flex items-end gap-3"
          >
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tell me what you want to do..."
                rows={1}
                className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200
                  focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400
                  text-sm bg-gray-50 placeholder:text-gray-400 transition-all duration-200
                  resize-none min-h-[48px] max-h-[200px]"
                disabled={isProcessing}
                style={{
                  height: "48px",
                  overflowY: input.split("\n").length > 3 ? "auto" : "hidden",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white
                hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                flex items-center justify-center"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>
          <p className="text-center text-xs text-gray-400 mt-3">
            AI agent will ask for approval before taking important actions
          </p>
        </div>
      </div>
    </div>
  );
}
