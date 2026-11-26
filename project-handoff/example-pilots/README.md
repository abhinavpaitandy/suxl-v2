# Saved H&M and Zara example pilots

These files are direct exports from the local preview's saved example and its
previous-example backup. They are project files independent of browser storage.

- `example-updated-2026-11-26.json`: the updated demo, saved at
  `2026-11-26T00:09:54.615Z`, with 20 decisions and 20 persona-specific
  attention paths (18 first clicks and two no-action decisions).
- `example-previous-2026-11-26.json`: the earlier example, saved at
  `2026-11-24T11:25:17.214Z`, with 20 first clicks and no persona-specific
  attention paths. It is kept as a backup, not mixed with the updated run.

Both files have the shape `{ savedAt, draft }`. The draft includes the original
profiles, decisions, target boxes, click data and observations. The screenshot
URLs reference the bundled `public/demo/hm-product-mobile.png` and
`public/demo/zara-product-mobile.png` assets. Attention paths and clicks are
model predictions, not measured user behaviour.

These files do not automatically restore browser storage or change the app's
example when the cache is cleared. Lovable can use them as source data once the
project changes are synced to Lovable. Preserve the existing bundled assets if
reusing the relative screenshot URLs.
