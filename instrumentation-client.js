// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://106b2e2cd84cdf84482e9cbbb061e94e@o4511450265944064.ingest.us.sentry.io/4511450267451392",

  enabled: process.env.NODE_ENV === "production",
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,

  integrations: [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })],

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // No idle session recording — only capture replays when an error occurs.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
