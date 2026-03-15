import { google } from "googleapis";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "http://localhost:3000/api/auth/callback"
  );

  if (!code) {
    return NextResponse.json({ error: "No code received" });
  }

  const { tokens } = await oauth2Client.getToken(code);

  return NextResponse.json({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });
}