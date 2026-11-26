import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

/** Local development only; never added to the Lovable production server. */
export function ueyesLocalPlugin(): Plugin {
  return { name: "ueyes-local", apply: "serve", configureServer(server) {
    let busy = false;
    server.middlewares.use("/api/local-ueyes", async (req, res) => {
      const fail = (status: number, message: string) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify({ error: message })); };
      const host = req.headers.host || "";
      const origin = req.headers.origin;
      const remote = req.socket.remoteAddress || "";
      if (!/^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(remote) || !/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host) || !origin || origin !== `http://${host}` || req.method !== "POST") return fail(403, "Local same-origin requests only.");
      if (busy) return fail(429, "Another gaze prediction is running. Try again shortly.");
      const root = process.cwd();
      const python = process.env["UEYES_PYTHON"] || resolve(root, ".ueyes/venv/bin/python");
      const modelDir = process.env["UEYES_MODEL_DIR"] || resolve(root, ".ueyes/repo/scanpath_models/DeepGaze++");
      if (!existsSync(python) || !existsSync(resolve(modelDir, "centerbias_mit1003.npy"))) return fail(503, "UEyes is not installed locally. Run the local setup described in the project handoff.");
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 12 * 1024 * 1024) return fail(413, "Screenshot exceeds the 12 MB limit."); chunks.push(chunk); }
      if (!size) return fail(400, "Screenshot is empty.");
      busy = true;
      const child = spawn(python, [resolve(root, "scripts/ueyes-infer.py")], { env: { ...process.env, UEYES_MODEL_DIR: modelDir, TORCH_HOME: process.env["UEYES_TORCH_HOME"] || resolve(root, ".ueyes/torch"), MPLBACKEND: "Agg" }, stdio: ["pipe", "pipe", "pipe"] });
      let output = "", errors = "";
      child.stdout.on("data", (chunk) => { output += chunk; });
      child.stderr.on("data", (chunk) => { errors = (errors + chunk).slice(-4000); });
      const timer = setTimeout(() => child.kill("SIGKILL"), 180_000);
      child.on("error", () => { clearTimeout(timer); busy = false; if (!res.writableEnded) fail(503, "Unable to start UEyes locally."); });
      child.on("close", (code) => {
        clearTimeout(timer); busy = false;
        if (res.writableEnded) return;
        if (code !== 0) { console.error("UEyes local inference failed:", errors); return fail(502, "UEyes could not analyse this screenshot. Check the local server log and try again."); }
        try {
          const result = JSON.parse(output.trim().split("\n").at(-1) || "");
          if (!Array.isArray(result.points) || result.points.length !== 4 || result.points.some((p: { x: number; y: number }) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) throw new Error("Invalid coordinates");
          res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(result));
        } catch { fail(502, "UEyes returned an invalid result."); }
      });
      child.stdin.on("error", () => {});
      child.stdin.end(Buffer.concat(chunks));
    });
  } };
}
