export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, notification_log } from "@/db/schema";
import { syncSessions, cancelMissingEvents } from "@/lib/calendar/sync";


export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const month: string | undefined = body.month;

  let allSessions = await db.select().from(sessions);

  if (month) {
    allSessions = allSessions.filter((s) => s.month === month);
  }

  if (allSessions.length === 0) {
    return NextResponse.json({ error: "No sessions found" }, { status: 400 });
  }

  try {
    const result = await syncSessions(allSessions as Parameters<typeof syncSessions>[0]);

    // Cancel stale events if syncing a specific month
    if (month && result.calendarId) {
      const activeKeys = new Set(allSessions.map((s) => s.dedupe_key));
      await cancelMissingEvents(result.calendarId, month, activeKeys);
    }

    await db.insert(notification_log).values({
      type: "calendar_sync",
      month: month ?? null,
      sent_at: new Date().toISOString(),
      status: result.errors.length > 0 ? "partial" : "success",
      error_message:
        result.errors.length > 0 ? result.errors.join("; ") : null,
    });

    return NextResponse.json({
      ...result,
      total: allSessions.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
