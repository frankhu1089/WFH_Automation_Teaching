export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { papers, sessions } from "@/db/schema";
import type { PaperSummary } from "@/types/paper-summary";

export async function GET(request: NextRequest) {
  const month = new URL(request.url).searchParams.get("month");

  const all = await db.select().from(papers);

  let filtered = all;
  if (month) {
    // Fetch sessions for this month to get their IDs
    const allSessions = await db.select().from(sessions);
    const monthSessionIds = new Set(
      allSessions.filter((s) => s.month === month).map((s) => s.session_id)
    );
    filtered = all.filter((p) =>
      p.session_id
        ? monthSessionIds.has(p.session_id)           // linked paper: match by session month
        : p.created_at.startsWith(month)              // unlinked paper: match by upload month
    );
  }

  return NextResponse.json(
    filtered.map((p) => ({
      paper_id: p.paper_id,
      filename: p.filename,
      session_id: p.session_id,
      created_at: p.created_at,
      summary: p.summary_json ? (JSON.parse(p.summary_json) as PaperSummary) : null,
    }))
  );
}
