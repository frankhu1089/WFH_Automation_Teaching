import type { Session } from "@/types/session";
import type { PaperSummary } from "@/types/paper-summary";

const TELEGRAM_API = "https://api.telegram.org";

function cleanEnv(val: string | undefined) {
  return (val ?? "").replace(/#.*$/, "").trim();
}

async function sendMessage(text: string): Promise<void> {
  const token = cleanEnv(process.env.TELEGRAM_BOT_TOKEN);
  const chatId = cleanEnv(process.env.TELEGRAM_CHAT_ID);

  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set");
  }

  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error: ${body}`);
  }
}

// Escape HTML special chars for Telegram HTML mode
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const SERIES_LABEL: Record<string, string> = {
  journal_club: "讀書會",
  dept_meeting: "科會",
  other: "其他",
};

function formatSessionLine(s: Session): string {
  const label = SERIES_LABEL[s.series] ?? s.series;
  const date = s.date.slice(5); // MM-DD
  const day = getDayLabel(s.date);
  const time = `${s.start_time}–${s.end_time}`;
  return `📅 <b>${date}(${day})</b> ${time} [${label}] ${esc(s.title)}`;
}

function getDayLabel(dateStr: string): string {
  const days = ["日", "一", "二", "三", "四", "五", "六"];
  return days[new Date(dateStr).getDay()];
}

export async function sendMonthlyDigest(
  sessions: Session[],
  month: string,
  missingPapers: string[],
  papers: PaperSummary[] = []
): Promise<void> {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));

  // ── Message 1: schedule overview ─────────────────────────────────────────
  let text = `<b>📋 ${month} 讀書會月曆總覽</b>\n`;
  text += `共 ${sessions.length} 場`;
  if (papers.length > 0) text += `，${papers.length} 篇 paper 摘要`;
  text += "\n\n";

  const byWeek: Record<string, Session[]> = {};
  for (const s of sorted) {
    const weekNum = Math.ceil(new Date(s.date).getDate() / 7);
    const key = `第 ${weekNum} 週`;
    if (!byWeek[key]) byWeek[key] = [];
    byWeek[key].push(s);
  }

  for (const [week, weekSessions] of Object.entries(byWeek)) {
    text += `<b>${week}</b>\n`;
    for (const s of weekSessions) {
      text += `  ${formatSessionLine(s)}\n`;
      if (s.presenter) text += `  　　👤 ${esc(s.presenter)}\n`;
    }
    text += "\n";
  }

  if (missingPapers.length > 0) {
    text += `⚠️ <b>尚未上傳 paper：</b>\n`;
    for (const p of missingPapers) text += `  • ${esc(p)}\n`;
  } else {
    text += `✅ 本月 papers 已全數上傳`;
  }

  await sendMessage(text);

  // ── Messages 2…N: one message per paper ──────────────────────────────────
  for (const paper of papers) {
    await sendMessage(formatPaperDigestMessage(paper, sessions));
  }
}

export async function sendDailyBrief(
  sessions: Session[],
  papers: PaperSummary[]
): Promise<void> {
  if (sessions.length === 0) return;

  const today = sessions[0].date;
  const dayLabel = getDayLabel(today);
  const dateStr = today.slice(5);

  let text = `<b>🏥 今日讀書會 ${dateStr}(${dayLabel})</b>\n\n`;

  for (const s of sessions) {
    const label = SERIES_LABEL[s.series] ?? s.series;
    text += `<b>[${label}] ${esc(s.title)}</b>\n`;
    text += `🕐 ${s.start_time}–${s.end_time}`;
    if (s.location) text += ` 📍 ${esc(s.location)}`;
    text += "\n";
    if (s.presenter) text += `👤 ${esc(s.presenter)}\n`;

    // Find matching paper
    const paper = papers.find((p) => p.linked_session_id === s.session_id);
    if (paper) {
      text += "\n";
      text += formatPaperCard(paper);
    }
    text += "\n";
  }

  await sendMessage(text);
}

function formatPaperDigestMessage(paper: PaperSummary, sessions: Session[]): string {
  const s = paper.summary;
  const linkedSession = sessions.find(
    (sess) => sess.session_id === paper.linked_session_id
  );

  let text = "";

  // Header
  const titleLine = linkedSession
    ? `${linkedSession.date.slice(5)}(${getDayLabel(linkedSession.date)}) ${esc(linkedSession.title)}`
    : esc(paper.source_pdf.filename.replace(/\.pdf$/i, ""));
  text += `<b>📄 ${titleLine}</b>\n`;
  if (linkedSession?.presenter) text += `👤 ${esc(linkedSession.presenter)}\n`;
  text += "\n";

  // What
  text += `<b>這篇在討論什麼</b>\n${esc(s.what)}\n\n`;

  // PICO / Design
  if (s.pico_or_design.type === "PICO") {
    text += `<b>🔬 PICO</b>\n`;
    if (s.pico_or_design.P) text += `  <b>P</b> ${esc(s.pico_or_design.P)}\n`;
    if (s.pico_or_design.I) text += `  <b>I</b> ${esc(s.pico_or_design.I)}\n`;
    if (s.pico_or_design.C) text += `  <b>C</b> ${esc(s.pico_or_design.C)}\n`;
    if (s.pico_or_design.O) text += `  <b>O</b> ${esc(s.pico_or_design.O)}\n`;
  } else {
    text += `<b>🔬 研究設計</b>\n${esc(s.pico_or_design.design_note ?? "")}\n`;
  }
  text += "\n";

  // Keywords
  if (s.discussion_keywords.length > 0) {
    text += `<b>🏷️ 關鍵字</b>: ${s.discussion_keywords.map(esc).join(" · ")}\n\n`;
  }

  // Knowledge gaps
  if (s.knowledge_gaps.length > 0) {
    text += `<b>🔍 我可能不熟悉的部分</b>\n`;
    for (const g of s.knowledge_gaps) {
      text += `  • ${esc(g.question)}\n`;
      text += `    <i>${esc(g.why_it_matters)}</i>\n`;
    }
    text += "\n";
  }

  // Question bank
  text += `<b>❓ 問學生</b>\n`;
  s.question_bank.for_students.forEach((q, i) => {
    text += `  ${i + 1}. ${esc(q.q)}\n`;
    if (q.expected_points.length > 0) {
      text += `     ✓ ${q.expected_points.map(esc).join("；")}\n`;
    }
    if (q.red_flags.length > 0) {
      text += `     ⚠️ ${q.red_flags.map(esc).join("；")}\n`;
    }
  });
  text += "\n";

  text += `<b>🎓 問主治</b>\n`;
  s.question_bank.for_attendings.forEach((q, i) => {
    text += `  ${i + 1}. ${esc(q.q)}\n`;
    if (q.discussion_angles.length > 0) {
      text += `     → ${q.discussion_angles.map(esc).join("；")}\n`;
    }
  });

  return text;
}

function formatPaperCard(paper: PaperSummary): string {
  const s = paper.summary;
  let text = "";

  text += `📄 <b>摘要</b>\n${esc(s.what)}\n\n`;

  if (s.pico_or_design.type === "PICO") {
    text += `🔬 <b>PICO</b>\n`;
    if (s.pico_or_design.P) text += `  P: ${esc(s.pico_or_design.P)}\n`;
    if (s.pico_or_design.I) text += `  I: ${esc(s.pico_or_design.I)}\n`;
    if (s.pico_or_design.C) text += `  C: ${esc(s.pico_or_design.C)}\n`;
    if (s.pico_or_design.O) text += `  O: ${esc(s.pico_or_design.O)}\n`;
  } else {
    text += `🔬 <b>設計</b>: ${esc(s.pico_or_design.design_note ?? "")}\n`;
  }
  text += "\n";

  if (s.discussion_keywords.length > 0) {
    text += `🏷️ <b>關鍵字</b>: ${s.discussion_keywords.map(esc).join(", ")}\n\n`;
  }

  // Top 3 student questions
  text += `❓ <b>問學生</b>\n`;
  s.question_bank.for_students.slice(0, 3).forEach((q, i) => {
    text += `  ${i + 1}. ${esc(q.q)}\n`;
  });
  text += "\n";

  // Top 2 attending questions
  text += `🎓 <b>問主治</b>\n`;
  s.question_bank.for_attendings.slice(0, 2).forEach((q, i) => {
    text += `  ${i + 1}. ${esc(q.q)}\n`;
  });

  return text;
}
