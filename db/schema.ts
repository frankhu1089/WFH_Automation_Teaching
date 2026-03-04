import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  session_id: text("session_id").primaryKey(),
  month: text("month").notNull(), // YYYY-MM
  date: text("date").notNull(), // YYYY-MM-DD
  series: text("series").notNull(), // journal_club | dept_meeting | other
  title: text("title").notNull(),
  time_policy: text("time_policy").notNull(), // LUNCH_DEFAULT | TUE_BLOCK
  start_time: text("start_time").notNull(), // HH:MM
  end_time: text("end_time").notNull(), // HH:MM
  location: text("location"),
  presenter: text("presenter"),
  source: text("source"),
  raw_text: text("raw_text").notNull().default(""),
  dedupe_key: text("dedupe_key").notNull().unique(),
  google_event_id: text("google_event_id"),
  created_at: text("created_at").notNull(),
});

export const papers = sqliteTable("papers", {
  paper_id: text("paper_id").primaryKey(),
  session_id: text("session_id"),
  filename: text("filename").notNull(),
  file_hash: text("file_hash").notNull().unique(),
  summary_json: text("summary_json"), // JSON string
  created_at: text("created_at").notNull(),
});

export const notification_log = sqliteTable("notification_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(), // monthly_digest | daily_brief
  month: text("month"),
  sent_at: text("sent_at").notNull(),
  status: text("status").notNull(), // success | error
  error_message: text("error_message"),
});
