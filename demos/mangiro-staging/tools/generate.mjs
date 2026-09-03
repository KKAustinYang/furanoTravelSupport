#!/usr/bin/env node
// ============================================================================
// バーチャルステージング デモ — 画像の事前生成スクリプト
//
//   node demos/mangiro-staging/tools/generate.mjs [--only prop-01] [--dry]
//
// デモ本体（index.html）は完全な静的サイトで、実行時に生成は一切しない。
// 表示する画像はすべてこのスクリプトで事前生成し、リポジトリにコミットする。
//
//   空室写真     google/nano-banana-pro       (t2i)  → staging/<prop>/<img>/original.jpg
//   ステージング  google/nano-banana-pro-edit  (i2i)  → staging/<prop>/<img>/<style>-<n>.jpg
//
// 生成済みのファイルはスキップする（冪等）。作り直したいものは消してから再実行する。
// i2i の入力は「ローカルの original.jpg を Data URL 化したもの」を渡す。Modellix の
// 結果URLは約7日で失効するため、URLを繋いで回すと後日再現できなくなる。
//
// 法定表記とブランドロゴは **生成後に sharp で合成する**（api/_stamp.js）。モデルに
// 描かせない: 文字が崩れることがあり、Google の安全フィルタに弾かれることもあるため。
// 空室写真（original.jpg）は「お客様の元写真」に相当するので焼き込まない。
//
// 必要なもの: MODELLIX_KEY（リポジトリ直下の .env.local から自動で読む）。
// ============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { STYLES, BASE_PROMPTS, stagingPrompt } from './prompts.mjs'
import { stamp } from '../../../api/_stamp.js'

const here = dirname(fileURLToPath(import.meta.url))
const demoDir = join(here, '..')
const outRoot = join(demoDir, 'staging')
const repoRoot = join(demoDir, '..', '..')

const API = 'https://api.modellix.ai/api/v1'
const T2I = '/google/nano-banana-pro'
const I2I = '/google/nano-banana-pro-edit'
const PARALLEL = 6            // Modellix の並行上限は 20。安全側に寄せる
const LONG_SIDE = 1600        // コミットするJPEGの長辺。2K原寸は重すぎる
const JPEG_Q = 80

const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null

/* ------------------------------------------------------------------ 物件定義 */
// ここを書き換えれば物件・部屋を増減できる。manifest.json も同じ定義から出力する。

const PROPERTIES = [
  {
    id: 'prop-01', name: '白金台レジデンス 802号室', madori: '2LDK', areaSqm: 62.4, jou: 13,
    location: '東京都港区白金台', priceLabel: '8,980万円', built: '2019年築', access: '白金台駅 徒歩4分',
    images: [
      { id: 'img-01', roomType: 'living',   roomLabel: 'リビング・ダイニング', sub: '13.0畳', stageable: true, isPrimary: true },
      { id: 'img-02', roomType: 'bedroom',  roomLabel: '洋室',                sub: '6.2畳',  stageable: true },
      { id: 'img-03', roomType: 'kitchen',  roomLabel: 'キッチン',            sub: '対象外', stageable: false, rejectReason: '対象外の部屋タイプです' },
      { id: 'img-04', roomType: 'bathroom', roomLabel: '浴室',                sub: '対象外', stageable: false, rejectReason: '対象外の部屋タイプです' },
      { id: 'img-05', roomType: 'exterior', roomLabel: '外観',                sub: '対象外', stageable: false, rejectReason: '屋外の写真は対象外です' }
    ]
  },
  {
    id: 'prop-02', name: '中目黒テラス 305号室', madori: '1LDK', areaSqm: 45.2, jou: 10.5,
    location: '東京都目黒区青葉台', priceLabel: '6,480万円', built: '2021年築', access: '中目黒駅 徒歩7分',
    images: [
      { id: 'img-01', roomType: 'living',   roomLabel: 'リビング・ダイニング', sub: '10.5畳', stageable: true, isPrimary: true },
      { id: 'img-04', roomType: 'bedroom',  roomLabel: '洋室',                sub: '6.0畳',  stageable: true },
      { id: 'img-02', roomType: 'other',    roomLabel: '洗面脱衣所',          sub: '対象外', stageable: false, rejectReason: '対象外の部屋タイプです' },
      { id: 'img-03', roomType: 'exterior', roomLabel: '外観',                sub: '対象外', stageable: false, rejectReason: '屋外の写真は対象外です' }
    ]
  },
  {
    id: 'prop-03', name: '代々木パークフロント 1104号室', madori: '3LDK', areaSqm: 78.6, jou: 16,
    location: '東京都渋谷区代々木', priceLabel: '1億2,800万円', built: '2020年築', access: '代々木公園駅 徒歩5分',
    images: [
      { id: 'img-01', roomType: 'living',   roomLabel: 'リビング・ダイニング', sub: '16.0畳', stageable: true, isPrimary: true },
      { id: 'img-02', roomType: 'other',    roomLabel: '和室',                sub: '対象外', stageable: false, rejectReason: '対象外の部屋タイプです' },
      { id: 'img-03', roomType: 'exterior', roomLabel: '外観',                sub: '対象外', stageable: false, rejectReason: '屋外の写真は対象外です' }
    ]
  }
]

const STYLE_KEYS = Object.keys(STYLES)
const VARIANTS = [0, 1, 2]

