// NTS 応対力トレーニング — 評価プロキシ（Vercel serverless 版）
//
// フロント（/d/nts-training/ の Evaluate 画面）から音声(base64)を受け取り、
// シナリオ区分に応じた GPTBots 評価Agent を呼び出して JSON を返す。
// API キーはサーバー側 env のみ（ブラウザには出さない）:
//   Vercel → Settings → Environment Variables →
//     GPTBOTS_APIKEY_OUTBOUND（定期案内）/ GPTBOTS_APIKEY_INBOUND（解約対応）
//     任意: GPTBOTS_ENDPOINT（sg/jp/th、既定 jp）
//
// ローカル開発では代わりに demos/nts-training/server.js（express, :8787）を使う。
//
// 注意: Vercel の serverless はリクエストボディ上限が約 4.5MB。長い音声は
//       それを超える場合があるため、本番では短めの音声で利用すること。
//       （ローカル server.js は 40MB まで許容）

export const config = { api: { bodyParser: { sizeLimit: '25mb' } } }

const EP = process.env.GPTBOTS_ENDPOINT || 'jp'
const BASE = `https://api-${EP}.gptbots.ai`
const KEY_OUT = process.env.GPTBOTS_APIKEY_OUTBOUND
const KEY_IN = process.env.GPTBOTS_APIKEY_INBOUND
const KEY_LEGACY = process.env.GPTBOTS_API_KEY

function pickKey(cat) {
  const inbound = /インバウンド|inbound|解約/i.test(String(cat || ''))
  return { key: inbound ? (KEY_IN || KEY_LEGACY) : (KEY_OUT || KEY_LEGACY), agent: inbound ? 'inbound' : 'outbound' }
}

function extractJson(t) {
  if (!t) return null
  const s = t.indexOf('{'), e = t.lastIndexOf('}')
  if (s < 0 || e < 0) return null
  try { return JSON.parse(t.slice(s, e + 1)) } catch { return null }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const { base64, format, name, transcript, cat } = body
    const { key: KEY, agent } = pickKey(cat)
    if (!KEY) { res.status(500).json({ error: `${agent === 'inbound' ? 'GPTBOTS_APIKEY_INBOUND' : 'GPTBOTS_APIKEY_OUTBOUND'} が未設定です（Vercel の環境変数を確認）` }); return }
    if (!base64 && !transcript) { res.status(400).json({ error: '音声または文字起こしが必要です' }); return }

    const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

    // 1) 会話を作成
    const conv = await fetch(`${BASE}/v1/conversation`, {
      method: 'POST', headers: H, body: JSON.stringify({ user_id: 'nts-eval' })
    }).then(r => r.json())
    if (!conv.conversation_id) { res.status(502).json({ error: '会話作成に失敗', detail: conv }); return }

    // 2) 音声(+文字起こし)を評価Agentへ送信
    const content = [{
      type: 'text',
      text: 'アップロードした通話音声を、設定のルーブリックに従って評価し、指定のJSON形式のみで出力してください。'
        + (transcript ? ('\n\n【文字起こし】\n' + transcript) : '')
    }]
    if (base64) content.push({ type: 'audio', audio: [{ base64_content: base64, format: format || 'mp3', name: name || 'call' }] })

    const msg = await fetch(`${BASE}/v2/conversation/message`, {
      method: 'POST', headers: H,
      body: JSON.stringify({
        conversation_id: conv.conversation_id,
        response_mode: 'blocking',
        messages: [{ role: 'user', content }],
        conversation_config: { long_term_memory: false, short_term_memory: false }
      })
    }).then(r => r.json())

    const text = msg?.output?.map(o => o?.content?.text).filter(Boolean).join('\n') || ''
    const json = extractJson(text)
    if (!json) { res.status(502).json({ error: 'JSONの解析に失敗', raw: text, detail: msg }); return }
    res.status(200).json({ eval: json, conversation_id: conv.conversation_id, agent })
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) })
  }
}
