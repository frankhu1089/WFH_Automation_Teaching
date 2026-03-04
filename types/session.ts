export type Series = "journal_club" | "dept_meeting" | "other";
export type TimePolicy = "LUNCH_DEFAULT" | "TUE_BLOCK";

export interface Session {
  session_id: string;
  month: string; // YYYY-MM
  date: string; // YYYY-MM-DD
  series: Series;
  title: string;
  time_policy: TimePolicy;
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  location: string | null;
  presenter: string | null;
  source: string | null;
  raw_text: string;
  dedupe_key: string;
  created_at: string;
}

export interface ParsedSessionRaw {
  date: string;
  series: Series;
  title: string;
  location?: string | null;
  presenter?: string | null;
  source?: string | null;
  raw_text?: string;
}
