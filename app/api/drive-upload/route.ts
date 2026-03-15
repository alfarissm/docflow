import { google } from "googleapis";
import { NextResponse } from "next/server";
import { Readable } from "stream";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: process.env.GOOGLE_ACCESS_TOKEN,
    });

    const drive = google.drive({
      version: "v3",
      auth,
    });

    const buffer = Buffer.from(Uint8Array.from(body.pdf));
    const stream = Readable.from(buffer);

    const file = await drive.files.create({
      requestBody: {
        name: body.fileName,
      },
      media: {
        mimeType: "application/pdf",
        body: stream,
      },
      fields: "id",
    });

    return NextResponse.json({
      success: true,
      fileId: file.data.id,
      fileName: body.fileName,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Google Drive upload failed" },
      { status: 500 }
    );
  }
}