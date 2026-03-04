export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, papers } from "@/db/schema";
import { parseSchedulePdf } from "@/lib/parser/schedule-parser";
import { processPaper, hashPdfBuffer } from "@/lib/paper/processor";
import { eq } from "drizzle-orm";


export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const results: {
    schedule?: { parsed: number; upserted: number };
    papers?: { filename: string; status: "processed" | "skipped" | "error"; error?: string }[];
    errors?: string[];
  } = {};

  const errors: string[] = [];

  // Handle schedule PDF
  const scheduleFile = formData.get("schedule") as File | null;
  if (scheduleFile) {
    try {
      const buffer = Buffer.from(await scheduleFile.arrayBuffer());
      const parsedSessions = await parseSchedulePdf(buffer);

      let upserted = 0;
      for (const session of parsedSessions) {
        // Upsert by dedupe_key
        const existing = await db
          .select()
          .from(sessions)
          .where(eq(sessions.dedupe_key, session.dedupe_key))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(sessions)
            .set({
              title: session.title,
              location: session.location,
              presenter: session.presenter,
              source: session.source,
              raw_text: session.raw_text,
            })
            .where(eq(sessions.dedupe_key, session.dedupe_key));
        } else {
          await db.insert(sessions).values(session);
        }
        upserted++;
      }

      results.schedule = { parsed: parsedSessions.length, upserted };
    } catch (err) {
      errors.push(`Schedule parse error: ${(err as Error).message}`);
    }
  }

  // Handle paper PDFs (multiple)
  const paperFiles = formData.getAll("papers") as File[];
  if (paperFiles.length > 0) {
    const paperResults: typeof results.papers = [];

    for (const file of paperFiles) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileHash = hashPdfBuffer(buffer);

        // Check if already processed
        const existing = await db
          .select()
          .from(papers)
          .where(eq(papers.file_hash, fileHash))
          .limit(1);

        if (existing.length > 0 && existing[0].summary_json) {
          paperResults.push({ filename: file.name, status: "skipped" });
          continue;
        }

        // Try to match to a session by filename similarity
        const sessionId = await matchPaperToSession(file.name);

        const summary = await processPaper(buffer, file.name, sessionId);

        if (existing.length > 0) {
          // Update existing record
          await db
            .update(papers)
            .set({
              session_id: sessionId,
              summary_json: JSON.stringify(summary),
            })
            .where(eq(papers.file_hash, fileHash));
        } else {
          await db.insert(papers).values({
            paper_id: summary.paper_id,
            session_id: sessionId,
            filename: file.name,
            file_hash: fileHash,
            summary_json: JSON.stringify(summary),
            created_at: new Date().toISOString(),
          });
        }

        paperResults.push({ filename: file.name, status: "processed" });
      } catch (err) {
        paperResults.push({
          filename: file.name,
          status: "error",
          error: (err as Error).message,
        });
      }
    }

    results.papers = paperResults;
  }

  if (errors.length > 0) {
    results.errors = errors;
  }

  return NextResponse.json(results);
}

async function matchPaperToSession(filename: string): Promise<string | null> {
  // Simple fuzzy match: normalize filename and compare with session titles
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[_\-\.]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const nameWithoutExt = filename.replace(/\.pdf$/i, "");
  const normalized = normalize(nameWithoutExt);

  const allSessions = await db.select().from(sessions);

  for (const s of allSessions) {
    const titleNorm = normalize(s.title);
    // Check substring match either direction
    if (
      normalized.includes(titleNorm.slice(0, 8)) ||
      titleNorm.includes(normalized.slice(0, 8))
    ) {
      return s.session_id;
    }
  }

  return null;
}
