#!/usr/bin/env node
// ============================================================================
// 焼き込む2枚のオーバーレイを作る（＝ api/_stamp-assets.js を書き出す）
//
//   node demos/mangiro-staging/tools/make-overlays.mjs
//
// なぜ実行時に SVG から描かないのか:
//   sharp の SVG レンダリングはシステムのフォントに依存する。Vercel の実行環境には
//   日本語フォントが入っていないため、実行時にテキストを描くと豆腐（□□□）になる。
//   文言は固定なので、**フォントのあるこの端末で PNG に焼いてから同梱する**。
//   実行時は幅に合わせて拡縮するだけ。文字は絶対に崩れない。
//
// 2枚に分けてある理由:
//   ① 法定表記バー  … 必須・消せない。差し替え不可
//   ② ブランドロゴ  … 差し替え可（お客様のロゴに変更できる）
//   1枚に混ぜると、ロゴを差し替えたいだけで法定表記まで消えてしまう。
// ============================================================================

import sharp from 'sharp'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const apiDir = join(here, '..', '..', '..', 'api')

// 基準幅。実行時はここから対象画像の幅へ拡縮する。2K 出力（〜2752px）でも
// 拡大が目立たないよう、少し大きめに焼いておく。
const W = 3072

// 文字サイズ・バー高さはすべて幅に対する比率。px 直書きは禁止
// （解像度が変わると読めない大きさになり、「消費者が容易に認識できる」を満たせない）。
const BAR_H = 0.10        // バー高さ / 画像幅
const FONT = 0.022        // 文字サイズ / 画像幅
const LINE1_Y = 0.042     // 1行目ベースライン / 画像幅
const LINE2_Y = 0.075
const PAD_X = 0.025

const JP = "'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP','BIZ UDPGothic',sans-serif"

/* ① 法定表記バー（必須・消せない） */
const noticeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Math.round(W * BAR_H)}">
  <defs>
  </defs>
  <!-- 不透明にしてある。半透明だと、すでにバーが焼き込まれた画像に貼り直したときに
       古い文字が透けて残る（ブランド名の変更などで貼り直しが必要になる）。 -->
  <rect width="100%" height="100%" fill="#14161B"/>
  <rect width="100%" height="2" fill="#fff" opacity="0.10"/>
  <text x="${W * PAD_X}" y="${W * LINE1_Y}" font-size="${W * FONT}" fill="#fff" font-family=${JSON.stringify(JP)}>※AIによるバーチャルステージング画像です</text>
  <text x="${W * PAD_X}" y="${W * LINE2_Y}" font-size="${W * FONT}" fill="#fff" font-family=${JSON.stringify(JP)}>実際の物件に家具・調度品は含まれません</text>
</svg>`

/* ② ブランドロゴ（差し替え可） */
const LOGO_W = Math.round(W * 0.17)
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LOGO_W}" height="${Math.round(LOGO_W * 0.26)}" viewBox="0 0 520 136">
  <g fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity="0.94">
    <path d="M22 64 62 30l40 34"/>
    <path d="M33 72v30a6 6 0 0 0 6 6h46a6 6 0 0 0 6-6V72"/>
  </g>
  <rect x="50" y="80" width="24" height="28" rx="4" fill="#fff" opacity="0.94"/>
  <text x="128" y="82" font-size="46" letter-spacing="10" fill="#fff" opacity="0.94"
        font-family="'Helvetica Neue',Helvetica,Arial,sans-serif" font-weight="600">MANGIRO</text>
  <text x="130" y="116" font-size="24" letter-spacing="2" fill="#fff" opacity="0.8"
        font-family=${JSON.stringify(JP)}>AI ステージング</text>
</svg>`

const shadow = (svg) =>
  sharp(Buffer.from(svg)).png().toBuffer()

const notice = await shadow(noticeSvg)
const logo = await shadow(logoSvg)

const nm = await sharp(notice).metadata()
const lm = await sharp(logo).metadata()

writeFileSync(join(apiDir, '_stamp-assets.js'),
`// GENERATED — demos/mangiro-staging/tools/make-overlays.mjs で生成。手で編集しない。
//
// ① NOTICE = 法定表記バー（必須・消せない）  ${nm.width}x${nm.height}
// ② LOGO   = ブランドロゴ（差し替え可）      ${lm.width}x${lm.height}
//
// 実行時にフォントを使わないよう、文言は PNG に焼いてある（Vercel には日本語フォントが無い）。
// ロゴだけを差し替えたい場合は、環境変数 STAGING_LOGO_DATA_URL に data:image/png;base64,... を
// 設定する（再デプロイ不要）。法定表記バーは差し替えられない。
export const NOTICE_PNG = '${notice.toString('base64')}'
export const LOGO_PNG = '${logo.toString('base64')}'
export const NOTICE_RATIO = ${(nm.height / nm.width).toFixed(6)}   // バー高さ / 画像幅
`)

console.log(`✓ api/_stamp-assets.js  notice ${nm.width}x${nm.height} (${Math.round(notice.length / 1024)}KB) / logo ${lm.width}x${lm.height} (${Math.round(logo.length / 1024)}KB)`)
