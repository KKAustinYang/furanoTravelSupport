// MANGIRO CRM（担当者画面）用の中継。
//
//   POST /api/crm  { operation, request }   ヘッダ X-CRM-Code: <閲覧コード>
//     -> CRM_URL（Apps Script の /exec。本番は Salesforce 側の窓口）へ token を付けて転送
//
// 画面には氏名・メール・電話が出るので、ここで 2 つを守る:
//   1. CRM のトークン（CRM_TOKEN）はブラウザに渡さない
//   2. 閲覧コード（CRM_VIEW_CODE）が一致しない限り何も返さない。
//      未設定なら「開いたまま公開」になるので、そもそも中継しない
// 担当者画面から呼べる操作は下の 3 つだけ。AI 用の create_lead / conv_state などは通さない。
//
// 環境変数（Vercel → Settings → Environment Variables）
//   CRM_URL        Apps Script ウェブアプリの /exec URL
//   CRM_TOKEN      crm_gas.gs の TOKEN と同じ値
//   CRM_VIEW_CODE  担当者画面の閲覧コード

import { timingSafeEqual } from 'node:crypto'

const ALLOWED = new Set(['list_leads', 'get_lead', 'update_lead'])
// 担当者画面から書き換えてよい項目。評価は「担当者が設定」として送る（§6.2）
const EDITABLE = new Set(['rating', 'meeting_status', 'owner', 'meeting_summary'])

const env = (k) => (process.env[k] || '').trim()

function sameCode(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b))
  return x.length === y.length && timingSafeEqual(x, y)
}

export async function handleCrm(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })

  const url = env('CRM_URL'), token = env('CRM_TOKEN'), code = env('CRM_VIEW_CODE')
  // 画面はこの応答を見て「サンプルデータ表示」に切り替える
  if (!url || !token) return res.status(503).json({ ok: false, error: 'CRM_NOT_CONFIGURED' })
  if (!code) return res.status(503).json({ ok: false, error: 'VIEW_CODE_NOT_CONFIGURED' })
  if (!sameCode(req.headers['x-crm-code'] || '', code)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' })
  }

  let body
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}) }
  catch { return res.status(400).json({ ok: false, error: 'BAD_REQUEST' }) }

  const operation = String(body.operation || '')
  if (!ALLOWED.has(operation)) return res.status(400).json({ ok: false, error: 'UNKNOWN_OPERATION' })

  let request = body.request && typeof body.request === 'object' ? body.request : {}
  if (operation === 'update_lead') {
    const out = { email: request.email }
    for (const k of EDITABLE) if (request[k] != null && request[k] !== '') out[k] = request[k]
    if (out.rating) out.rating_set_by = 'agent'
    request = out
  } else {
    request = request.email ? { email: request.email } : {}
  }

  try {
    // Apps Script は 302 で結果の URL に飛ばす。fetch は自動で追う
    const up = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, operation, request }),
      redirect: 'follow',
    })
    const text = await up.text()
    let data
    try { data = JSON.parse(text) } catch { return res.status(502).json({ ok: false, error: 'NOT_JSON' }) }
    res.setHeader('Cache-Control', 'no-store')
    return res.status(data.ok ? 200 : 400).json(data)
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'UPSTREAM_ERROR', message: e.message })
  }
}
