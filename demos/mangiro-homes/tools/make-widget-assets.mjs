#!/usr/bin/env node
// GPTBots ウィジェット（カスタムUI）にアップロードする画像を作る
//
//   node demos/mangiro-homes/tools/make-widget-assets.mjs
//
//   widget/agent-icon.png  … 「AIエージェント画像」用。紫→きなこ色のヘッダーの上に載るので、
//                            地は生成り・家のマークはきなこ色にして、ヘッダー色に溶けないようにする
//   widget/logo.png        … 「AIエージェントロゴ → カスタムロゴ」用（Powered by の位置に小さく出る）
// tools/ 配下は公開されない（build-demos.mjs が除外する）。
import sharp from 'sharp'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const out = join(dirname(fileURLToPath(import.meta.url)), 'widget')
const ACCENT = '#8C6E4A', CREAM = '#FAF9F7'

// 家のマーク（サイトの favicon と同じパス、32 単位）
const house = (c, w = 2.2) => `
  <path d="M6.5 15 16 7.5 25.5 15" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M9.5 16.6v7.2h13v-7.2" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="14" y="18.4" width="4" height="5.4" rx="1" fill="${c}"/>`

// 角丸・円形どちらに切り抜かれてもマークが欠けないよう、中央 60% に収める
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="${CREAM}"/>
  <g transform="translate(16 16.2) scale(.78) translate(-16 -16)">${house(ACCENT, 2.3)}</g>
</svg>`
await sharp(Buffer.from(icon)).png().toFile(join(out, 'agent-icon.png'))

const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="384" height="96" viewBox="0 0 384 96">
  <rect x="4" y="12" width="72" height="72" rx="18" fill="${ACCENT}"/>
  <g transform="translate(4 12) scale(2.25)">${house(CREAM)}</g>
  <text x="100" y="66" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="44" font-weight="700" letter-spacing="9" fill="#2B2823">MANGIRO</text>
</svg>`
await sharp(Buffer.from(logo)).png().toFile(join(out, 'logo.png'))
console.log('✓ widget/agent-icon.png, widget/logo.png')
