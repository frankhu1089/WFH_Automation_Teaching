export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, papers, notification_log } from "@/db/schema";
import { sendMonthlyDigest } from "@/lib/notification/telegram";


export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  // Default to current month
  const month: string =
    body.month ?? new Date().toISOString().slice(0, 7);

  const allSessions = await db.select().from(sessions);
  const monthSessions = allSessions.filter((s) => s.month === month);

  if (monthSessions.length === 0) {
    return NextResponse.json(
      { error: `No sessions for ${month}` },
      { status: 400 }
    );
  }

  const allPapers = await db.select().from(papers);

  // Papers with summaries linked to this month's sessions
  const monthSessionIds = new Set(monthSessions.map((s) => s.session_id));
  const processedPapers = allPapers.filter(
    (p) => p.summary_json && p.session_id && monthSessionIds.has(p.session_id)
  );
  // Also include papers not linked to any session but uploaded (matched by month via created_at roughly)
  const unlinkedPapers = allPapers.filter((p) => p.summary_json && !p.session_id);

  const papersToSend = [...processedPapers, ...unlinkedPapers].map((p) => ({
    ...(JSON.parse(p.summary_json!) as import("@/types/paper-summary").PaperSummary),
  }));

  const processedSessionIds = new Set(processedPapers.map((p) => p.session_id!));

  // Missing: paper-based sessions with no processed paper
  const missingPapers = monthSessions
    .filter((s) => s.source && !processedSessionIds.has(s.session_id))
    .map((s) => s.title);

  try {
    await sendMonthlyDigest(
      monthSessions as Parameters<typeof sendMonthlyDigest>[0],
      month,
      missingPapers,
      papersToSend
    );

    await db.insert(notification_log).values({
      type: "monthly_digest",
      month,
      sent_at: new Date().toISOString(),
      status: "success",
    });

    return NextResponse.json({ ok: true, month, sessions: monthSessions.length, papers: papersToSend.length, missingPapers });
  } catch (err) {
    await db.insert(notification_log).values({
      type: "monthly_digest",
      month,
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
