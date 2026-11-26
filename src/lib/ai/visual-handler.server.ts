export async function handleVisualAnalysis(request: Request): Promise<Response> {
  try {
    const { authorizeVisualRequest, analyzeVisuals } = await import("@/lib/ai/visual.server");
    await authorizeVisualRequest(request);
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 12_000_000)
      return Response.json({ error: "Screenshots are too large for analysis." }, { status: 413 });
    const text = await request.text();
    if (text.length > 12_000_000)
      return Response.json({ error: "Screenshots are too large for analysis." }, { status: 413 });
    const result = await analyzeVisuals(JSON.parse(text));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to analyse screenshots.";
    const safe =
      /^(Sign in|Invalid request origin|AI provider|CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|LOVABLE_API_KEY|Direct Cloudflare|The AI response|The AI returned)/.test(
        message,
      )
        ? message
        : "Unable to analyse screenshots. Check the images and try again.";
    return Response.json(
      { error: safe },
      {
        status: /^(Sign in|Invalid request origin)/.test(safe) ? 401 : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
