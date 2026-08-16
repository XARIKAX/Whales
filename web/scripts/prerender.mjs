/**
 * Emits dist/docs.html: the same app shell, plus the whole article as flat HTML
 * inside a <noscript>.
 *
 * A separate file rather than injecting into index.html, because index.html is
 * served for every route — putting the docs article in it would ship the entire
 * reference page to somebody who asked for the landing page, and show them the
 * docs if their scripting was off. The hosts are pointed at this file for /docs
 * only: `vercel.json` rewrites it, and `public/.htaccess` does the same for
 * Apache.
 *
 *   node scripts/prerender.mjs
 *
 * Runs after `vite build`, against the dist that build produced.
 */
import { build } from "vite";
import { readFile, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, "dist");
const ssrDir = path.join(root, ".ssr");

// The page renders in Node, where none of these exist. They are only ever read
// inside effects and event handlers, which do not run during a static render —
// but a component that touches one at module scope would take the build down,
// so the stubs make that failure loud rather than mysterious.
globalThis.window ??= undefined;

async function main() {
  await build({
    root,
    logLevel: "warn",
    build: {
      ssr: path.join(root, "src/prerender.jsx"),
      outDir: ".ssr",
      emptyOutDir: true,
      // The stylesheet is already in dist from the client build; emitting a
      // second copy here would be dead weight on disk.
      cssCodeSplit: false,
      rollupOptions: { output: { entryFileNames: "prerender.mjs" } },
    },
  });

  const { render } = await import(path.join(ssrDir, "prerender.mjs"));
  const article = render();

  const shell = await readFile(path.join(dist, "index.html"), "utf8");
  if (!shell.includes("</body>")) throw new Error("dist/index.html has no </body> to inject before");

  const page = shell.replace("</body>", `<noscript>${article}</noscript></body>`);
  await writeFile(path.join(dist, "docs.html"), page);

  await rm(ssrDir, { recursive: true, force: true });

  const kb = (s) => `${Math.round(Buffer.byteLength(s) / 1024)} kB`;
  console.log(`dist/docs.html  ${kb(page)}  (article ${kb(article)}, no-JS only)`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
