// ============================================================================
// 画像生成プロンプトの読み込みと組み立て。
//
// 文言そのものは staging/prompts.json が唯一の定義。ここはローダー兼コンポーザー。
// なぜ JSON かというと、**同じプロンプトをブラウザ側も使うから**。
// アップロードされた写真は index.html がその場で生成するので、事前生成スクリプトと
// 実行時の画面が同じ文言を読める形にしておく必要がある（.mjs のままだと静的配信の
// MIME に依存してしまうため、fetch できる JSON にしてある）。
//
// i2i プロンプトは RULES → STYLE → LAYOUT → QUALITY の4ブロックを必ずこの順で連結する。
// RULES（構造を変えるな）は機能ではなくコンプライアンス要件。削らない・弱めない・要約しない。
// 透かしと法定表記はモデルに描かせず、生成後に sharp で合成する（api/_stamp.js）。
// ============================================================================

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const P = JSON.parse(readFileSync(join(here, '..', 'staging', 'prompts.json'), 'utf8'))

export const RULES = P.rules
export const QUALITY = P.quality
export const WATERMARK = P.watermark
export const STYLES = P.styles
export const LAYOUTS = P.layouts
export const BASE_PROMPTS = P.basePrompts

/** ステージング（i2i）プロンプト。roomType は living / bedroom の2系統。 */
export function stagingPrompt(styleKey, roomType, variantIndex) {
  const style = STYLES[styleKey]
  const layouts = LAYOUTS[roomType] || LAYOUTS.living
  // 透かし・法定表記はモデルに描かせない。サーバー側で sharp が合成する（api/_stamp.js）。
  return [RULES, style.material, layouts[variantIndex], QUALITY].filter(Boolean).join('\n\n')
}
