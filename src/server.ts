import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Hosting compresses every response at the edge. Never compress a body (gzip, brotli,
// CompressionStream) or set content-encoding here or in a server route: the body gets encoded
// twice and renders garbled.
export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      if (new URL(request.url).pathname === "/api/pilot-cache-context") {
        if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
        const { authorizeVisualRequest } = await import("./lib/ai/visual.server");
        const { getAIProviderConfig } = await import("./lib/ai/provider.server");
        try {
          await authorizeVisualRequest(request);
          const { provider, model } = getAIProviderConfig();
          return Response.json({ provider, model }, { headers: { "Cache-Control": "no-store" } });
        } catch { return Response.json({ error: "Unable to identify the configured AI provider." }, { status: 400 }); }
      }
      if (new URL(request.url).pathname === "/api/pilot-personas") {
        if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
        const { handlePilotPersonas } = await import("./lib/ai/pilot.server");
        return handlePilotPersonas(request);
      }
      if (new URL(request.url).pathname === "/api/screenshot-pilot") {
        if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
        const { handlePilot } = await import("./lib/ai/pilot.server");
        return handlePilot(request);
      }
      if (new URL(request.url).pathname === "/api/visual-analysis") {
        if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
        const { handleVisualAnalysis } = await import("./lib/ai/visual-handler.server");
        return handleVisualAnalysis(request);
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
