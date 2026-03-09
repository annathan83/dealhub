/**
 * One-off script: rename existing Drive deal folders to the new convention.
 * Old: {sanitized-name}__{deal-id}
 * New: {deal-id}_{sanitized-name}
 *
 * Run once: node scripts/rename-drive-folders.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

// ── Load .env.local ───────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
const envLines = readFileSync(envPath, "utf-8").split("\n");
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
}

function sanitizeName(input) {
  return input
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "entry";
}

// ── Deals to rename (retrieved from DB via MCP) ───────────────────────────────
const deals = [
  {
    id: "163a2951-3628-413e-a4ab-3192b18fa9cc",
    name: "2 Child Care",
    folderId: "1RRP3r8_HBuWLizXIIkAqdi314sX8tRU8",
  },
  {
    id: "5eb2d375-af11-4f0e-927a-6a179c493ebf",
    name: "ABC Learning Academy",
    folderId: "12WlQ4dr8AegiIDJn_0Et09vPfC4M6uU6",
  },
];

// Load tokens from environment variables — never hardcode credentials here
const tokens = {
  access_token: process.env.GOOGLE_ACCESS_TOKEN,
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  expiry_date: process.env.GOOGLE_TOKEN_EXPIRY ? parseInt(process.env.GOOGLE_TOKEN_EXPIRY) : undefined,
};

async function main() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID.trim(),
    process.env.GOOGLE_OAUTH_CLIENT_SECRET.trim(),
    process.env.GOOGLE_OAUTH_REDIRECT_URI.trim()
  );
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });

  const drive = google.drive({ version: "v3", auth: oauth2Client });

  for (const deal of deals) {
    const newName = `${deal.id}_${sanitizeName(deal.name)}`;

    // Check current name
    const { data: file } = await drive.files.get({
      fileId: deal.folderId,
      fields: "id,name",
    });

    if (file.name === newName) {
      console.log(`[OK]     "${deal.name}" already named correctly: ${newName}`);
      continue;
    }

    console.log(`[RENAME] "${deal.name}"`);
    console.log(`         ${file.name}`);
    console.log(`      -> ${newName}`);

    await drive.files.update({
      fileId: deal.folderId,
      requestBody: { name: newName },
      fields: "id,name",
    });

    console.log(`         Done.\n`);
  }

  console.log("All done.");
}

main().catch((err) => {
  console.error("Script failed:", err.message);
  process.exit(1);
});
