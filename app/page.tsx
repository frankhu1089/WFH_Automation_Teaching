"use client";

import React, { useState, useRef } from "react";
import type { PaperSummary } from "@/types/paper-summary";

type SessionRow = {
  session_id: string;
  date: string;
  series: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
  presenter: string | null;
  source: string | null;
  has_paper: boolean;
  paper_processed: boolean;
};

type PaperRow = {
  paper_id: string;
  filename: string;
  session_id: string | null;
  created_at: string;
  summary: PaperSummary | null;
};

type UploadResult = {
  schedule?: { parsed: number; upserted: number };
  papers?: { filename: string; status: string; error?: string }[];
  errors?: string[];
};

const SERIES_LABEL: Record<string, string> = {
  journal_club: "讀書會",
  dept_meeting: "科會",
  other: "其他",
};

function PaperCard({ paper }: { paper: PaperRow }) {
  const [open, setOpen] = useState(false);
  const s = paper.summary?.summary;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
      >
        <span className="font-medium text-sm truncate pr-4">
          📄 {paper.filename.replace(/\.pdf$/i, "")}
        </span>
        <span className="text-gray-400 text-xs shrink-0">{open ? "▲" : "▼"}</span>
      </button>

      {/* Body — expanded */}
      {open && (
        <div className="px-4 py-4 space-y-4 text-sm">
          {!s ? (
            <p className="text-gray-400 italic">尚無摘要資料</p>
          ) : (
            <>
              {/* What */}
              <section>
                <h3 className="font-semibold text-gray-700 mb-1">📝 這篇在討論什麼</h3>
                <p className="text-gray-800 leading-relaxed">{s.what}</p>
              </section>

              {/* PICO / Design */}
              <section>
                <h3 className="font-semibold text-gray-700 mb-1">
                  🔬 研究設計（{s.pico_or_design.type}）
                </h3>
                {s.pico_or_design.type === "PICO" ? (
                  <dl className="grid grid-cols-[2rem_1fr] gap-x-2 gap-y-1">
                    {(["P", "I", "C", "O"] as const).map((k) =>
                      s.pico_or_design[k] ? (
                        <React.Fragment key={k}>
                          <dt className="font-bold text-blue-600">{k}</dt>
                          <dd className="text-gray-700">{s.pico_or_design[k]}</dd>
                        </React.Fragment>
                      ) : null
                    )}
                  </dl>
                ) : (
                  <p className="text-gray-700">{s.pico_or_design.design_note}</p>
                )}
              </section>

              {/* Keywords */}
              {s.discussion_keywords.length > 0 && (
                <section>
                  <h3 className="font-semibold text-gray-700 mb-2">🏷️ 值得討論的關鍵字</h3>
                  <div className="flex flex-wrap gap-2">
                    {s.discussion_keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Knowledge gaps */}
              {s.knowledge_gaps.length > 0 && (
                <section>
                  <h3 className="font-semibold text-gray-700 mb-2">🔍 我可能不熟悉的部分</h3>
                  <div className="space-y-2">
                    {s.knowledge_gaps.map((g) => (
                      <div key={g.gap_id} className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <p className="font-medium text-yellow-900">{g.question}</p>
                        <p className="text-yellow-700 text-xs mt-1">{g.why_it_matters}</p>
                        <span
                          className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded ${
                            g.confidence === "high"
                              ? "bg-red-100 text-red-700"
                              : g.confidence === "medium"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          信心：{g.confidence}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Question bank */}
              <section>
                <h3 className="font-semibold text-gray-700 mb-2">❓ 問題庫</h3>
                <div className="space-y-3">
                  {/* For students */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">問學生</p>
                    <ol className="space-y-2 list-decimal list-inside">
                      {s.question_bank.for_students.map((q, i) => (
                        <li key={i} className="bg-green-50 border border-green-200 rounded p-3">
                          <span className="font-medium text-green-900">{q.q}</span>
                          {q.expected_points.length > 0 && (
                            <ul className="mt-1 ml-3 space-y-0.5">
                              {q.expected_points.map((pt, j) => (
                                <li key={j} className="text-green-700 text-xs before:content-['✓_']">
                                  {pt}
                                </li>
                              ))}
                            </ul>
                          )}
                          {q.red_flags.length > 0 && (
                            <p className="text-red-600 text-xs mt-1">
                              ⚠️ {q.red_flags.join("；")}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* For attendings */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">問主治</p>
                    <ol className="space-y-2 list-decimal list-inside">
                      {s.question_bank.for_attendings.map((q, i) => (
                        <li key={i} className="bg-purple-50 border border-purple-200 rounded p-3">
                          <span className="font-medium text-purple-900">{q.q}</span>
                          {q.discussion_angles.length > 0 && (
                            <ul className="mt-1 ml-3 space-y-0.5">
                              {q.discussion_angles.map((a, j) => (
                                <li key={j} className="text-purple-700 text-xs before:content-['→_']">
                                  {a}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [loading, setLoading] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ text: string; type: "ok" | "err" }[]>([]);

  const scheduleRef = useRef<HTMLInputElement>(null);
  const papersRef = useRef<HTMLInputElement>(null);

  function addMsg(text: string, type: "ok" | "err" = "ok") {
    setMessages((prev) => [{ text, type }, ...prev].slice(0, 20));
  }

  async function loadSessions() {
    const res = await fetch(`/api/sessions?month=${selectedMonth}`);
    setSessions(await res.json());
  }

  async function loadPapers() {
    const res = await fetch(`/api/papers?month=${selectedMonth}`);
    setPapers(await res.json());
  }

  async function handleUpload() {
    const scheduleFile = scheduleRef.current?.files?.[0];
    const paperFiles = papersRef.current?.files;
    if (!scheduleFile && (!paperFiles || paperFiles.length === 0)) {
      addMsg("請先選擇時刻表或 paper PDFs", "err");
      return;
    }

    setLoading("upload");
    const fd = new FormData();
    if (scheduleFile) fd.append("schedule", scheduleFile);
    if (paperFiles) {
      for (const f of Array.from(paperFiles)) fd.append("papers", f);
    }

    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data: UploadResult = await res.json();

      if (data.schedule) {
        addMsg(`✅ 時刻表解析完成：${data.schedule.parsed} 場，已儲存 ${data.schedule.upserted} 筆`);
        await loadSessions();
      }
      if (data.papers) {
        const ok = data.papers.filter((p) => p.status === "processed").length;
        const skip = data.papers.filter((p) => p.status === "skipped").length;
        const err = data.papers.filter((p) => p.status === "error").length;
        addMsg(`📄 Papers：${ok} 處理完成，${skip} 跳過，${err} 錯誤`);
        for (const p of data.papers.filter((p) => p.status === "error")) {
          addMsg(`  ❌ ${p.filename}: ${p.error}`, "err");
        }
        await loadSessions();
        await loadPapers();
      }
      if (data.errors?.length) {
        for (const e of data.errors) addMsg(e, "err");
      }
    } catch (err) {
      addMsg(`Upload failed: ${(err as Error).message}`, "err");
    } finally {
      setLoading(null);
    }
  }

  async function syncCalendar() {
    setLoading("sync");
    try {
      const res = await fetch("/api/sync-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth }),
      });
      const data = await res.json();
      if (data.error) {
        addMsg(`❌ Calendar sync: ${data.error}`, "err");
      } else {
        addMsg(
          `✅ Calendar synced：新增 ${data.created}，更新 ${data.updated}，未變 ${data.unchanged}` +
            (data.errors?.length ? ` ⚠️ ${data.errors.length} 錯誤` : "")
        );
        if (data.calendarId) {
          addMsg(`📅 Calendar ID: ${data.calendarId} （請更新 .env.local 的 GOOGLE_CALENDAR_ID）`);
        }
      }
    } catch (err) {
      addMsg(`Sync failed: ${(err as Error).message}`, "err");
    } finally {
      setLoading(null);
    }
  }

  async function sendDigest() {
    setLoading("digest");
    try {
      const res = await fetch("/api/send-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth }),
      });
      const data = await res.json();
      if (data.error) {
        addMsg(`❌ Digest: ${data.error}`, "err");
      } else {
        addMsg(`✅ 月初總覽已發送到 Telegram（${data.sessions} 場 + ${data.papers ?? 0} 篇 paper 摘要）`);
      }
    } catch (err) {
      addMsg(`Digest failed: ${(err as Error).message}`, "err");
    } finally {
      setLoading(null);
    }
  }

  async function sendDailyBrief() {
    setLoading("daily");
    try {
      const res = await fetch("/api/daily-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) {
        addMsg(`❌ Daily brief: ${data.error}`, "err");
      } else if (data.message) {
        addMsg(`ℹ️ ${data.message}`);
      } else {
        addMsg(`✅ 今日摘要已發送（${data.sessions} 場，${data.papers} 篇 paper）`);
      }
    } catch (err) {
      addMsg(`Daily brief failed: ${(err as Error).message}`, "err");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">📚 Teaching Automation</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">月份</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
          <button
            onClick={loadSessions}
            className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
          >
            載入
          </button>
        </div>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Upload card */}
        <div className="bg-white rounded-lg shadow p-4 space-y-3">
          <h2 className="font-semibold text-lg">📤 上傳 & 解析</h2>
          <div>
            <label className="block text-sm text-gray-600 mb-1">時刻表 PDF</label>
            <input ref={scheduleRef} type="file" accept=".pdf"
              className="w-full text-sm border rounded p-1" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Paper PDFs（可多選）</label>
            <input ref={papersRef} type="file" accept=".pdf" multiple
              className="w-full text-sm border rounded p-1" />
          </div>
          <button onClick={handleUpload} disabled={loading === "upload"}
            className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {loading === "upload" ? "處理中…" : "上傳並解析"}
          </button>
        </div>

        {/* Actions card */}
        <div className="bg-white rounded-lg shadow p-4 space-y-3">
          <h2 className="font-semibold text-lg">⚡ 動作</h2>
          <button onClick={syncCalendar} disabled={loading === "sync"}
            className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
            {loading === "sync" ? "同步中…" : "🗓️ 同步到 Google Calendar"}
          </button>
          <button onClick={sendDigest} disabled={loading === "digest"}
            className="w-full py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50">
            {loading === "digest" ? "發送中…" : "📢 發送月初總覽 (Telegram)"}
          </button>
          <button onClick={sendDailyBrief} disabled={loading === "daily"}
            className="w-full py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50">
            {loading === "daily" ? "發送中…" : "🌅 發送今日摘要 (Telegram)"}
          </button>
        </div>
      </div>

      {/* Sessions table */}
      {sessions.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h2 className="font-semibold">{selectedMonth} 場次（{sessions.length} 場）</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">日期</th>
                  <th className="px-3 py-2 text-left">類型</th>
                  <th className="px-3 py-2 text-left">題目</th>
                  <th className="px-3 py-2 text-left">時間</th>
                  <th className="px-3 py-2 text-left">報告人</th>
                  <th className="px-3 py-2 text-center">Paper</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sessions.map((s) => (
                  <tr key={s.session_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap">{s.date.slice(5)}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        s.series === "dept_meeting"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-green-100 text-green-700"
                      }`}>
                        {SERIES_LABEL[s.series] ?? s.series}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-xs truncate" title={s.title}>{s.title}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                      {s.start_time}–{s.end_time}
                    </td>
                    <td className="px-3 py-2 text-gray-500 truncate max-w-24">
                      {s.presenter ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {s.paper_processed ? "✅" : s.has_paper ? "⏳" : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Paper summaries */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-semibold">📄 {selectedMonth} Paper 摘要（{papers.length} 篇）</h2>
          <button
            onClick={loadPapers}
            disabled={loading === "papers"}
            className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
          >
            {loading === "papers" ? "載入中…" : "載入摘要"}
          </button>
        </div>
        {papers.length === 0 ? (
          <p className="px-4 py-6 text-gray-400 text-sm text-center">
            點擊「載入摘要」查看 AI 回傳資料，或先上傳 paper PDFs
          </p>
        ) : (
          <div className="p-4 space-y-3">
            {papers.map((p) => (
              <PaperCard key={p.paper_id} paper={p} />
            ))}
          </div>
        )}
      </div>

      {/* Activity log */}
      {messages.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-2">📋 活動記錄</h2>
          <div className="space-y-1 font-mono text-sm">
            {messages.map((m, i) => (
              <div key={i} className={m.type === "err" ? "text-red-600" : "text-gray-700"}>
                {m.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
