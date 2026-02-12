export interface MeetingInviteOptions {
  meetingId: string;
  title: string;
  startTime: Date;
  durationMinutes: number;
  description?: string;
  meetingUrl?: string;
  organizerName: string;
  organizerEmail: string;
  attendeeName: string;
  attendeeEmail: string;
}

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function generateICSContent(options: MeetingInviteOptions): string {
  const {
    meetingId,
    title,
    startTime,
    durationMinutes,
    description,
    meetingUrl,
    organizerName,
    organizerEmail,
    attendeeName,
    attendeeEmail,
  } = options;

  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
  const now = new Date();

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Peach AI SDR//Meeting Invite//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${meetingId}@peach-ai-sdr`,
    `DTSTAMP:${formatICSDate(now)}`,
    `DTSTART:${formatICSDate(startTime)}`,
    `DTEND:${formatICSDate(endTime)}`,
    `SUMMARY:${escapeICSText(title)}`,
    `ORGANIZER;CN=${escapeICSText(organizerName)}:mailto:${organizerEmail}`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${escapeICSText(attendeeName)}:mailto:${attendeeEmail}`,
    `STATUS:CONFIRMED`,
    `SEQUENCE:0`,
  ];

  if (description) {
    lines.push(`DESCRIPTION:${escapeICSText(description)}`);
  }

  if (meetingUrl) {
    lines.push(`LOCATION:${escapeICSText(meetingUrl)}`);
    lines.push(`URL:${meetingUrl}`);
  }

  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}

export function createMeetingInviteAttachment(options: MeetingInviteOptions): {
  filename: string;
  content: string;
  contentType: string;
} {
  const icsContent = generateICSContent(options);

  return {
    filename: "invite.ics",
    content: icsContent,
    contentType: "text/calendar; method=REQUEST",
  };
}

export function createCalendarAlternative(options: MeetingInviteOptions): {
  contentType: string;
  content: string;
} {
  const icsContent = generateICSContent(options);

  return {
    contentType: "text/calendar; method=REQUEST; charset=UTF-8",
    content: icsContent,
  };
}
