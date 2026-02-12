"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Video,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  User,
  Building2,
  Mail,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
} from "lucide-react";

interface MeetingPrep {
  prospectSummary: string;
  talkingPoints: string[];
  objections: { objection: string; response: string }[];
  quickFacts: { label: string; value: string }[];
}

interface Meeting {
  id: string;
  leadId: string;
  scheduledAt: string;
  endTime: string | null;
  eventName: string | null;
  meetingUrl: string | null;
  prepDocument: MeetingPrep | null;
  calendlyEventUri: string | null;
  calendlyInviteeUri: string | null;
  status: "scheduled" | "completed" | "canceled" | "no_show";
  notes: string | null;
  outcome: string | null;
  createdAt: string;
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    schoolName: string;
    schoolCountry: string | null;
    jobTitle: string;
  };
}

interface Stats {
  total: number;
  scheduled: number;
  completed: number;
  canceled: number;
  no_show: number;
}

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
  canceled: "bg-red-50 text-red-700",
  no_show: "bg-orange-50 text-orange-700",
};

const statusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  canceled: "Canceled",
  no_show: "No Show",
};

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [filter, setFilter] = useState<"all" | "scheduled" | "completed" | "canceled" | "no_show">("all");
  const [stats, setStats] = useState<Stats>({ total: 0, scheduled: 0, completed: 0, canceled: 0, no_show: 0 });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    summary: true,
    talkingPoints: true,
    objections: false,
    quickFacts: false,
  });

  // Fetch meetings
  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);

      const response = await fetch(`/api/meetings?${params.toString()}`);
      const data = await response.json();

      if (data.meetings) {
        setMeetings(data.meetings);
      }
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch meetings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, [filter]);

  // When meeting is selected, populate notes/outcome
  useEffect(() => {
    if (selectedMeeting) {
      setNotes(selectedMeeting.notes || "");
      setOutcome(selectedMeeting.outcome || "");
    }
  }, [selectedMeeting]);

  // Update meeting status
  const updateMeetingStatus = async (status: string) => {
    if (!selectedMeeting) return;

    setUpdating(true);
    try {
      const response = await fetch("/api/meetings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: selectedMeeting.id,
          status,
          notes,
          outcome,
        }),
      });

      if (response.ok) {
        // Update local state
        setMeetings((prev) =>
          prev.map((m) =>
            m.id === selectedMeeting.id ? { ...m, status: status as Meeting["status"], notes, outcome } : m
          )
        );
        setSelectedMeeting((prev) =>
          prev ? { ...prev, status: status as Meeting["status"], notes, outcome } : null
        );
        fetchMeetings(); // Refresh stats
      }
    } catch (error) {
      console.error("Failed to update meeting:", error);
    } finally {
      setUpdating(false);
    }
  };

  // Save notes
  const saveNotes = async () => {
    if (!selectedMeeting) return;

    setUpdating(true);
    try {
      const response = await fetch("/api/meetings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: selectedMeeting.id,
          notes,
          outcome,
        }),
      });

      if (response.ok) {
        setMeetings((prev) =>
          prev.map((m) =>
            m.id === selectedMeeting.id ? { ...m, notes, outcome } : m
          )
        );
        setSelectedMeeting((prev) =>
          prev ? { ...prev, notes, outcome } : null
        );
      }
    } catch (error) {
      console.error("Failed to save notes:", error);
    } finally {
      setUpdating(false);
    }
  };

  // Cancel meeting
  const cancelMeeting = async () => {
    if (!selectedMeeting) return;

    if (!confirm("Are you sure you want to cancel this meeting?")) return;

    setUpdating(true);
    try {
      const response = await fetch(`/api/meetings?meetingId=${selectedMeeting.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setMeetings((prev) =>
          prev.map((m) =>
            m.id === selectedMeeting.id ? { ...m, status: "canceled" } : m
          )
        );
        setSelectedMeeting((prev) =>
          prev ? { ...prev, status: "canceled" } : null
        );
        fetchMeetings();
      }
    } catch (error) {
      console.error("Failed to cancel meeting:", error);
    } finally {
      setUpdating(false);
    }
  };

  // Regenerate meeting prep
  const regeneratePrep = async () => {
    if (!selectedMeeting) return;

    setRegenerating(true);
    try {
      const response = await fetch("/api/meetings/prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: selectedMeeting.leadId,
          meetingId: selectedMeeting.id,
          regenerate: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update local state with new prep
        setMeetings((prev) =>
          prev.map((m) =>
            m.id === selectedMeeting.id ? { ...m, prepDocument: data.prep } : m
          )
        );
        setSelectedMeeting((prev) =>
          prev ? { ...prev, prepDocument: data.prep } : null
        );
      }
    } catch (error) {
      console.error("Failed to regenerate prep:", error);
    } finally {
      setRegenerating(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      time: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    };
  };

  const filteredMeetings = meetings;

  return (
    <div className="flex h-[calc(100vh-2rem)]">
      {/* Meeting List */}
      <div className="w-96 border-r bg-white flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Meetings</h1>
              <p className="text-sm text-gray-500 mt-1">
                {stats.scheduled > 0 ? `${stats.scheduled} upcoming` : "No upcoming meetings"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchMeetings}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="p-3 border-b grid grid-cols-4 gap-2">
          <div className="text-center p-2 bg-blue-50 rounded-lg">
            <p className="text-lg font-semibold text-blue-700">{stats.scheduled}</p>
            <p className="text-xs text-blue-600">Scheduled</p>
          </div>
          <div className="text-center p-2 bg-green-50 rounded-lg">
            <p className="text-lg font-semibold text-green-700">{stats.completed}</p>
            <p className="text-xs text-green-600">Completed</p>
          </div>
          <div className="text-center p-2 bg-orange-50 rounded-lg">
            <p className="text-lg font-semibold text-orange-700">{stats.no_show}</p>
            <p className="text-xs text-orange-600">No Show</p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded-lg">
            <p className="text-lg font-semibold text-gray-700">{stats.total}</p>
            <p className="text-xs text-gray-600">Total</p>
          </div>
        </div>

        {/* Filters */}
        <div className="p-3 border-b flex gap-2 flex-wrap">
          {(["all", "scheduled", "completed", "canceled", "no_show"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                filter === f
                  ? "bg-peach-100 text-peach-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {f === "no_show" ? "No Show" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Meeting List */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="h-6 w-6 text-gray-400 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading meetings...</p>
            </div>
          ) : filteredMeetings.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Calendar className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="font-medium text-gray-900 mb-2">
                No meetings yet
              </h3>
              <p className="text-sm text-gray-500">
                Meetings booked via Calendly will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredMeetings.map((meeting) => {
                const { date, time } = formatDateTime(meeting.scheduledAt);
                return (
                  <button
                    key={meeting.id}
                    onClick={() => setSelectedMeeting(meeting)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedMeeting?.id === meeting.id ? "bg-peach-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-peach-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-peach-600 font-medium text-sm">
                          {meeting.lead.firstName?.[0]}
                          {meeting.lead.lastName?.[0]}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-gray-900 truncate">
                            {meeting.lead.firstName} {meeting.lead.lastName}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[meeting.status]}`}>
                            {statusLabels[meeting.status]}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {meeting.lead.schoolName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {date} at {time}
                          </span>
                        </div>
                        {meeting.eventName && (
                          <p className="text-xs text-gray-400 mt-1 truncate">
                            {meeting.eventName}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Meeting Detail */}
      <div className="flex-1 bg-gray-50 flex flex-col overflow-hidden">
        {selectedMeeting ? (
          <>
            {/* Meeting Header */}
            <div className="bg-white border-b p-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Meeting with {selectedMeeting.lead.firstName} {selectedMeeting.lead.lastName}
                    </h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[selectedMeeting.status]}`}>
                      {statusLabels[selectedMeeting.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      {selectedMeeting.lead.schoolName}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {selectedMeeting.lead.jobTitle}
                    </span>
                  </div>
                </div>
                {selectedMeeting.meetingUrl && selectedMeeting.status === "scheduled" && (
                  <Button
                    onClick={() => window.open(selectedMeeting.meetingUrl!, "_blank")}
                  >
                    <Video className="h-4 w-4 mr-2" />
                    Join Meeting
                  </Button>
                )}
              </div>
            </div>

            {/* Meeting Content */}
            <div className="flex-1 overflow-auto p-6">
              {/* Meeting Time */}
              <div className="bg-white rounded-lg border p-4 mb-4 max-w-3xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {formatDateTime(selectedMeeting.scheduledAt).date}
                    </p>
                    <p className="text-sm text-gray-600">
                      {formatDateTime(selectedMeeting.scheduledAt).time}
                      {selectedMeeting.endTime && ` - ${formatDateTime(selectedMeeting.endTime).time}`}
                    </p>
                    {selectedMeeting.eventName && (
                      <p className="text-xs text-gray-500 mt-1">{selectedMeeting.eventName}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="bg-white rounded-lg border p-4 mb-4 max-w-3xl">
                <h3 className="font-medium text-gray-900 mb-3">Contact Information</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-gray-400" />
                    <span>{selectedMeeting.lead.firstName} {selectedMeeting.lead.lastName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <a href={`mailto:${selectedMeeting.lead.email}`} className="text-peach-600 hover:underline">
                      {selectedMeeting.lead.email}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span>{selectedMeeting.lead.schoolName}</span>
                    {selectedMeeting.lead.schoolCountry && (
                      <span className="text-gray-400">({selectedMeeting.lead.schoolCountry})</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Meeting Prep Document */}
              {selectedMeeting.prepDocument ? (
                <div className="bg-purple-50 rounded-lg border border-purple-200 p-4 mb-4 max-w-3xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-600" />
                      <h3 className="font-medium text-purple-900">AI Meeting Prep</h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={regeneratePrep}
                      disabled={regenerating}
                      className="text-purple-600 hover:text-purple-700"
                    >
                      {regenerating ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Regenerate
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Prospect Summary */}
                  <div className="mb-4">
                    <button
                      onClick={() => toggleSection("summary")}
                      className="flex items-center justify-between w-full text-left mb-2"
                    >
                      <span className="text-sm font-medium text-purple-800 uppercase tracking-wide">
                        Prospect Summary
                      </span>
                      {expandedSections.summary ? (
                        <ChevronUp className="h-4 w-4 text-purple-600" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-purple-600" />
                      )}
                    </button>
                    {expandedSections.summary && (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white/50 rounded p-3">
                        {selectedMeeting.prepDocument.prospectSummary}
                      </p>
                    )}
                  </div>

                  {/* Talking Points */}
                  <div className="mb-4">
                    <button
                      onClick={() => toggleSection("talkingPoints")}
                      className="flex items-center justify-between w-full text-left mb-2"
                    >
                      <span className="text-sm font-medium text-purple-800 uppercase tracking-wide">
                        Talking Points ({selectedMeeting.prepDocument.talkingPoints.length})
                      </span>
                      {expandedSections.talkingPoints ? (
                        <ChevronUp className="h-4 w-4 text-purple-600" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-purple-600" />
                      )}
                    </button>
                    {expandedSections.talkingPoints && (
                      <ul className="space-y-2">
                        {selectedMeeting.prepDocument.talkingPoints.map((point, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-700 bg-white/50 rounded p-2">
                            <span className="w-5 h-5 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">
                              {idx + 1}
                            </span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Objections */}
                  <div className="mb-4">
                    <button
                      onClick={() => toggleSection("objections")}
                      className="flex items-center justify-between w-full text-left mb-2"
                    >
                      <span className="text-sm font-medium text-purple-800 uppercase tracking-wide">
                        Potential Objections ({selectedMeeting.prepDocument.objections.length})
                      </span>
                      {expandedSections.objections ? (
                        <ChevronUp className="h-4 w-4 text-purple-600" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-purple-600" />
                      )}
                    </button>
                    {expandedSections.objections && (
                      <div className="space-y-3">
                        {selectedMeeting.prepDocument.objections.map((obj, idx) => (
                          <div key={idx} className="bg-white/50 rounded p-3">
                            <p className="text-sm font-medium text-gray-900 flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                              &quot;{obj.objection}&quot;
                            </p>
                            <p className="text-sm text-gray-600 mt-2 ml-6">
                              <span className="font-medium text-green-700">Response:</span> {obj.response}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Facts */}
                  <div>
                    <button
                      onClick={() => toggleSection("quickFacts")}
                      className="flex items-center justify-between w-full text-left mb-2"
                    >
                      <span className="text-sm font-medium text-purple-800 uppercase tracking-wide">
                        Quick Reference
                      </span>
                      {expandedSections.quickFacts ? (
                        <ChevronUp className="h-4 w-4 text-purple-600" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-purple-600" />
                      )}
                    </button>
                    {expandedSections.quickFacts && (
                      <div className="bg-white/50 rounded p-3">
                        <dl className="grid grid-cols-2 gap-2">
                          {selectedMeeting.prepDocument.quickFacts.map((fact, idx) => (
                            <div key={idx}>
                              <dt className="text-xs text-gray-500">{fact.label}</dt>
                              <dd className="text-sm text-gray-900">{fact.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-100 rounded-lg border border-gray-200 p-6 mb-4 max-w-3xl text-center">
                  <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 mb-3">No meeting prep document yet</p>
                  <Button
                    variant="outline"
                    onClick={regeneratePrep}
                    disabled={regenerating}
                  >
                    {regenerating ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Generate Meeting Prep
                  </Button>
                </div>
              )}

              {/* Notes Section */}
              <div className="bg-white rounded-lg border p-4 mb-4 max-w-3xl">
                <h3 className="font-medium text-gray-900 mb-3">Meeting Notes</h3>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about the meeting..."
                  className="w-full h-24 p-3 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-peach-500 resize-none"
                />
              </div>

              {/* Outcome Section */}
              <div className="bg-white rounded-lg border p-4 mb-4 max-w-3xl">
                <h3 className="font-medium text-gray-900 mb-3">Meeting Outcome</h3>
                <textarea
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  placeholder="What was the outcome of the meeting?"
                  className="w-full h-24 p-3 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-peach-500 resize-none"
                />
              </div>
            </div>

            {/* Action Bar */}
            <div className="bg-white border-t p-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                {selectedMeeting.status === "scheduled" && (
                  <>
                    <Button
                      onClick={() => updateMeetingStatus("completed")}
                      disabled={updating}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {updating ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Mark Completed
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => updateMeetingStatus("no_show")}
                      disabled={updating}
                      className="text-orange-600 border-orange-200 hover:bg-orange-50"
                    >
                      <AlertCircle className="h-4 w-4 mr-2" />
                      No Show
                    </Button>
                    <Button
                      variant="outline"
                      onClick={cancelMeeting}
                      disabled={updating}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={saveNotes}
                  disabled={updating}
                  className="ml-auto"
                >
                  {updating ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Save Notes
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Select a meeting to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
