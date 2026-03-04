export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, papers } from "@/db/schema";
import { eq } from "drizzle-orm";


export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");

  let query = db.select().from(sessions);

  const allSessions = await query;

  const filtered = month
    ? allSessions.filter((s) => s.month === month)
    : allSessions;

  // Sort by date
  filtered.sort((a, b) => a.date.localeCompare(b.date));

  // Also get paper linkage info
  const allPapers = await db.select().from(papers);
  const papersBySession = new Map<string, boolean>();
  for (const p of allPapers) {
    if (p.session_id) {
      papersBySession.set(p.session_id, !!p.summary_json);
    }
  }

  const enriched = filtered.map((s) => ({
    ...s,
    has_paper: papersBySession.has(s.session_id),
    paper_processed: papersBySession.get(s.session_id) ?? false,
  }));

  return NextResponse.json(enriched);
}
