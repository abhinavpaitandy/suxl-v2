# Synthetic UX Lab

A desktop-first internal prototype for comparing 2–3 interface variants with AI-generated-looking synthetic user simulations. Synthetic results are a pre-testing signal and do not replace real users or usability research.

## Included

- Experiment dashboard with five realistic mock experiments
- Four-step experiment setup with screenshot uploads and target review
- Prototype simulation results, comparison charts, cohorts, and click maps
- Admin screen placeholders
- Email/password and Google sign-in through Lovable Cloud
- OAuth-protected MCP tools for listing experiments, reading experiment details, and comparing variants

The experiment data is bundled mock data. Admin settings use browser-local storage. There is no real simulation engine or application database schema in this version.

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

On the target-review step, **Analyse screenshots with AI** sends the screenshots and task details to the configured provider and returns visual observations and suggested target boxes. Review all suggestions. The simulation and its numerical results are still mock data, not measured user behaviour. For local API access, run `npm run dev:local`; this binds the server to localhost. Lovable-hosted AI requests require a signed-in user.
