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
const CREAM = '#FDFCFA'

// 新ロゴ（金の M）。角丸・円形どちらに切り抜かれても欠けないよう中央 64% に収める
const MARK = (c) => `<g fill="${c}"><path d="M181 849 485 411 777 849H677L485 549 278 849Z"/><path d="M637 597 770 411 1063 849H960L770 549 684 667Z"/><path d="M559 705 606 777 558 849H461Z"/></g>`
const GOLD = '#A88B54'
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${CREAM}"/>
  <svg x="184" y="350" width="656" height="326" viewBox="181 411 882 438">${MARK(GOLD)}</svg>
</svg>`
await sharp(Buffer.from(icon)).png().toFile(join(out, 'agent-icon.png'))

const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="96" viewBox="0 0 420 96">
  <svg x="4" y="24" width="96" height="48" viewBox="181 411 882 438">${MARK(GOLD)}</svg>
  <text x="120" y="66" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="44" font-weight="700" letter-spacing="9" fill="#2B2823">MANGIRO</text>
</svg>`
await sharp(Buffer.from(logo)).png().toFile(join(out, 'logo.png'))
console.log('✓ widget/agent-icon.png, widget/logo.png')
