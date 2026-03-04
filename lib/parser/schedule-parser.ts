import OpenAI from "openai";
import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import type {
  Session,
  ParsedSessionRaw,
  Series,
  TimePolicy,
} from "@/types/session";

const client = new OpenAI();

function normalizeTitle(title: string): string {
  return title
    .trim()
    .replace(/\s+/g, " ")
    .replace(/，/g, ",")
    .replace(/。/g, ".")
    .replace(/　/g, " "); // full-width space
}

function computeDedupeKey(
  month: string,
  date: string,
  series: Series,
  title: string
): string {
  const normalized = `${month}|${date}|${series}|${normalizeTitle(title)}`;
  return createHash("sha1").update(normalized).digest("hex").slice(0, 16);
}

function getTimePolicy(date: string, series: Series): TimePolicy {
  if (series === "dept_meeting") return "TUE_BLOCK";
  const dayOfWeek = new Date(date).getDay(); // 0=Sun, 2=Tue
  if (dayOfWeek === 2) return "TUE_BLOCK";
  return "LUNCH_DEFAULT";
}

function getTimes(policy: TimePolicy): { start_time: string; end_time: string } {
  if (policy === "TUE_BLOCK") {
    return { start_time: "12:15", end_time: "13:15" };
  }
  return { start_time: "12:30", end_time: "13:15" };
}

export async function parseSchedulePdf(pdfBuffer: Buffer): Promise<Session[]> {
  const pdfParse = (await import("pdf-parse")).default;
  const pdfData = await pdfParse(pdfBuffer);
  const rawText = pdfData.text;

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 4096,
    messages: [
      {
        role: "system",
        content:
          "You are a parser for Taiwanese medical residency monthly schedules. Output only valid JSON. Language rule: all text you generate must be in English or Traditional Chinese (zh-TW). Simplified Chinese is strictly forbidden.",
      },
      {
        role: "user",
        content: `You are parsing a monthly schedule PDF. The PDF was extracted column-by-column (not row-by-row), so the table data is jumbled.

The schedule has TWO sections:
1. 讀書會/期刊研討會 (Reading Club/Journal Club) — series: "journal_club"
2. 科會/英文學術研討會 (Department Meeting/Academic Seminar) — series: "dept_meeting"

Each section is a table with columns: 日期(date) | 資料來源(source) | 題目(title) | 報告人(presenter)
Dates are in format YYYY/MM/DD(weekday), e.g. 2026/03/02(一). Location appears right after the date.

From the extracted text below, reconstruct each session row-by-row. Use context clues (number of dates, paper titles, patterns) to correctly assign sources/titles/presenters to dates.

Rules:
- For non-paper rows (e.g. 社區醫療群, 門診病歷討論, 腹部超音波實作教學), use the activity name as title
- Missing source/presenter → null
- Output ONLY a valid JSON array, no other text

Output format:
[
  {
    "date": "YYYY-MM-DD",
    "series": "journal_club" | "dept_meeting",
    "title": "string",
    "location": "string or null",
    "presenter": "string or null",
    "source": "string or null",
    "raw_text": "original line(s)"
  }
]

PDF text:
${rawText}`,
      },
    ],
  });

  const responseText = response.choices[0]?.message?.content ?? "";

  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("OpenAI did not return a valid JSON array");
  }

  const rawSessions: ParsedSessionRaw[] = JSON.parse(jsonMatch[0]);

  const firstDate = rawSessions[0]?.date ?? "";
  const month = firstDate.slice(0, 7); // YYYY-MM

  return rawSessions.map((raw) => {
    const time_policy = getTimePolicy(raw.date, raw.series);
    const { start_time, end_time } = getTimes(time_policy);
    const dedupe_key = computeDedupeKey(month, raw.date, raw.series, raw.title);

    return {
      session_id: uuidv4(),
      month,
      date: raw.date,
      series: raw.series,
      title: raw.title,
      time_policy,
      start_time,
      end_time,
      location: raw.location ?? null,
      presenter: raw.presenter ?? null,
      source: raw.source ?? null,
      raw_text: raw.raw_text ?? "",
      dedupe_key,
      created_at: new Date().toISOString(),
    };
  });
}
