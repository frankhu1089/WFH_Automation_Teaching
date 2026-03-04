#!/usr/bin/env npx tsx
/**
 * One-time Google OAuth2 setup.
 * Run: npm run setup:google
 *
 * Reads GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET from .env.local,
 * opens a local redirect server on :3333, and saves GOOGLE_REFRESH_TOKEN back.
 */

import { google } from "googleapis";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { URL } from "url";

// ── Load .env.local manually (tsx doesn't auto-load Next.js env files) ────────
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    // Value: everything after =, strip inline comment, trim quotes
    const rawVal = trimmed.slice(eqIdx + 1).replace(/#.*$/, "").trim();
    const val = rawVal.replace(/^["']|["']$/g, "");
    if (key && val && !process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvLocal();

// ─────────────────────────────────────────────────────────────────────────────

const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const REDIRECT_PORT = 3333;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      "❌ GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not found in .env.local"
    );
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    REDIRECT_URI
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.log("\n🔗 Opening browser for Google authorization...");
  console.log("\nIf it doesn't open automatically, visit:\n");
  console.log(authUrl, "\n");

  // Try to open browser automatically
  const { exec } = await import("child_process");
  exec(`open "${authUrl}"`);

  // Spin up a one-shot HTTP server to catch the redirect
  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) return;
      const url = new URL(req.url, REDIRECT_URI);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.end(`<h2>❌ Authorization failed: ${error}</h2><p>You can close this tab.</p>`);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (code) {
        res.end("<h2>✅ Authorization successful!</h2><p>You can close this tab and return to the terminal.</p>");
        server.close();
        resolve(code);
      }
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(`⏳ Waiting for Google redirect on http://localhost:${REDIRECT_PORT} ...`);
    });

    server.on("error", (err) => {
      reject(new Error(`Could not start redirect server: ${err.message}`));
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("Timeout: no redirect received within 2 minutes"));
    }, 120_000);
  });

  const { tokens } = await oauth2Client.getToken(code);
  const refreshToken = tokens.refresh_token;

  if (!refreshToken) {
    console.error(
      "❌ No refresh token received.\n" +
        "   → Go to https://myaccount.google.com/permissions, revoke this app, then re-run."
    );
    process.exit(1);
  }

  // Write GOOGLE_REFRESH_TOKEN back to .env.local
  const envPath = path.join(process.cwd(), ".env.local");
  let existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

  if (/^GOOGLE_REFRESH_TOKEN\s*=.*/m.test(existing)) {
    existing = existing.replace(
      /^GOOGLE_REFRESH_TOKEN\s*=.*/m,
      `GOOGLE_REFRESH_TOKEN=${refreshToken}`
    );
  } else {
    existing += `\nGOOGLE_REFRESH_TOKEN=${refreshToken}\n`;
  }

  fs.writeFileSync(envPath, existing);

  console.log("\n✅ GOOGLE_REFRESH_TOKEN saved to .env.local");
  console.log(
    "\nNext steps:\n" +
      "  1. npm run dev  →  http://localhost:3000\n" +
      "  2. Upload schedule PDF → click 'Sync to Google Calendar'\n" +
      "  3. Copy the logged GOOGLE_CALENDAR_ID → add to .env.local\n"
  );
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
