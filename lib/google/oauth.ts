import { google } from "googleapis";

// ─── OAuth2 client factory ────────────────────────────────────────────────────

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID!,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    process.env.GOOGLE_OAUTH_REDIRECT_URI!
  );
}

// Narrow scope — only files created by this app are accessible
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
];

// ─── Generate authorization URL ──────────────────────────────────────────────

export function getAuthorizationUrl(state?: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // always ask for consent so we always get a refresh_token
    state: state ?? "",
  });
}

// ─── Exchange code for tokens ─────────────────────────────────────────────────

export type OAuthTokens = {
  access_token: string | null | undefined;
  refresh_token: string | null | undefined;
  scope: string | null | undefined;
  token_type: string | null | undefined;
  expiry_date: number | null | undefined;
};

export async function exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    scope: tokens.scope,
    token_type: tokens.token_type,
    expiry_date: tokens.expiry_date,
  };
}

// ─── Get authenticated email from tokens ─────────────────────────────────────

export async function getGoogleEmail(tokens: OAuthTokens): Promise<string | null> {
  try {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    return data.email ?? null;
  } catch {
    return null;
  }
}
