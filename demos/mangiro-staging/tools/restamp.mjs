#!/usr/bin/env node
// ============================================================================
// 既存のステージング画像に、法定表記バーとロゴを貼り直す。
//
//   node demos/mangiro-staging/tools/restamp.mjs [--dry]
//
// ブランド名やロゴを変えたときに使う。**生成はやり直さない**（45枚の再生成は
// 約$5.5かかるが、焼き込みの貼り直しだけなら費用ゼロ・数秒で終わる）。
//
// 前提: 法定表記バーが不透明であること（api/_stamp-assets.js）。半透明だと
// 古いバーの文字が下から透ける。バーの位置と高さは画像幅からの比率で決まるので、
// 同じ画像に貼り直せば必ず同じ領域を覆う。
//
// original.jpg（空室写真＝お客様の元写真に相当）は対象外。
// ============================================================================

import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stamp } from '../../../api/_stamp.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', 'staging')
const dry = process.argv.includes('--dry')

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/-[123]\.jpg$/.test(name)) yield p          // original.jpg は触らない
  }
}

let n = 0
for (const file of walk(root)) {
  n++
  if (dry) { console.log('· would restamp', file.slice(root.length + 1)); continue }
  const out = await stamp(readFileSync(file), { quality: 80 })
  writeFileSync(file, out)
}
console.log(`${dry ? '対象' : '貼り直し'} ${n} 枚`)
