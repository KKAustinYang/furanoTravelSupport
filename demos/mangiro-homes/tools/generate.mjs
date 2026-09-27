#!/usr/bin/env node
// ============================================================================
// MANGIRO 物件サイト — 画像の事前生成スクリプト
//
//   node demos/mangiro-homes/tools/generate.mjs [--only hero] [--dry]
//
// サイト本体（index.html）は完全な静的ページで、実行時に生成は一切しない。
// 物件写真・エリア写真・ヒーロー画像はすべてここで事前生成してコミットする。
// 生成済みファイルはスキップ（冪等）。作り直したいものは消してから再実行する。
//
// サンプル物件 3 件（白金台・中目黒・代々木）の写真は mangiro-staging の空室写真を
// そのままコピーする（--copy）。ステージング済み画像は法定表記が焼き込まれているので
// 使わない（トリミングで表記を消すのは不可）。
//
// 必要なもの: MODELLIX_KEY（リポジトリ直下の .env.local から自動で読む）。
// ============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const demoDir = join(here, '..')
const outDir = join(demoDir, 'img')
const repoRoot = join(demoDir, '..', '..')

const API = 'https://api.modellix.ai/api/v1'
const T2I = '/google/nano-banana-pro'
const PARALLEL = 6
const JPEG_Q = 78

const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null

const PHOTO = 'Professional real-estate listing photograph, photorealistic, natural light, high dynamic range, sharp focus, shot on a full-frame camera with a 24mm lens, true-to-life colors. Absolutely no text, no captions, no watermark, no logos, no signage lettering, no people.'

// long: 書き出す長辺(px)。カード用は 1200、全幅は 2200。
const JOBS = [
  { id: 'hero', ar: '21:9', long: 2400, prompt: `Wide aerial photograph of a calm residential neighborhood in western Tokyo at golden hour: low-rise modern Japanese houses and small apartment buildings, tiled and flat roofs, tree-lined streets, a river with cherry trees, warm evening sun raking across the rooftops, soft haze, Mount Fuji faintly visible on the far horizon. Cinematic, warm and serene. ${PHOTO}` },

  { id: 'l04', ar: '3:2', long: 1200, prompt: `Exterior of a contemporary two-storey Japanese detached house in Setagaya, Tokyo: light timber cladding and white plaster, large windows, a small garden with a Japanese maple, a narrow driveway, blue sky afternoon. ${PHOTO}` },
  { id: 'l05', ar: '3:2', long: 1200, prompt: `Bright open-plan living and dining room of a family house in Kichijoji, Tokyo: oak flooring, double-height ceiling with skylight, sliding glass doors to a green garden deck, simple natural-wood furniture and linen sofa. ${PHOTO}` },
  { id: 'l06', ar: '3:2', long: 1200, prompt: `Living room of a high-floor apartment in Minato Mirai, Yokohama, at blue hour: floor-to-ceiling windows overlooking the harbor, the Ferris wheel and city lights, warm ambient lighting, a low grey sofa, walnut coffee table, polished floor. ${PHOTO}` },
  { id: 'l07', ar: '3:2', long: 1200, prompt: `A quiet single-storey wooden house in Kamakura, Japan with an engawa veranda facing a moss garden with stepping stones and pine trees, soft morning light, traditional-meets-modern architecture. ${PHOTO}` },
  { id: 'l08', ar: '3:2', long: 1200, prompt: `Exterior of a sleek residential tower in Toyosu, Tokyo, by the waterfront promenade, glass and white balconies, landscaped plaza with trees, clear blue sky, low-angle architectural shot. ${PHOTO}` },
  { id: 'l09', ar: '3:2', long: 1200, prompt: `Elegant living room of a luxury apartment in Azabu, Tokyo in the evening: tall windows with Tokyo Tower glowing in the distance, warm indirect lighting, travertine and walnut, bouclé sofa, curated art on the wall. ${PHOTO}` },
  { id: 'l10', ar: '3:2', long: 1200, prompt: `Renovated compact apartment in Shimokitazawa, Tokyo: white walls, herringbone oak floor, open shelving kitchen with a small island, big window with afternoon sun and plants, cozy and stylish. ${PHOTO}` },
  { id: 'l11', ar: '3:2', long: 1200, prompt: `Low-rise premium residence beside the Tama River in Futako-Tamagawa, Tokyo: terraced balconies with planters, warm stone facade, riverside greenery, late afternoon sun. ${PHOTO}` },
  { id: 'l12', ar: '3:2', long: 1200, prompt: `Modern Japanese townhouse in Kagurazaka, Tokyo on a quiet stone-paved lane: dark charcoal wood louvers, a lantern-lit entrance with a small bamboo planting, dusk with warm light glowing from inside. ${PHOTO}` },

  { id: 'area-minato',   ar: '4:3', long: 1000, prompt: `Street view of Azabu-Juban and Minato ward, Tokyo: leafy boulevard with elegant low-rise residences and Tokyo Tower rising behind, late afternoon light. ${PHOTO}` },
  { id: 'area-setagaya', ar: '4:3', long: 1000, prompt: `Quiet residential street in Setagaya, Tokyo lined with cherry trees in full bloom, detached houses with small gardens, soft spring sunshine. ${PHOTO}` },
  { id: 'area-meguro',   ar: '4:3', long: 1000, prompt: `The Meguro River in Nakameguro, Tokyo with trees along both banks, small bridges and stylish low-rise buildings, fresh green early summer, calm afternoon. ${PHOTO}` },
  { id: 'area-shibuya',  ar: '4:3', long: 1000, prompt: `Yoyogi Park area in Shibuya, Tokyo: wide green park with tall zelkova trees in the foreground and modern residential buildings at the edge, golden light. ${PHOTO}` },
  { id: 'area-edogawa',  ar: '4:3', long: 1000, prompt: `Edogawa ward, Tokyo: wide riverside greenery along the Arakawa and Nakagawa rivers at golden hour, a long embankment path, mid-rise family condominiums across the water, calm and spacious. ${PHOTO}` },
  { id: 'area-arakawa',  ar: '4:3', long: 1000, prompt: `Arakawa ward, Tokyo: the Toden Arakawa streetcar passing along a track lined with blooming roses, low-rise homes and condominiums behind, soft late-spring morning light. ${PHOTO}` },
]

