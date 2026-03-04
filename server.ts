/**
 * Custom Next.js server with node-cron for daily 08:00 Telegram brief.
 * Run with: npm run dev  (uses tsx for TypeScript)
 *
 * For production: npm run build && npm run start
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import cron from "node-cron";
import { initDb } from "./db/index";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Initialize SQLite DB
  initDb();

  // Daily brief cron: every day at 08:00 Asia/Taipei
  // node-cron uses system timezone; set TZ=Asia/Taipei in .env.local or shell
  cron.schedule(
    "0 8 * * *",
    async () => {
      console.log("[cron] Triggering daily brief...");
      try {
        const res = await fetch(`http://${hostname}:${port}/api/daily-brief`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        console.log("[cron] Daily brief result:", data);
      } catch (err) {
        console.error("[cron] Daily brief error:", err);
      }
    },
    {
      timezone: "Asia/Taipei",
    }
  );

  console.log(`[cron] Daily brief scheduled at 08:00 Asia/Taipei`);

  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  }).listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