/* -------------------------------------------------------------------- API */

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
    const json = await res.json()
    const d = json.data || {}
    if (d.status === 'success') return d
    if (d.status === 'failed') throw new Error(`${label}: failed ${JSON.stringify(d).slice(0, 300)}`)
  }
}

/* ------------------------------------------------------------------ 画像入出力 */

async function download(url, outPath, { stampIt }) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  mkdirSync(dirname(outPath), { recursive: true })
  // 長辺 1600px に落としてからコミットする（2K原寸だと1枚 3〜5MB になる）
  const resized = await sharp(buf)
    .resize({ width: LONG_SIDE, height: LONG_SIDE, fit: 'inside', withoutEnlargement: true })
    .toBuffer()
  // ステージング画像だけ焼き込む。空室写真は「お客様の元写真」なので触らない。
  const out = stampIt ? await stamp(resized, { quality: JPEG_Q })
    : await sharp(resized).jpeg({ quality: JPEG_Q, mozjpeg: true }).toBuffer()
  writeFileSync(outPath, out)
}

const dataUrl = (p) => 'data:image/jpeg;base64,' + readFileSync(p).toString('base64')

/* ------------------------------------------------------------------ ジョブ */

let spend = 0

async function runJob(job) {
  if (existsSync(job.out)) { console.log(`· skip  ${job.label}`); return }
  if (DRY) { console.log(`· would ${job.label}\n${job.prompt.slice(0, 160)}…\n`); return }
  const body = job.image
    ? { prompt: job.prompt, image: [dataUrl(job.image)], aspectRatio: '16:9', imageSize: '2K' }
    : { prompt: job.prompt, aspectRatio: '16:9', imageSize: '2K' }
  const task = await post(job.image ? I2I : T2I, body)
  const done = await poll(task.task_id, job.label)
  await download(done.result.resources[0].url, job.out, { stampIt: !!job.image })
  const amount = Number(done.billing?.amount || 0)
  spend += amount
  console.log(`✓ ${job.label}  ($${amount.toFixed(4)}, ${Math.round(done.duration / 1000)}s)`)
}

async function runPool(jobs) {
  let i = 0
  const failures = []
  const worker = async () => {
    for (;;) {
      const job = jobs[i++]
      if (!job) return
      try { await runJob(job) } catch (e) { failures.push(`${job.label}: ${e.message}`); console.error(`✗ ${job.label}: ${e.message}`) }
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker))
  return failures
}

/* ------------------------------------------------------------------ main */

const props = PROPERTIES.filter((p) => !ONLY || p.id === ONLY)

// 1) 空室写真。ステージングの入力になるので必ず先に揃える。
const baseJobs = []
for (const p of props) for (const im of p.images) {
  const key = `${p.id}/${im.id}`
  const prompt = BASE_PROMPTS[key]
  if (!prompt) { console.error(`✗ BASE_PROMPTS に ${key} がありません`); continue }
  baseJobs.push({ label: `${key}/original`, out: join(outRoot, p.id, im.id, 'original.jpg'), prompt })
}
console.log(`\n▶ 空室写真 ${baseJobs.length} 枚`)
const baseFail = await runPool(baseJobs)

// 2) ステージング。1部屋あたり 3スタイル × 3パターン。
const stageJobs = []
for (const p of props) for (const im of p.images) {
  if (!im.stageable) continue
  const original = join(outRoot, p.id, im.id, 'original.jpg')
  if (!existsSync(original)) { console.error(`✗ ${p.id}/${im.id}: original.jpg が無いのでスキップ`); continue }
  for (const style of STYLE_KEYS) for (const v of VARIANTS) {
    stageJobs.push({
      label: `${p.id}/${im.id}/${style}-${v + 1}`,
      out: join(outRoot, p.id, im.id, `${style}-${v + 1}.jpg`),
      image: original,
      prompt: stagingPrompt(style, im.roomType === 'bedroom' ? 'bedroom' : 'living', v)
    })
  }
}
console.log(`\n▶ ステージング ${stageJobs.length} 枚`)
const stageFail = await runPool(stageJobs)

// 3) manifest.json。画面はこれだけを読む（差し替えれば物件が入れ替わる）。
const manifest = {
  generatedAt: new Date().toISOString().slice(0, 10),
  properties: PROPERTIES.map((p) => ({
    id: p.id, name: p.name, madori: p.madori, areaSqm: p.areaSqm, jou: p.jou,
    location: p.location, priceLabel: p.priceLabel, built: p.built, access: p.access,
    thumbnail: `staging/${p.id}/${(p.images.find((i) => i.isPrimary) || p.images[0]).id}/original.jpg`,
    images: p.images.map((im) => {
      const base = `staging/${p.id}/${im.id}`
      const out = {
        id: im.id, roomType: im.roomType, roomLabel: im.roomLabel, sub: im.sub,
        stageable: im.stageable, original: `${base}/original.jpg`
      }
      if (im.isPrimary) out.isPrimary = true
      if (!im.stageable) out.rejectReason = im.rejectReason
      else out.styles = Object.fromEntries(STYLE_KEYS.map((s) =>
        [s, VARIANTS.map((v) => `${base}/${s}-${v + 1}.jpg`)]))
      return out
    })
  }))
}
if (!DRY && !ONLY) {
  writeFileSync(join(outRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log('\n✓ staging/manifest.json')
}

const failures = [...baseFail, ...stageFail]
console.log(`\n合計 $${spend.toFixed(2)}${failures.length ? ` / 失敗 ${failures.length} 件（再実行すれば続きから作ります）` : ''}`)
if (failures.length) process.exitCode = 1
