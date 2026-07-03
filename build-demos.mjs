// Builds every demo under demos/* into public/d/<slug>/.
//
// Two kinds of demo are supported:
//  - Vite app  : demos/<slug> has a package.json  → `npm run build`, copy dist/
//  - Static    : demos/<slug> has an index.html (no package.json) → copy folder as-is
//
// Why public/d/ (and not dist/ directly):
//  - vite dev serves public/ live, so demos work in `npm run dev` too.
//  - the showcase build copies public/ into dist/, so one deploy ships everything.
// public/d/ is gitignored — only the demo SOURCE under demos/* is committed.
//
// Adding a demo = drop a folder in demos/ (a Vite app with base:'./', OR a
// static folder with index.html) + add a card entry in src/data/content.js.
import { execSync } from 'node:child_process'
import { readdirSync, existsSync, rmSync, cpSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
const demosDir = join(root, 'demos')
const outRoot = join(root, 'public', 'd')

const dirs = existsSync(demosDir)
  ? readdirSync(demosDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  : []

rmSync(outRoot, { recursive: true, force: true })
mkdirSync(outRoot, { recursive: true })

const built = []
for (const slug of dirs) {
  const dir = join(demosDir, slug)
  const out = join(outRoot, slug)
  if (existsSync(join(dir, 'package.json'))) {
    // Vite app — build then copy its dist/
    console.log(`\n▶ building demo (vite): ${slug}`)
    execSync('npm run build', { cwd: dir, stdio: 'inherit' })
    cpSync(join(dir, 'dist'), out, { recursive: true })
    built.push(`${slug} (vite)`)
  } else if (existsSync(join(dir, 'index.html'))) {
    // Static demo — copy the folder as-is (skip any node_modules)
    console.log(`\n▶ copying demo (static): ${slug}`)
    cpSync(dir, out, { recursive: true, filter: (src) => !src.includes(`${slug}/node_modules`) })
    built.push(`${slug} (static)`)
  } else {
    console.log(`\n⚠ skip (no package.json / index.html): ${slug}`)
  }
}

console.log(`\n✓ ${built.length} demo(s) into public/d/: ${built.join(', ') || '(none)'}`)
