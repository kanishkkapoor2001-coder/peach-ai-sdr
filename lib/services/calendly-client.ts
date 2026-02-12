/**
 * Calendly Integration
 *
 * Handles:
 * - Getting available event types
 * - Creating scheduling links
 * - Processing booking webhooks
 */

const CALENDLY_API_URL = "https://api.calendly.com";

interface CalendlyUser {
  uri: string;
  name: string;
  email: string;
  scheduling_url: string;
  timezone: string;
}

interface CalendlyEventType {
  uri: string;
  name: string;
  active: boolean;
  scheduling_url: string;
  duration: number;
  kind: "solo" | "group";
  description_plain?: string;
}

interface CalendlyInvitee {
  uri: string;
  email: string;
  name: string;
  status: "active" | "canceled";
  created_at: string;
  updated_at: string;
  questions_and_answers?: {
    question: string;
    answer: string;
  }[];
}

interface CalendlyEvent {
  uri: string;
  name: string;
  status: "active" | "canceled";
  start_time: string;
  end_time: string;
  event_type: string;
  location?: {
    type: string;
    location?: string;
    join_url?: string;
  };
  invitees_counter: {
    total: number;
    active: number;
    limit: number;
  };
  created_at: string;
  updated_at: string;
}

export interface BookingWebhookPayload {
  event: "invitee.created" | "invitee.canceled";
  created_at: string;
  payload: {
    event: CalendlyEvent;
    invitee: CalendlyInvitee;
    questions_and_answers?: {
      question: string;
      answer: string;
    }[];
    tracking?: {
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
    };
  };
}

/**
 * Make authenticated request to Calendly API
 */
async function calendlyFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = process.env.CALENDLY_API_KEY;

  if (!apiKey) {
    throw new Error("CALENDLY_API_KEY not configured");
  }

  const response = await fetch(`${CALENDLY_API_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Calendly API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Get the current user's info
 */
export async function getCurrentUser(): Promise<CalendlyUser> {
  const response = await calendlyFetch<{ resource: CalendlyUser }>("/users/me");
  return response.resource;
}

/**
 * Get available event types for the user
 */
export async function getEventTypes(
  userUri?: string
): Promise<CalendlyEventType[]> {
  // Get user URI if not provided
  const uri = userUri || process.env.CALENDLY_USER_URI;

  if (!uri) {
    const user = await getCurrentUser();
    return getEventTypes(user.uri);
  }

  const response = await calendlyFetch<{ collection: CalendlyEventType[] }>(
    `/event_types?user=${encodeURIComponent(uri)}&active=true`
  );

  return response.collection;
}

/**
 * Get the scheduling URL for a specific event type
 */
export async function getSchedulingUrl(
  eventTypeUri?: string
): Promise<string> {
  // Use configured event type or get the first active one
  const uri = eventTypeUri || process.env.CALENDLY_EVENT_TYPE_URI;

  if (uri) {
    const response = await calendlyFetch<{ resource: CalendlyEventType }>(
      `/event_types/${uri.split("/").pop()}`
    );
    return response.resource.scheduling_url;
  }

  // Get first active event type
  const eventTypes = await getEventTypes();
  if (eventTypes.length === 0) {
    throw new Error("No active event types found");
  }

  return eventTypes[0].scheduling_url;
}

/**
 * Get scheduled events for the user
 */
export async function getScheduledEvents(options: {
  userUri?: string;
  minStartTime?: Date;
  maxStartTime?: Date;
  status?: "active" | "canceled";
  count?: number;
}): Promise<CalendlyEvent[]> {
  const uri = options.userUri || process.env.CALENDLY_USER_URI;

  if (!uri) {
    const user = await getCurrentUser();
    return getScheduledEvents({ ...options, userUri: user.uri });
  }

  const params = new URLSearchParams({
    user: uri,
    count: String(options.count || 20),
  });

  if (options.minStartTime) {
    params.set("min_start_time", options.minStartTime.toISOString());
  }
  if (options.maxStartTime) {
    params.set("max_start_time", options.maxStartTime.toISOString());
  }
  if (options.status) {
    params.set("status", options.status);
  }

  const response = await calendlyFetch<{ collection: CalendlyEvent[] }>(
    `/scheduled_events?${params.toString()}`
  );

  return response.collection;
}

/**
 * Get invitee details for an event
 */
export async function getEventInvitees(
  eventUri: string
): Promise<CalendlyInvitee[]> {
  const eventUuid = eventUri.split("/").pop();

  const response = await calendlyFetch<{ collection: CalendlyInvitee[] }>(
    `/scheduled_events/${eventUuid}/invitees`
  );

  return response.collection;
}

/**
 * Create a single-use scheduling link with prefilled info
 */
export async function createSchedulingLink(options: {
  eventTypeUri?: string;
  maxEventCount?: number;
  ownerType?: "EventType";
}): Promise<string> {
  const eventTypeUri =
    options.eventTypeUri || process.env.CALENDLY_EVENT_TYPE_URI;

  if (!eventTypeUri) {
    const eventTypes = await getEventTypes();
    if (eventTypes.length === 0) {
      throw new Error("No active event types found");
    }
    return createSchedulingLink({
      ...options,
      eventTypeUri: eventTypes[0].uri,
    });
  }

  const response = await calendlyFetch<{ resource: { booking_url: string } }>(
    "/scheduling_links",
    {
      method: "POST",
      body: JSON.stringify({
        max_event_count: options.maxEventCount || 1,
        owner: eventTypeUri,
        owner_type: options.ownerType || "EventType",
      }),
    }
  );

  return response.resource.booking_url;
}

/**
 * Process webhook payload from Calendly
 */
export function parseBookingWebhook(payload: BookingWebhookPayload): {
  type: "booked" | "canceled";
  email: string;
  name: string;
  startTime: Date;
  endTime: Date;
  eventName: string;
  meetingUrl?: string;
  answers?: { question: string; answer: string }[];
} {
  const { event, payload: data } = payload;

  return {
    type: event === "invitee.created" ? "booked" : "canceled",
    email: data.invitee.email,
    name: data.invitee.name,
    startTime: new Date(data.event.start_time),
    endTime: new Date(data.event.end_time),
    eventName: data.event.name,
    meetingUrl: data.event.location?.join_url,
    answers: data.questions_and_answers,
  };
}

/**
 * Test Calendly connection
 */
export async function testCalendlyConnection(): Promise<{
  connected: boolean;
  user?: { name: string; email: string; schedulingUrl: string };
  eventTypes?: { name: string; url: string }[];
  error?: string;
}> {
  try {
    if (!process.env.CALENDLY_API_KEY) {
      return {
        connected: false,
        error: "CALENDLY_API_KEY not configured",
      };
    }

    const user = await getCurrentUser();
    const eventTypes = await getEventTypes(user.uri);

    return {
      connected: true,
      user: {
        name: user.name,
        email: user.email,
        schedulingUrl: user.scheduling_url,
      },
      eventTypes: eventTypes.map((et) => ({
        name: et.name,
        url: et.scheduling_url,
      })),
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}
