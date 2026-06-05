import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

export async function GET() {
  Sentry.captureException(new Error("sentry-tunnel-verification-5jun2026"), {
    tags: { test: "true", location: "sentry-test-route" },
  });
  return NextResponse.json({ ok: true, message: "test error captured" });
}
