# Synthetic UX Lab — project handoff

Updated: 26 November 2026

## Product and scope

Synthetic UX Lab compares screenshots of interface variants using fictional people derived from a base persona. The H&M/Zara example asks people to find a T-shirt and add it to a shopping bag. The current pilot generates 10 profiles and uses the same profiles for each variant, predicting one first action and a persona-specific attention path per person and screenshot. Results include click heatmaps, percentages inside and outside reviewed target boxes, individual decisions, and exports. The predictions are illustrative model outputs, not measured user behaviour, eye tracking, a representative population or task-completion rates.

Read `AGENTS.md` before making changes. Lovable manages its gateway, secrets, connectors and database; keep credentials out of the repository and browser. Preserve published Git history and keep the connected branch working. The user has deferred Lovable import; a GitHub push does not itself verify a Lovable sync.

## Current results and comparison

- The example at `/experiments/exp-1042` and demo results at `/experiments/prototype-current` share a comparison panel: heatmap, persona attention, UEyes attention, illustrative path and accessibility toggles apply to all variants, as does the person selector. Each image keeps its own predictions, target statistics, individual runs and heatmap download.
- The Accessibility layer sends each screenshot to the configured server-side AI provider for possible visual accessibility concerns. It places pulsing markers at model-predicted coordinates; hovering, focusing or clicking a marker opens a persistent card with the issue, suggestion, copy and close controls. Animation respects reduced-motion settings. “About these overlays” explains each layer; five switches share a row at desktop widths and wrap on smaller screens.
- Accessibility output is unverified AI interpretation of pixels, not a deterministic accessibility or WCAG audit. Screenshot analysis cannot establish keyboard, screen-reader, semantic or measured contrast behavior. Coordinates and suggestions require human review. [LayoutLens](https://github.com/gojiplus/layoutlens) was considered as an example; its deterministic axe-core checks require a rendered page and DOM, and are not integrated here.
- “Run fresh accessibility analysis” bypasses the browser's per-image and provider/model session cache and requests new findings for all variants. Requests are queued sequentially; malformed model output is retried once, and an error with a retry control is shown rather than inventing findings. On 26 November fresh results appeared for H&M and Zara in both example and demo; one Zara run initially returned invalid JSON and succeeded after another retry. Screenshots are sent to the configured provider when this analysis runs.
- The illustrative path's intermediate points are invented. Persona paths are model predictions for each profile and screenshot. UEyes is a general free-viewing prediction and is not conditioned on an individual or task. See `ueyes-local-evaluation.md` for implementation, model provenance and deployment limitations.
- The saved pilot used for the latest demo has 20 decisions, including 20 persona-specific paths. Each variant has nine predicted first clicks and one no-action decision. For the saved target boxes, H&M reports 89% of clicks inside and Zara 78%; these are percentages of the nine predicted clicks per variant, rounded for display. The click heatmap is a smoothed concentration display, not a calibrated percentage colour scale.
- On 26 November the saved pilot was restored to the demo and checked in preview: both heatmaps rendered, the shared person selector and three attention layers worked for both variants, and both downloaded files were valid 1179 × 2556 PNGs. H&M's person 6 had no click, so no illustrative click path was shown for that person; Zara's was shown. These checks used saved results, not a newly run live pilot.

## Data and recovery

The active wizard draft is stored in the current browser tab's `sessionStorage`. Pilot checkpoints are saved in browser storage to support resuming completed people and decisions after failure; cache identity includes the experiment inputs and provider context. A complete qualifying H&M/Zara pilot is also saved as an example in `localStorage`. The example and its previous backup can be exported from the results page. An incomplete or failed pilot must not be presented as a complete result.

On the simulation page, **Restore saved pilot to demo** restores a qualifying completed example into the active draft. Before replacement, the current draft is backed up in `localStorage`; if backing it up fails, restoration stops. **Download previous demo draft (.json)** exports the latest backup. Browser storage can be cleared and is not shared across devices; this download is an archive, and there is currently no UI for importing it back into the wizard.

Portable copies of the updated and previous example are in `project-handoff/example-pilots/`. They contain the saved profiles, targets, decisions and paths and reference the bundled screenshots in `public/demo/`. They do not automatically populate browser storage. The demo draft backup downloaded during verification is a separate local file; it is not included in the repository.

## Architecture

- `src/routes/experiments.new.*`: setup, variants, reviewed targets and the People/Prototype simulation stages.
- `src/lib/draft-store.tsx`: browser-backed wizard state and protected saved-pilot restoration.
- `src/lib/ai/pilot-client.ts`, `pilot-cache.ts`, `pilot.server.ts` and `provider.server.ts`: persona generation, independent screenshot decisions, checkpoints, server validation and provider selection. Local development may select Kilo; Lovable uses its managed gateway. Never place API keys in client code or Git.
- `src/components/accessibility-overlay.tsx`, `src/lib/ai/accessibility-schema.ts`, `accessibility.server.ts` and the `/api/accessibility-analysis` route in `src/server.ts`: validated screenshot suggestions, normalized marker positions, persistent cards, copy/close and session caching. Requests use the existing server-only provider and authorization; no credentials enter browser code. The cache is not a durable record and is shared by both results views in the same tab session.
- `src/components/comparison-controls.tsx`, `click-heatmap-preview.tsx` and `simulated-click-heatmap.tsx`: shared controls and per-variant layers, summaries and PNG export. `src/routes/experiments.$experimentId.tsx` renders both example and current demo results.
- `src/lib/saved-example.ts`, `pilot-export.ts`, `demo-variants.ts` and `public/demo/`: example validation, export and bundled images. `src/components/target-review-card.tsx` and `target-overlay-preview.tsx` manage target selection and positioning.
- The local-only UEyes endpoint and model setup are described separately in `ueyes-local-evaluation.md`; local model dependencies and weights are not committed. Lovable does not automatically gain that endpoint.

## Outstanding work

1. Validate whether predicted coordinates align with the control named by the model; earlier live tests found occasional coordinate/label mismatches. Do not infer reliable usability or compare performance as measured customer data.
2. Improve variation and the handling of competing affordances without forcing mistakes. Assess profile coherence and calibration against actual research, and avoid demographic stereotypes. Ten synthetic people are a small illustrative sample.
3. Verify provider availability, limits, image support and current terms before a new live run. Kilo free-model quotas and HTTP 429s have interrupted prior runs; saved results do not establish current provider reliability. Keep Lovable gateway configuration managed by Lovable.
4. A 100-distinct-persona-per-variant pilot is not established by the current saved ten-person pilot. Do not extrapolate or represent it as one.
5. The heatmap download exports the image and click heatmap; it does not export the optional attention path overlays or the target outline. A meaningful percentage colour legend needs a defined denominator and appropriate calculation.

## Development and verification

Use `npm run dev:local` with a locally configured, untracked `.env.local`; check the printed port. Never print or commit credentials. Useful checks are `npm test -- --run`, `npx tsc --noEmit` and `npm run build`; also verify results in the browser, including the saved data and exports. The recent comparison tests cover synchronized person and heatmap controls; the full suite passed 46 tests on 26 November. The accessibility overlay test simulates pointer hover and leaving, checks that the card stays open, verifies the copied issue and suggestion through a mocked clipboard, checks close, and verifies that a fresh run bypasses the cache. In preview, the cards, copy confirmation and close were checked on H&M and Zara in both results views; real mouse-hover interaction was not directly tested by the preview automation.

Persona references supplied by the user include the [Sunlight Foundation persona library](https://communities.sunlightfoundation.com/discovery/personas-library/), [PersonaBase](https://github.com/joolsa/PersonaBase), and [PersonaHub](https://huggingface.co/datasets/proj-persona/PersonaHub). Check each source's current licence and permitted use; no PersonaHub data was imported.
