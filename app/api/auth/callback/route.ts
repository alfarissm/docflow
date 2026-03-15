import { google } from "googleapis";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const redirectUri =
      process.env.NODE_ENV === "production"
        ? "https://docflow-jade.vercel.app/api/auth/callback"
        : "http://localhost:3000/api/auth/callback";

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["https://www.googleapis.com/auth/drive.file"],
    });

    return NextResponse.json({ authUrl });
  } catch {
    return NextResponse.json(
      { error: "Upload init failed" },
      { status: 500 }
    );
  }
}