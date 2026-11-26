/** Server-only AI provider configuration. Never import this module into browser code. */

export type AIEnvironment = Record<string, string | undefined>;

export interface AIProviderConfig {
  provider: "cloudflare" | "lovable" | "kilo";
  endpoint: string;
  model: string;
  apiKey: string;
}

/** Lovable always wins when its project key is present, including preview sandboxes. */
export function getAIProviderConfig(env: AIEnvironment = process.env): AIProviderConfig {
  const lovableKey = env["LOVABLE_API_KEY"]?.trim();
  const selected = env["AI_PROVIDER"]?.trim();
  if (selected && selected !== "cloudflare" && selected !== "lovable" && selected !== "kilo") {
    throw new Error("AI_PROVIDER must be cloudflare, kilo or lovable.");
  }
  if (selected === "kilo") {
    if (env["NODE_ENV"] !== "development") throw new Error("Direct Kilo access is available only in local development.");
    return { provider: "kilo", endpoint: "https://ai-gateway.kilo.ai/api/v1/chat/completions", model: env["KILO_AI_MODEL"]?.trim() || "nvidia/nemotron-3.5-super-vl:free", apiKey: env["KILO_API_KEY"]?.trim() || "" };
  }
  if (lovableKey) {
    return {
      provider: "lovable",
      endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions",
      model: env["LOVABLE_AI_MODEL"]?.trim() || "google/gemini-3.7-flash",
      apiKey: lovableKey,
    };
  }
  if (selected === "cloudflare") {
    if (env["NODE_ENV"] !== "development") {
      throw new Error("Direct Cloudflare access is available only in local development.");
    }
    const key = env["CLOUDFLARE_API_TOKEN"]?.trim();
    const accountId = env["CLOUDFLARE_ACCOUNT_ID"]?.trim();
    if (!key) throw new Error("CLOUDFLARE_API_TOKEN is required for local Cloudflare access.");
    if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId))
      throw new Error("CLOUDFLARE_ACCOUNT_ID must be a valid Cloudflare account ID.");
    return {
      provider: "cloudflare",
      endpoint: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`,
      model: env["CLOUDFLARE_AI_MODEL"]?.trim() || "@cf/google/gemma-4-26b-a4b-it",
      apiKey: key,
    };
  }
  throw new Error("LOVABLE_API_KEY is required for the Lovable AI gateway.");
}

/** Make an OpenAI-compatible chat request from a server handler only. */
export async function requestAIChat(
  messages: Array<{
    role: "system" | "user" | "assistant";
    content:
      | string
      | Array<
          | { type: "text"; text: string }
          | { type: "image_url"; image_url: { url: string; detail: "high" } }
        >;
  }>,
  options: { env?: AIEnvironment; fetch?: typeof fetch } = {},
): Promise<string> {
  const config = getAIProviderConfig(options.env);
  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(config.endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(85000),
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        ...(config.provider === "lovable" ? { "Lovable-API-Key": config.apiKey } : {}),
      },
      body: JSON.stringify({ model: config.model, messages }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError")
      throw new Error("AI provider timed out after 85 seconds. Please try again.");
    throw new Error(
      "AI provider could not be reached. Check the network connection and try again.",
    );
  }
  if (!response.ok) {
    if (response.status === 429) {
      let code: unknown;
      try {
        code = ((await response.json()) as { error?: { code?: unknown } }).error?.code;
      } catch {
        /* A provider may return a non-JSON error. */
      }
      if (code === "insufficient_quota")
        throw new Error("AI provider quota is exhausted. Check API billing and credits.");
      if (config.provider === "kilo" && code === "PROMOTION_MODEL_LIMIT_REACHED")
        throw new Error("AI provider's anonymous Kilo allowance is exhausted. Wait and resume, or sign in to Kilo and configure a free API key for local use.");
      throw new Error(
        "AI provider rate limit or quota reached (HTTP 429). Check API usage and billing, then retry.",
      );
    }
    if (response.status === 401)
      throw new Error(
        "AI provider rejected the API key (HTTP 401). Check the server configuration.",
      );
    throw new Error(`AI provider request failed (HTTP ${response.status}).`);
  }
  const body: unknown = await response.json();
  const content = (body as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]
    ?.message?.content;
  if (typeof content !== "string") throw new Error("AI provider returned an invalid response.");
  return content;
}
