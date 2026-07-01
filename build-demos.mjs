// Builds every self-contained demo under demos/* into public/d/<slug>/.
//
// Why public/d/ (and not dist/ directly):
//  - vite dev serves public/ live, so demos work in `npm run dev` too.
//  - the showcase build copies public/ into dist/, so one deploy ships everything.
// public/d/ is gitignored — only the demo SOURCE under demos/* is committed.
//
// Convention: each demos/<slug> is an independent Vite app with base:'./'
// in its own vite.config. Adding a demo = drop a folder here + add a card
// entry in src/data/content.js. No change to this script needed.
import { execSync } from 'node:child_process'
import { readdirSync, existsSync, rmSync, cpSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
const demosDir = join(root, 'demos')
const outRoot = join(root, 'public', 'd')

const slugs = existsSync(demosDir)
  ? readdirSync(demosDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(join(demosDir, e.name, 'package.json')))
      .map((e) => e.name)
  : []

rmSync(outRoot, { recursive: true, force: true })
mkdirSync(outRoot, { recursive: true })

for (const slug of slugs) {
  const dir = join(demosDir, slug)
  console.log(`\n▶ building demo: ${slug}`)
  execSync('npm run build', { cwd: dir, stdio: 'inherit' })
  cpSync(join(dir, 'dist'), join(outRoot, slug), { recursive: true })
}

console.log(`\n✓ ${slugs.length} demo(s) built into public/d/: ${slugs.join(', ') || '(none)'}`)
