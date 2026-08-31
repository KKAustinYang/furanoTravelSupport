// ============================================================================
// 生成画像への焼き込み（サーバー側合成）
//
// 2層に分けてある。混ぜてはいけない。
//   ① 法定表記バー … 必須。消せない・差し替えられない
//   ② ブランドロゴ … 差し替え可（STAGING_LOGO_DATA_URL で上書きできる）
// 1枚に混ぜると、ロゴを変えたいだけで法定表記まで消えてしまう。
//
// 文字サイズ・バー高さは **画像幅に対する比率**。px 直書きにすると、解像度が変わった
// ときに読めない大きさになり「消費者が容易に認識できる」を満たさなくなる。
//
// 文言は事前に PNG へ焼いてある（_stamp-assets.js）。実行時に SVG のテキストを
// 描画すると、日本語フォントの無い実行環境で豆腐になるため。
//
// 生成直後の素の画像は外へ出さない。外に出るのは必ずこの関数を通したものだけ。
// ============================================================================

import sharp from 'sharp'
import { NOTICE_PNG, LOGO_PNG } from './_stamp-assets.js'

const LOGO_W_RATIO = 0.17     // ロゴ幅 / 画像幅
const PAD_RATIO = 0.022       // 余白 / 画像幅

function logoBuffer() {
  // お客様のロゴに差し替える口。data URL をそのまま環境変数に入れる（再デプロイ不要）。
  const override = process.env.STAGING_LOGO_DATA_URL
  if (override && /^data:image\/(png|webp);base64,/.test(override)) {
    return Buffer.from(override.split(',')[1], 'base64')
  }
  return Buffer.from(LOGO_PNG, 'base64')
}

/**
 * @param {Buffer} input  生成された画像
 * @returns {Promise<Buffer>} 法定表記とロゴを焼き込んだ JPEG
 */
export async function stamp(input, { quality = 90 } = {}) {
  const img = sharp(input, { failOn: 'none' })
  const meta = await img.metadata()
  const w = meta.width
  const h = meta.height
  if (!w || !h) throw new Error('画像を読み込めませんでした')

  const notice = await sharp(Buffer.from(NOTICE_PNG, 'base64')).resize({ width: w }).png().toBuffer()
  const noticeH = (await sharp(notice).metadata()).height

  const logoW = Math.max(96, Math.round(w * LOGO_W_RATIO))
  const logo = await sharp(logoBuffer()).resize({ width: logoW }).png().toBuffer()
  const logoH = (await sharp(logo).metadata()).height

  const pad = Math.round(w * PAD_RATIO)

  return img
    .composite([
      // ① 法定表記バー（下端いっぱい）
      { input: notice, top: Math.max(0, h - noticeH), left: 0 },
      // ② ブランドロゴ（バーの中・右寄せ）。写真の上に直接置くと、明るい部屋では
      //    白ロゴが飛んで読めない。バーの中なら背景が一定でコントラストが保てる。
      //    合成レイヤーは①と別のまま（差し替えても法定表記は残る）。
      { input: logo, top: Math.max(0, h - noticeH + Math.round((noticeH - logoH) / 2)), left: Math.max(0, w - logoW - pad) },
    ])
    .jpeg({ quality, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toBuffer()
}
