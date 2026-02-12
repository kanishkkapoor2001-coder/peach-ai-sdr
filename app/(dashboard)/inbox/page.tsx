/**
 * INBOX PAGE - LOCKED FUNCTIONALITY
 * ==================================
 *
 * KEY BEHAVIOR (DO NOT CHANGE WITHOUT EXPLICIT REQUEST):
 *
 * 1. FAST LOADING: Messages load instantly from database (fetchMessages)
 *    - No IMAP blocking on initial load
 *    - Uses /api/inbox endpoint
 *
 * 2. BACKGROUND SYNC: IMAP polling happens in background (pollForNewEmails)
 *    - 30 second cooldown between polls (POLL_COOLDOWN)
 *    - Uses /api/inbox/sync endpoint (POST)
 *    - Errors are logged but don't disrupt UX
 *
 * 3. REFRESH BUTTON: Force syncs (bypasses cooldown)
 *    - Calls pollForNewEmails(true) to force
 *    - Shows spinner during both loading and polling
 *
 * 4. LOAD ORDER: On mount/filter change:
 *    a) fetchMessages() runs immediately (fast DB fetch)
 *    b) pollForNewEmails() runs after 500ms delay (background sync)
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  Inbox,
  Send,
  Archive,
  Trash2,
  Reply,
  Star,
  Sparkles,
  RefreshCw,
  CheckCircle,
  Calendar,
  AlertCircle,
  Clock,
} from "lucide-react";

interface InboxMessage {
  id: string;
  leadId: string;
  direction: "inbound" | "outbound";
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  aiDraftReply?: string;
  aiDraftApproved?: boolean;
  isRead: boolean;
  receivedAt: string;
  lead?: {
    firstName: string;
    lastName: string;
    email?: string;
    schoolName: string;
    jobTitle: string;
  };
  meetingReadiness?: {
    readiness: "ready" | "maybe" | "not_ready";
    confidence: number;
    reason: string;
  };
  suggestMeeting?: boolean;
}

export default function InboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null);
  const [filter, setFilter] = useState<"all" | "unread" | "needs_reply">("all");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [draftReply, setDraftReply] = useState("");
  const [showReplyEditor, setShowReplyEditor] = useState(false);
  const { toast } = useToast();

  const [threadMessages, setThreadMessages] = useState<InboxMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);

  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingDuration, setMeetingDuration] = useState(30);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [showMeetingScheduler, setShowMeetingScheduler] = useState(false);
  const [autoMeeting, setAutoMeeting] = useState<{ date: string; time: string; duration: number; title: string } | null>(null);

  const [polling, setPolling] = useState(false);
  const [lastPollTime, setLastPollTime] = useState<number>(0);

  // Fast database fetch - no IMAP, instant results
  const fetchMessages = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (filter === "unread") params.set("unread", "true");
      if (filter === "needs_reply") params.set("needsReply", "true");

      const response = await fetch(`/api/inbox?${params.toString()}`);
      const data = await response.json();

      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (error) {
      toast({
        title: "Failed to load messages",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // IMAP poll - only runs if enough time has passed (30 second cooldown)
  const pollForNewEmails = async (force = false) => {
    const now = Date.now();
    const POLL_COOLDOWN = 30_000; // 30 seconds minimum between polls

    if (!force && now - lastPollTime < POLL_COOLDOWN) {
      console.log("[Inbox] Skipping poll - cooldown active");
      return;
    }

    setPolling(true);
    setLastPollTime(now);

    try {
      // Use the correct endpoint for syncing SMTP inboxes
      const pollRes = await fetch("/api/inbox/sync", { method: "POST" });
      const pollData = await pollRes.json();

      // Handle errors from the API - don't disrupt UX
      if (pollData.errors && pollData.errors.length > 0) {
        console.error("[Inbox] Sync errors:", pollData.errors);
      }

      if (pollData.newMessages > 0) {
        toast({
          title: `${pollData.newMessages} new ${pollData.newMessages === 1 ? "reply" : "replies"} found`,
        });
        await fetchMessages();
      }
    } catch (err) {
      // Network error - log but don't disrupt UX
      console.error("[Inbox] IMAP sync failed:", err);
    } finally {
      setPolling(false);
    }
  };

  const fetchThread = async (leadId: string, subject?: string) => {
    setLoadingThread(true);
    try {
      const params = new URLSearchParams({ thread: leadId });
      if (subject) {
        params.set("threadSubject", subject);
      }
      const response = await fetch(`/api/inbox?${params.toString()}`);
      const data = await response.json();
      if (data.messages) {
        setThreadMessages(data.messages);
      }
    } catch (error) {
      console.error("Failed to load thread:", error);
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    // Load cached messages from database first (fast)
    fetchMessages();
    // Then poll IMAP in background with small delay
    const pollTimeout = setTimeout(() => pollForNewEmails(), 500);
    return () => clearTimeout(pollTimeout);
  }, [filter]);

  useEffect(() => {
    if (selectedMessage?.leadId) {
      fetchThread(selectedMessage.leadId, selectedMessage.subject);
    } else {
      setThreadMessages([]);
    }
  }, [selectedMessage?.id]);

  useEffect(() => {
    if (selectedMessage && !selectedMessage.isRead) {
      fetch(`/api/inbox/${selectedMessage.id}/read`, {
        method: "POST",
      }).then(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === selectedMessage.id ? { ...m, isRead: true } : m
          )
        );
      });
    }

    if (selectedMessage?.aiDraftReply) {
      setDraftReply(selectedMessage.aiDraftReply);
    } else {
      setDraftReply("");
    }
    setShowReplyEditor(false);

    setShowMeetingScheduler(false);
    setAutoMeeting(null);
    setMeetingDate("");
    setMeetingTime("");
    setMeetingDuration(30);
    setMeetingTitle("");
  }, [selectedMessage?.id]);

  const handleGenerateReply = async () => {
    if (!selectedMessage) return;

    setGenerating(true);
    try {
      const response = await fetch(`/api/inbox/${selectedMessage.id}/draft`, {
        method: "POST",
      });
      const data = await response.json();

      if (data.draft) {
        setDraftReply(data.draft);
        setShowReplyEditor(true);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === selectedMessage.id
              ? { ...m, aiDraftReply: data.draft, meetingReadiness: data.meetingReadiness, suggestMeeting: data.suggestMeeting }
              : m
          )
        );
        setSelectedMessage((prev) =>
          prev ? { ...prev, aiDraftReply: data.draft, meetingReadiness: data.meetingReadiness, suggestMeeting: data.suggestMeeting } : null
        );

        if (data.suggestMeeting) {
          setShowMeetingScheduler(true);
          if (data.suggestedMeeting) {
            setMeetingDate(data.suggestedMeeting.date);
            setMeetingTime(data.suggestedMeeting.time);
            setMeetingDuration(data.suggestedMeeting.duration);
            setMeetingTitle(data.suggestedMeeting.title);
            setAutoMeeting(data.suggestedMeeting);
          } else if (selectedMessage.lead) {
            setMeetingTitle(`Call with ${selectedMessage.lead.firstName} ${selectedMessage.lead.lastName}`);
          }
        }
      }
    } catch (error) {
      toast({
        title: "Failed to generate reply",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedMessage || !draftReply.trim()) return;

    setSending(true);
    try {
      const payload: Record<string, unknown> = { body: draftReply };

      const mDate = meetingDate || autoMeeting?.date;
      const mTime = meetingTime || autoMeeting?.time;
      if ((showMeetingScheduler || autoMeeting) && mDate && mTime) {
        const meetingDateTime = new Date(`${mDate}T${mTime}`);
        payload.meetingTime = meetingDateTime.toISOString();
        payload.meetingDuration = meetingDuration || autoMeeting?.duration || 30;
        payload.meetingTitle = meetingTitle || autoMeeting?.title || `Call with ${selectedMessage.lead?.firstName} ${selectedMessage.lead?.lastName}`;
      }

      const response = await fetch(`/api/inbox/${selectedMessage.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        if (selectedMessage.leadId) {
          fetchThread(selectedMessage.leadId, selectedMessage.subject);
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === selectedMessage.id ? { ...m, aiDraftApproved: true } : m
          )
        );
        setDraftReply("");
        setShowReplyEditor(false);
        setShowMeetingScheduler(false);
        setAutoMeeting(null);

        if (data.meetingCreated) {
          toast({ title: "Reply sent with calendar invite" });
        } else {
          toast({ title: "Reply sent successfully" });
        }
      }
    } catch (error) {
      toast({
        title: "Failed to send reply",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const hasMeetingScheduled = showMeetingScheduler && meetingDate && meetingTime;
  const filteredMessages = messages;
  const unreadCount = messages.filter((m) => !m.isRead).length;

  return (
    <TooltipProvider>
    <div className="flex h-[calc(100vh-2rem)]">
      <div className="w-96 border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Inbox</h1>
              <p className="text-sm text-gray-500 mt-1">
                {polling ? "Checking Gmail for new replies..." : unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { fetchMessages(); pollForNewEmails(true); }}
                  disabled={loading || polling}
                  aria-label="Refresh messages"
                >
                  <RefreshCw className={`h-4 w-4 ${loading || polling ? "animate-spin" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="p-3 border-b flex gap-2">
          {(["all", "unread", "needs_reply"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                filter === f
                  ? "bg-peach-100 text-peach-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {f === "needs_reply" ? "Needs Reply" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="h-6 w-6 text-gray-400 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading messages...</p>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Inbox className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="font-medium text-gray-900 mb-2">
                No messages yet
              </h3>
              <p className="text-sm text-gray-500">
                Replies to your outreach will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredMessages.map((message) => (
                <button
                  key={message.id}
                  onClick={() => setSelectedMessage(message)}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                    selectedMessage?.id === message.id ? "bg-peach-50" : ""
                  } ${!message.isRead ? "bg-blue-50/50" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-600 font-medium text-sm">
                        {message.lead?.firstName?.[0]}
                        {message.lead?.lastName?.[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p
                          className={`font-medium truncate ${
                            !message.isRead ? "text-gray-900" : "text-gray-600"
                          }`}
                        >
                          {message.lead?.firstName} {message.lead?.lastName}
                        </p>
                        <span className="text-xs text-gray-400">
                          {new Date(message.receivedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate" title={message.lead?.schoolName}>
                        {message.lead?.schoolName}
                      </p>
                      <p className="text-sm text-gray-600 truncate mt-1" title={message.subject}>
                        {message.subject}
                      </p>
                      <p className="text-xs text-gray-400 truncate" title={message.body?.substring(0, 200)}>
                        {message.body?.substring(0, 80)}...
                      </p>
                      {message.aiDraftApproved && (
                        <div className="flex items-center gap-1 mt-1">
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          <span className="text-xs text-green-600">Replied</span>
                        </div>
                      )}
                      {!message.aiDraftApproved && message.meetingReadiness?.readiness === "ready" && (
                        <div className="flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3 text-green-600" />
                          <span className="text-xs text-green-600">Ready to book</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 bg-gray-50 flex flex-col">
        {selectedMessage ? (
          <>
            <div className="bg-white border-b p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedMessage.subject}
                  </h2>
                  <p className="text-sm text-gray-500">
                    From: {selectedMessage.lead?.firstName} {selectedMessage.lead?.lastName}{" "}
                    &lt;{selectedMessage.fromEmail}&gt;
                  </p>
                  <p className="text-xs text-gray-400">
                    {selectedMessage.lead?.jobTitle} at {selectedMessage.lead?.schoolName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Star message">
                        <Star className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Star</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Archive">
                        <Archive className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Archive</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {loadingThread ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-5 w-5 text-gray-400 animate-spin" />
                </div>
              ) : threadMessages.length > 0 ? (
                <div className="space-y-4 max-w-3xl">
                  {threadMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-lg border p-4 ${
                        msg.direction === "outbound"
                          ? "bg-purple-50 border-purple-200 ml-8"
                          : "bg-white mr-8"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-gray-500">
                          {msg.direction === "outbound" ? (
                            <span className="text-purple-700">You</span>
                          ) : (
                            <span>{msg.lead?.firstName} {msg.lead?.lastName}</span>
                          )}
                          {" "}
                          <span className="text-gray-400">
                            &lt;{msg.fromEmail}&gt;
                          </span>
                        </p>
                        <span className="text-xs text-gray-400">
                          {new Date(msg.receivedAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {msg.subject && msg.direction === "outbound" && (
                        <p className="text-xs text-gray-500 mb-1">{msg.subject}</p>
                      )}
                      <div className="prose prose-sm max-w-none">
                        <p className="whitespace-pre-wrap text-sm">{msg.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-lg border p-6 max-w-3xl">
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap">{selectedMessage.body}</p>
                  </div>
                </div>
              )}

              {selectedMessage.meetingReadiness?.readiness === "ready" && (
                <div className="mt-4 bg-green-50 rounded-lg border border-green-200 p-4 max-w-3xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-900">
                      Ready to Book Meeting
                    </span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      {Math.round(selectedMessage.meetingReadiness.confidence * 100)}% confident
                    </span>
                  </div>
                  <p className="text-sm text-green-800">
                    {selectedMessage.meetingReadiness.reason}
                  </p>
                </div>
              )}

              {selectedMessage.meetingReadiness?.readiness === "maybe" && (
                <div className="mt-4 bg-yellow-50 rounded-lg border border-yellow-200 p-4 max-w-3xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium text-yellow-900">
                      Might Be Ready for a Call
                    </span>
                  </div>
                  <p className="text-sm text-yellow-800">
                    {selectedMessage.meetingReadiness.reason}
                  </p>
                </div>
              )}

              {showMeetingScheduler && (
                <div className="mt-4 bg-blue-50 rounded-lg border border-blue-200 p-4 max-w-3xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-900">Schedule Meeting</span>
                    <button
                      onClick={() => {
                        setShowMeetingScheduler(false);
                        setAutoMeeting(null);
                        setMeetingDate("");
                        setMeetingTime("");
                      }}
                      className="ml-auto text-xs text-blue-600 hover:text-blue-800"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-blue-800 mb-1">Date</label>
                      <input
                        type="date"
                        value={meetingDate}
                        onChange={(e) => setMeetingDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-800 mb-1">Time</label>
                      <input
                        type="time"
                        value={meetingTime}
                        onChange={(e) => setMeetingTime(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-800 mb-1">Duration</label>
                      <select
                        value={meetingDuration}
                        onChange={(e) => setMeetingDuration(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={45}>45 minutes</option>
                        <option value={60}>1 hour</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-800 mb-1">Title</label>
                      <input
                        type="text"
                        value={meetingTitle}
                        onChange={(e) => setMeetingTitle(e.target.value)}
                        placeholder={`Call with ${selectedMessage.lead?.firstName || ""}`}
                        className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                  </div>
                  {meetingDate && meetingTime && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-blue-700">
                      <Clock className="h-4 w-4" />
                      <span>
                        {new Date(`${meetingDate}T${meetingTime}`).toLocaleString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {" "}({meetingDuration} min)
                      </span>
                    </div>
                  )}
                </div>
              )}

              {(showReplyEditor || selectedMessage.aiDraftReply) && (
                <div className="mt-6 bg-purple-50 rounded-lg border border-purple-200 p-6 max-w-3xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    <span className="font-medium text-purple-900">
                      {showReplyEditor ? "Edit Reply" : "AI Draft Reply"}
                    </span>
                  </div>
                  {showReplyEditor ? (
                    <textarea
                      value={draftReply}
                      onChange={(e) => setDraftReply(e.target.value)}
                      className="w-full h-48 p-3 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Write your reply..."
                    />
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedMessage.aiDraftReply}
                    </p>
                  )}
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      onClick={handleSendReply}
                      disabled={sending || !draftReply.trim()}
                      className={hasMeetingScheduled ? "bg-blue-600 hover:bg-blue-700" : ""}
                    >
                      {sending ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : hasMeetingScheduled ? (
                        <Calendar className="h-4 w-4 mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      {hasMeetingScheduled ? "Send with Calendar Invite" : "Send Reply"}
                    </Button>
                    {!showReplyEditor ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowReplyEditor(true)}
                      >
                        Edit Draft
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowReplyEditor(false);
                          setDraftReply(selectedMessage.aiDraftReply || "");
                        }}
                      >
                        Cancel Edit
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white border-t p-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleGenerateReply}
                  disabled={generating}
                >
                  {generating ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate AI Reply
                </Button>
                <Button onClick={() => setShowReplyEditor(true)}>
                  <Reply className="h-4 w-4 mr-2" />
                  Compose Reply
                </Button>
                {!showMeetingScheduler && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setShowMeetingScheduler(true);
                          if (selectedMessage.lead) {
                            setMeetingTitle(`Call with ${selectedMessage.lead.firstName} ${selectedMessage.lead.lastName}`);
                          }
                        }}
                        aria-label="Schedule meeting"
                      >
                        <Calendar className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Schedule Meeting</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Inbox className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Select a message to view</p>
            </div>
          </div>
        )}
      </div>
    </div>
    </TooltipProvider>
  );
}
