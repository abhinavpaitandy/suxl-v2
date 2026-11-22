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
