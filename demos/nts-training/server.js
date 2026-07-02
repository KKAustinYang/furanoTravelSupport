// NTS 応対力トレーニング — 評価プロキシ
// フロントから音声を受け取り、GPTBots 評価Agent を呼び出して JSON を返す。
// API Key はここ（サーバー側）だけに置く。ブラウザには出さない。
import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json({ limit: '40mb' }))

const KEY_OUT = process.env.GPTBOTS_APIKEY_OUTBOUND
const KEY_IN = process.env.GPTBOTS_APIKEY_INBOUND
const KEY_LEGACY = process.env.GPTBOTS_API_KEY // 後方互換の単一キー
const EP = process.env.GPTBOTS_ENDPOINT || 'jp'
const BASE = `https://api-${EP}.gptbots.ai`
const PORT = process.env.PORT || 8787

// シナリオ区分に応じて評価Agentのキーを選択（インバウンド=解約対応、アウトバウンド=定期案内）
function pickKey(cat) {
  const inbound = /インバウンド|inbound|解約/i.test(String(cat || ''))
  const picked = inbound ? (KEY_IN || KEY_LEGACY) : (KEY_OUT || KEY_LEGACY)
  return { key: picked, agent: inbound ? 'inbound' : 'outbound' }
}

function extractJson(t) {
  if (!t) return null
  const s = t.indexOf('{'), e = t.lastIndexOf('}')
  if (s < 0 || e < 0) return null
  try { return JSON.parse(t.slice(s, e + 1)) } catch { return null }
}

app.post('/api/evaluate', async (req, res) => {
  try {
    const { base64, format, name, transcript, cat } = req.body || {}
    const { key: KEY, agent } = pickKey(cat)
    if (!KEY) return res.status(500).json({ error: `${agent === 'inbound' ? 'GPTBOTS_APIKEY_INBOUND' : 'GPTBOTS_APIKEY_OUTBOUND'} が未設定です（.env を確認）` })
    if (!base64 && !transcript) return res.status(400).json({ error: '音声または文字起こしが必要です' })
    console.log(`▶ 評価リクエスト: cat=${cat || '(未指定)'} → agent=${agent}`)
    const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

    // 1) 会話を作成
    const conv = await fetch(`${BASE}/v1/conversation`, {
      method: 'POST', headers: H, body: JSON.stringify({ user_id: 'nts-eval' })
    }).then(r => r.json())
    if (!conv.conversation_id) return res.status(502).json({ error: '会話作成に失敗', detail: conv })

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
    if (!json) return res.status(502).json({ error: 'JSONの解析に失敗', raw: text, detail: msg })
    res.json({ eval: json, conversation_id: conv.conversation_id, agent })
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) })
  }
})

app.get('/api/health', (_, res) => res.json({ ok: true, endpoint: EP, outbound: !!(KEY_OUT || KEY_LEGACY), inbound: !!(KEY_IN || KEY_LEGACY) }))
app.listen(PORT, () => console.log(`✅ 評価プロキシ起動 http://localhost:${PORT}  (endpoint=${EP}, outbound=${(KEY_OUT || KEY_LEGACY) ? 'set' : 'MISSING'}, inbound=${(KEY_IN || KEY_LEGACY) ? 'set' : 'MISSING'})`))
