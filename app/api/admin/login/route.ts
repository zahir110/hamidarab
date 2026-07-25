import { NextResponse } from "next/server";
import { ADMIN_COOKIE, createAdminSession } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  const configuredPin = process.env.ADMIN_PIN;
  if (!configuredPassword || !configuredPin) {
    return NextResponse.json({ error: "Admin access is not configured on the server." }, { status: 503 });
  }

  let body: { password?: string; pin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid login request." }, { status: 400 });
  }

  if (body.password !== configuredPassword || body.pin !== configuredPin) {
    return NextResponse.json({ error: "Wrong password or PIN." }, { status: 401 });
  }

  const session = createAdminSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: session.expires,
  });
  return response;
}
