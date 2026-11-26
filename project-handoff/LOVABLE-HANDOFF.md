# Synthetic UX Lab — handoff for Lovable

Updated: 24 November 2026

## Product intent

Build a screenshot-based synthetic UX pilot to compare interface variants. The example compares H&M and Zara mobile T-shirt product pages. A user defines a base persona, task and success event, supplies variants, reviews target boxes, selects pilot size and behavioural diversity, and runs independently simulated first-action predictions. The results should aggregate model-produced click coordinates into heatmaps, show click distributions inside and outside reviewed target areas, and let the user inspect the individual runs. These are synthetic model predictions, not actual user sessions or validated user behaviour. A screenshot pilot cannot determine task completion or capture real live browsing.

The base example uses the Fashion Aspirer persona, the task “Find and add the T-shirt to the shopping bag”, and add-to-bag buttons as targets. The user expects distinct variants of the base persona covering age, gender, geography, shopping experience, browsing habits and motivations. The same participant profiles should be used across variants for a paired comparison. Do not infer behavioural ability or preference from demographics alone. Fictional profiles are not a representative population unless calibrated against suitable research.

## Project rules and safety

Read `AGENTS.md` in the project root first. Lovable manages the AI gateway, connectors, secrets and database changes. Keep model calls on Lovable's gateway and keys out of browser code; use Lovable for changes to those managed pieces. Do not rewrite published Git history. Do not overwrite the many existing uncommitted changes. No credentials belong in these notes or in Git. This handoff is a description of the observed state, not a request to publish, deploy, or change a database.

## Current blocker: provider is still Cloudflare

Kilo was researched and tested, but **the application has not been switched to it**. `src/lib/ai/provider.server.ts` selects Lovable when `LOVABLE_API_KEY` is present, otherwise local development can use the explicitly configured Cloudflare provider. The local app at `127.0.0.1:8081` currently reaches Cloudflare, whose requests for persona generation returned HTTP 429 (rate limit or quota). The provider response did not identify which limit was reached. The app therefore stops before the screenshot pilot and no new heatmap is produced.

Kilo's gateway was initially blocked by a Zscaler caution page. After the user handled the prompt, an anonymous text request from the local environment to Kilo returned HTTP 200 and `ready`. Kilo's catalog listed `nvidia/nemotron-3.5-super-vl:free` with text and image input and zero input/output pricing at that time. **Only a text request was tested**: image input, structured output, reliability, limits and 200-run performance were not verified. Anonymous free-model access and model availability can change. Do not assume the Zscaler exception persists or that Lovable's gateway supports Kilo: verify the supported integration/connector first.

The user wants to use a free Kilo model. In Lovable, determine whether the Lovable gateway or an approved native connector supports routing to Kilo. If available, configure the server-side provider/connector and any necessary secrets in Lovable. If not supported, explain the actual limitation and available supported options rather than silently continuing on Cloudflare. Keep the user informed which provider and model are actually serving requests. Verify image requests, JSON parsing, limits and failure handling before attempting 200 calls. Ensure usage, data handling and any commercial-use terms are appropriate for the screenshots.

## Implementation map

- `src/routes/experiments.new.index.tsx`, `.variants.tsx`, `.targets.tsx`, `.simulation.tsx`: five-step experiment flow (results in the experiment route).
- `src/lib/draft-store.tsx` and `src/lib/types.ts`: draft and pilot state. Pilot results exist in the active browser draft; they are not durable experiment records.
- `src/lib/ai/pilot-personas.ts`: generates deterministic structured starting profiles for 1–1000 participants. These are illustrative, not a statistically representative sample.
- `src/lib/ai/pilot-client.ts`: creates the starting profiles, sends batches of up to 10 to `/api/pilot-personas` for AI-generated variations, checks count/duplicates, then sends each paired profile to `/api/screenshot-pilot` for each variant with two workers. Completion requires all calls to succeed. It currently stops on the first error and does not resume completed runs.
- `src/lib/ai/pilot.server.ts`: handlers for persona generation and one screenshot first-action inference. Screenshot slices are supplied as images; validated per-slice coordinates are transformed to full-image normalized coordinates. Calls go through `requestAIChat` in `provider.server.ts`.
- `src/server.ts`: registers `/api/pilot-personas`, `/api/screenshot-pilot` and `/api/visual-analysis`.
- `src/lib/ai/visual-client.ts`, `visual-handler.server.ts`, `visual.server.ts`: screenshot analysis, slicing and its separate client-side session cache. Do not confuse cached visual comparison results with independent pilot runs.
- `src/components/simulated-click-heatmap.tsx`: uses heatmap.js over normalized click points and includes an inside/outside target summary. `src/routes/experiments.$experimentId.tsx` shows the prototype results and individual pilot runs.
- `src/components/target-review-card.tsx` and `target-overlay-preview.tsx`: target selection and overlays. `src/lib/demo-variants.ts` and `public/demo/` contain the example screenshot URLs and images.
- `src/components/pilot-verification.tsx` and `public/demo/pilot-verification.json`: read-only record of the earlier direct endpoint test at `/experiments/pilot-verification`. It is not a current corrected pilot.

## Evidence and outstanding work

