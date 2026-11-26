# Synthetic UX Lab

A desktop-first internal prototype for comparing 2–3 interface variants with AI-generated-looking synthetic user simulations. Synthetic results are a pre-testing signal and do not replace real users or usability research.

## Included

- Five-step experiment setup, screenshot variants, reviewed target areas and a synthetic first-action pilot.
- H&M/Zara example and demo with shared comparison controls, click heatmaps, persona-specific attention paths, UEyes and optional visual accessibility suggestions.
- A separate in-memory trial with the same five steps and a raw-data ZIP download. Download before leaving or reloading: trial data is not persisted.
- Admin placeholders, Lovable Cloud sign-in and OAuth-protected MCP tools.

Synthetic results are model predictions, not observed users, task-completion measurements or an accessibility audit. Experiments remain bundled mock data and admin settings use browser storage; there is no application database for trials. See [project handoff](project-handoff/LOVABLE-HANDOFF.md) for architecture, limitations and verification.

## Development

```sh
bun install
bun run dev
```

Run tests with:

```sh
bunx vitest run
```

## Stack

- TanStack Start
- React and TypeScript
- Tailwind CSS
- Lovable Cloud authentication
- `@lovable.dev/mcp-js`

Imported from [abhinavpaitandy/synthetic-ux-lab](https://github.com/abhinavpaitandy/synthetic-ux-lab).

## AI provider configuration

The server-side provider layer uses Lovable's AI gateway when `LOVABLE_API_KEY` is available. For local development, create an ignored `.env.local` file:

```env
AI_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
```

Optionally set `CLOUDFLARE_AI_MODEL` to another compatible vision model. Start with `npm run dev:local`; the server loads `.env.local` and listens on localhost. Direct Cloudflare access is restricted to local development. Lovable's managed key takes precedence in hosted environments. Keep tokens server-side and never use the `VITE_` prefix. Lovable secrets are managed in Lovable.

On the target-review step, **Analyse screenshots with AI** sends the screenshots and task details to the configured provider and returns visual observations and suggested target boxes. Review all suggestions. The screenshot pilot uses model-generated predictions; its numerical results are not measured user behaviour. For local API access, run `npm run dev:local`; this binds the server to localhost. Lovable-hosted AI requests require a signed-in user.