// サンプル物件 3 件は mangiro-staging の空室写真を流用する。
const COPIES = [
  ['prop-01/img-05', 'l01-a'], ['prop-01/img-01', 'l01-b'], ['prop-01/img-03', 'l01-c'], ['prop-01/img-02', 'l01-d'],
  // prop-02 の外観は左右 2 枚組なので、左の 1 枚だけ切り出す
  ['prop-02/img-03', 'l02-a', { left: 0, top: 0, width: 792, height: 893 }], ['prop-02/img-01', 'l02-b'], ['prop-02/img-04', 'l02-c'], ['prop-02/img-02', 'l02-d'],
  ['prop-03/img-03', 'l03-a'], ['prop-03/img-01', 'l03-b'], ['prop-03/img-02', 'l03-c'],
]

const KEY = (() => {
  if (process.env.MODELLIX_KEY) return process.env.MODELLIX_KEY
  const envFile = join(repoRoot, '.env.local')
  if (existsSync(envFile)) {
    const m = readFileSync(envFile, 'utf8').match(/^MODELLIX_KEY=(.+)$/m)
    if (m) return m[1].trim()
  }
  throw new Error('MODELLIX_KEY が見つかりません（環境変数か .env.local に設定してください）')
})()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function post(path, body) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API + path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    // 429 だけリトライする。課金前に弾かれるので二重課金にならない。
    if (res.status === 429 && attempt < 5) { await sleep(4000 * (attempt + 1)); continue }
    const json = await res.json()
    if (!res.ok || json.code !== 0) throw new Error(`${path} ${res.status} ${JSON.stringify(json).slice(0, 300)}`)
    return json.data
  }
}

async function poll(taskId, label) {
  const started = Date.now()
  for (;;) {
    if (Date.now() - started > 10 * 60 * 1000) throw new Error(`${label}: タイムアウト`)
    await sleep(5000)
    const res = await fetch(`${API}/tasks/${taskId}`, { headers: { Authorization: `Bearer ${KEY}` } })
    const d = (await res.json()).data || {}
    if (d.status === 'success') return d
    if (d.status === 'failed') throw new Error(`${label}: failed ${JSON.stringify(d).slice(0, 300)}`)
  }
}

const save = async (buf, out, long) => {
  const jpg = await sharp(buf)
    .resize({ width: long, height: long, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_Q, mozjpeg: true }).toBuffer()
  writeFileSync(out, jpg)
}

mkdirSync(outDir, { recursive: true })

if (args.includes('--copy')) {
  for (const [src, id, crop] of COPIES) {
    const out = join(outDir, `${id}.jpg`)
    if (existsSync(out)) continue
    let buf = readFileSync(join(repoRoot, 'demos/mangiro-staging/staging', src, 'original.jpg'))
    if (crop) buf = await sharp(buf).extract(crop).toBuffer()
    await save(buf, out, 1200)
    console.log(`✓ copy ${src} → ${id}.jpg`)
  }
}

let spend = 0
const failures = []
const jobs = JOBS.filter((j) => !ONLY || j.id === ONLY)
let i = 0
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  for (;;) {
    const job = jobs[i++]
    if (!job) return
    const out = join(outDir, `${job.id}.jpg`)
    if (existsSync(out)) { console.log(`· skip  ${job.id}`); continue }
    if (DRY) { console.log(`· would ${job.id}`); continue }
    try {
      const task = await post(T2I, { prompt: job.prompt, aspectRatio: job.ar, imageSize: '2K' })
      const done = await poll(task.task_id, job.id)
      const res = await fetch(done.result.resources[0].url)
      if (!res.ok) throw new Error(`download ${res.status}`)
      await save(Buffer.from(await res.arrayBuffer()), out, job.long)
      const amount = Number(done.billing?.amount || 0)
      spend += amount
      console.log(`✓ ${job.id}  ($${amount.toFixed(4)})`)
    } catch (e) { failures.push(job.id); console.error(`✗ ${job.id}: ${e.message}`) }
  }
}))
console.log(`\n合計 $${spend.toFixed(2)}${failures.length ? ` / 失敗: ${failures.join(', ')}` : ''}`)
if (failures.length) process.exitCode = 1