1. An earlier direct endpoint test completed 100 requests for each screenshot, but cycled through only **three** behavioural profiles and used a shortened base persona. It did not exercise the full browser workflow. H&M produced only three exact click coordinates and Zara 12, all clustered near the add buttons. Do not present this as the requested 100-persona experiment or as validated evidence. No reviewed target boxes were recorded for that test.
2. The implementation now creates 100 distinct starting profiles and asks the configured model to write persona variations. The same profiles are paired across variants. Tests in `src/test/pilot-personas.test.ts` verified profile uniqueness and pairing with mocked model responses, and `npx tsc --noEmit` passed. A live test of `/api/pilot-personas` was blocked by Cloudflare 429, so **AI-generated profile quality, the new pipeline, and heatmap rendering have not been verified end to end**. The previous production build passed before the latest persona-generation changes; rerun it.
3. The current profile generation builds demographic seeds from hard-coded countries and traits. Improve this to respect the supplied base persona and experiment market, make generated profiles coherent and reviewable, and expose the cohort or a sample before running. Avoid inventing distributions or representing AI-generated variations as customer research. The new AI response is validated for count, length and exact duplicate text, but semantic duplication and contradictions are not reliably checked. Do not silently substitute fictional values when the AI fails.
4. Run a small real provider test first: inspect generated profile count and coherence, verify the same profile is used once per variant, verify image slice mapping and first-click coordinates, and confirm results/heatmaps render over both full images with correct alignment and meaningful percentage denominators. Cover no-action outcomes and failure/cancellation without showing stale results as a completed new pilot.
5. Once the above works, run the requested **100 distinct persona variations per variant** on H&M and Zara, record actual completed/failed counts, inspect individual outcomes, and verify both heatmaps in the user's preview. Use a paced/resumable queue with correct handling of 429, retry limits and interruption; do not fabricate clicks or discard a successful pilot on a transient failure. Clearly label all findings as model predictions. Do not mix prior cached observations with a failed or different run.
6. Clarify the heatmap scale: the current component uses a smoothed heatmap.js intensity layer plus inside/outside percentages. A colour scale should specify exactly what percentage is represented and its denominator; a blurred density peak must not be labelled as an individual click percentage without an appropriate calculation.
7. The completed example `exp-1042` and current prototype have separate paths. Keep their labels and data provenance honest; do not imply the old completed example contains new pilot results or live recorded clicks.

## Persona sources supplied by the user

- Sunlight Foundation open-data persona library: https://communities.sunlightfoundation.com/discovery/personas-library/ — useful as examples of research-based goals, context and behaviour, but not fashion-customer data.
- PersonaBase: https://github.com/joolsa/PersonaBase — MIT-licensed repository of persona prompts, methods, datasets and notebooks. Check licences separately for linked data.
- PersonaHub: https://huggingface.co/datasets/proj-persona/PersonaHub — labelled CC BY-NC-SA 4.0 and research-only by its authors. Do not import into a commercial application without confirming permitted use. Synthetic profiles and dataset examples are not measured user behaviour.

Use the user's actual Fashion Aspirer research as the anchor when available; source and provenance should be explicit. These references informed the approach; no PersonaHub data was imported.

## Local development and tests

From the project directory: `npm run dev:local`. It loads `.env.local` and chooses another port if 8080 is occupied; check the terminal's displayed URL and make sure the preview points to that process. Do not print or commit `.env.local` or any token. Useful checks: `npx vitest run src/test/pilot-personas.test.ts`, `npx tsc --noEmit`, and `npm run build`. Browser preview verification is still required; an HTTP 200 alone does not confirm heatmap visibility or placement.

## Local Kilo update

Following the user's explicit instruction, local development now supports `AI_PROVIDER=kilo` through the same server-only, local-development pattern as the earlier direct Cloudflare integration. The local `.env.local` selects Kilo; an optional Kilo API key is not required for anonymous free model access. Lovable deployment still uses its managed gateway and does not permit direct Kilo outside development. On 24 November, the local preview at port 8084 produced two generated personas and successfully analysed one H&M screenshot using Kilo. A complete 100-per-variant run, Zara screenshot, heatmap rendering, reliability and limits remain unverified. Port 8081 was started with the old environment and needs a restart to pick up the new selection; the separate 8084 preview has its own in-memory draft.

## Example preservation and current findings

The completed example (`exp-1042`) reads a shared browser `localStorage` snapshot. A newly completed H&M/Zara pilot automatically saves its complete draft, reviewed targets, profiles and decisions there; an open example tab listens for changes. Restoring an older completed tab seeds the example only when no snapshot exists, so an old tab cannot silently overwrite a newer run. For an already completed run, open its results in the original tab and use “Save this pilot to example” to replace an existing snapshot deliberately. Only a complete run with both bundled screenshots, reviewed targets and ten decisions per variant qualifies; partial runs never replace the example. The example offers JSON and XLSX exports. The original bundled visual comparison remains the fallback without a qualifying snapshot. Browser storage can be cleared and is not shared across devices. Do not claim a specific user run was copied without comparing its data or inspecting its archive.

The user's 24 November result screenshot displayed 10 clicks per variant, 100% inside H&M's target and 90% inside Zara's; their downloaded spreadsheet contained 10 profiles, but it does not include the 20 click coordinates. The screenshot alone cannot independently verify all decisions. Do not reconstruct or fabricate individual outcomes from those aggregate percentages.

Following that run, persona generation was changed to high diversity by default, with ten illustrative first-action strategies; prompts now allow reasonable intermediate or competing controls without forcing errors. Cache keys were versioned to avoid mixing old-prompt results with new runs. A small eight-decision live check produced more diverse choices but showed that some returned coordinates did not match the named control. This coordinate/label mismatch remains unresolved and limits the trustworthiness of heatmaps and off-target percentages. No full pilot has validated the revised prompt.
