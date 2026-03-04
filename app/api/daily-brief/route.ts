export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, papers, notification_log } from "@/db/schema";
import { sendDailyBrief } from "@/lib/notification/telegram";
import type { PaperSummary } from "@/types/paper-summary";


export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  // Default to today in Asia/Taipei
  const todayStr: string =
    body.date ??
    new Date()
      .toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });

  const allSessions = await db.select().from(sessions);
  const todaySessions = allSessions.filter((s) => s.date === todayStr);

  if (todaySessions.length === 0) {
    return NextResponse.json({ ok: true, message: "No sessions today", date: todayStr });
  }

  // Get papers for today's sessions
  const allPapers = await db.select().from(papers);
  const todaySessionIds = new Set(todaySessions.map((s) => s.session_id));
  const todayPapers: PaperSummary[] = allPapers
    .filter((p) => p.session_id && todaySessionIds.has(p.session_id) && p.summary_json)
    .map((p) => JSON.parse(p.summary_json!) as PaperSummary);

  try {
    await sendDailyBrief(
      todaySessions as Parameters<typeof sendDailyBrief>[0],
      todayPapers
    );

    await db.insert(notification_log).values({
      type: "daily_brief",
      month: todayStr.slice(0, 7),
      sent_at: new Date().toISOString(),
      status: "success",
    });

    return NextResponse.json({
      ok: true,
      date: todayStr,
      sessions: todaySessions.length,
      papers: todayPapers.length,
    });
  } catch (err) {
    await db.insert(notification_log).values({
      type: "daily_brief",
      month: todayStr.slice(0, 7),
      sent_at: new Date().toISOString(),
      status: "error",
      error_message: (err as Error).message,
    });
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
