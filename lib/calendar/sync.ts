import { google } from "googleapis";
import type { Session } from "@/types/session";

const CALENDAR_NAME = "教學";
const APP_TAG = "wmfm-journalclub";

const SERIES_LABEL: Record<string, string> = {
  journal_club: "讀書會",
  dept_meeting: "科會",
  other: "其他",
};

function cleanEnv(val: string | undefined) {
  return (val ?? "").replace(/#.*$/, "").trim();
}

function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    cleanEnv(process.env.GOOGLE_CLIENT_ID),
    cleanEnv(process.env.GOOGLE_CLIENT_SECRET)
  );
  client.setCredentials({
    refresh_token: cleanEnv(process.env.GOOGLE_REFRESH_TOKEN),
  });
  return client;
}

async function findOrCreateCalendar(
  calendar: ReturnType<typeof google.calendar>,
  name: string
): Promise<string> {
  // Strip inline comments and whitespace (Next.js doesn't strip # comments from .env values)
  const existingId = (process.env.GOOGLE_CALENDAR_ID ?? "")
    .replace(/#.*$/, "")
    .trim();
  if (existingId) return existingId;

  // List calendars and find by name
  const list = await calendar.calendarList.list();
  const found = list.data.items?.find((c) => c.summary === name);
  if (found?.id) return found.id;

  // Create new calendar
  const created = await calendar.calendars.insert({
    requestBody: { summary: name },
  });
  return created.data.id!;
}

function buildEventBody(session: Session) {
  const label = SERIES_LABEL[session.series] ?? session.series;
  const title = `${label}｜${session.title}`;

  const dateStr = session.date; // YYYY-MM-DD
  const startDateTime = `${dateStr}T${session.start_time}:00`;
  const endDateTime = `${dateStr}T${session.end_time}:00`;

  const descLines = [
    `#${APP_TAG} #${session.month}`,
    `session_id=${session.session_id}`,
    `dedupe_key=${session.dedupe_key}`,
  ];
  if (session.presenter) descLines.push(`報告人: ${session.presenter}`);
  if (session.source) descLines.push(`來源: ${session.source}`);

  return {
    summary: title,
    description: descLines.join("\n"),
    start: {
      dateTime: startDateTime,
      timeZone: "Asia/Taipei",
    },
    end: {
      dateTime: endDateTime,
      timeZone: "Asia/Taipei",
    },
    location: session.location ?? undefined,
    extendedProperties: {
      private: {
        app: APP_TAG,
        month: session.month,
        session_id: session.session_id,
        dedupe_key: session.dedupe_key,
      },
    },
  };
}

export interface SyncResult {
  created: number;
  updated: number;
  unchanged: number;
  errors: string[];
  calendarId: string;
}

export async function syncSessions(sessions: Session[]): Promise<SyncResult> {
  const auth = getOAuth2Client();
  const calendar = google.calendar({ version: "v3", auth });

  const calendarId = await findOrCreateCalendar(calendar, CALENDAR_NAME);

  const result: SyncResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
    errors: [],
    calendarId,
  };

  for (const session of sessions) {
    try {
      // Search for existing event by dedupe_key in private extended properties
      const searchRes = await calendar.events.list({
        calendarId,
        privateExtendedProperty: [`dedupe_key=${session.dedupe_key}`],
        fields: "items(id,summary,extendedProperties)",
      });

      const existing = (searchRes as { data: { items?: { id?: string; summary?: string; extendedProperties?: Record<string, Record<string, string>> }[] } }).data.items?.[0];
      const eventBody = buildEventBody(session);

      if (existing?.id) {
        // Update existing event
        await calendar.events.update({
          calendarId,
          eventId: existing.id,
          requestBody: eventBody,
        });
        result.updated++;
      } else {
        // Create new event
        await calendar.events.insert({
          calendarId,
          requestBody: eventBody,
        });
        result.created++;
      }
    } catch (err) {
      result.errors.push(
        `${session.date} ${session.title}: ${(err as Error).message}`
      );
    }
  }

  return result;
}

export async function cancelMissingEvents(
  calendarId: string,
  month: string,
  activeDedupKeys: Set<string>
): Promise<void> {
  const auth = getOAuth2Client();
  const calendar = google.calendar({ version: "v3", auth });

  // List all events tagged with this app and month
  const res = await calendar.events.list({
    calendarId,
    privateExtendedProperty: [`app=${APP_TAG}`],
    fields: "items(id,summary,extendedProperties)",
  });

  type CalEvent = { id?: string | null; summary?: string | null; extendedProperties?: { private?: Record<string, string> } };
  for (const event of ((res as { data: { items?: CalEvent[] } }).data.items ?? [])) {
    const eventMonth = event.extendedProperties?.private?.month;
    const dedupe = event.extendedProperties?.private?.dedupe_key;
    if (eventMonth !== month || !dedupe) continue;
    if (!activeDedupKeys.has(dedupe) && !event.summary?.startsWith("[CANCELLED]")) {
      await calendar.events.patch({
        calendarId,
        eventId: event.id!,
        requestBody: { summary: `[CANCELLED] ${event.summary}` },
      });
    }
  }
}
