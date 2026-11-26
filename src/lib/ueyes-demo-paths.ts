/** DeepGaze++ output from the UEyes research repository, run locally on these
 * exact bundled images. The first point is the model script's centre seed;
 * the remaining three are predictions. Coordinates are normalized from its
 * 471 × 1022 resized input. This is free-viewing, not persona-specific gaze.
 */
const paths = {
  "/demo/hm-product-mobile.png?v=2": {
    sha256: "4a43b1e4e7de5d9b6af3a0496caa2cb2059f9a60b24e6871300fc687c8bceb85",
    points: [[235, 511], [250, 357], [230, 197], [85, 201]],
  },
  "/demo/zara-product-mobile.png?v=2": {
    sha256: "c1440fa16eea9558283e688607a610019578023c86ff750d82c8096c4d994ef4",
    points: [[235, 511], [242, 129], [242, 605], [242, 734]],
  },
} as const;

export async function getUEyesDemoPath(url: string) {
  const entry = paths[url as keyof typeof paths];
  if (!entry || !globalThis.crypto?.subtle) return undefined;
  const response = await fetch(url);
  if (!response.ok) return undefined;
  const digest = await crypto.subtle.digest("SHA-256", await response.arrayBuffer());
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (hash !== entry.sha256) return undefined;
  return entry.points.map(([x, y]) => ({ x: x / 471, y: y / 1022 }));
}
