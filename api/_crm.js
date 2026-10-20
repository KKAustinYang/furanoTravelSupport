// MANGIRO CRM 本体（リードの登録・状態管理）。
//
//   POST /api/crm  { token?, operation, request }
//
// 呼び出し元は 2 つ:
//   1. GPTBots ワークフロー（MANGIRO_CRM.flow）… body.token = CRM_TOKEN
//      conv_state / log_property_view / get_lead_status / create_lead / update_lead
//   2. 担当者画面（demos/mangiro-homes/crm.html）… ヘッダ X-CRM-Code = CRM_VIEW_CODE
//      list_leads / get_lead / update_lead（評価は「担当者が設定」として扱う）
//
// 以前は Google Sheets + Apps Script（crm_gas.gs）が担っていた。業務ルールはそのまま移植:
//   ・AI は評価を下げられない／担当者が付けた評価を AI は上書きできない（設計書 §6.2）
//   ・メールで照合して重複行を作らない（§6.4）
//   ・最も関心の高い物件 = 質問回数が最多、同数なら最後に見た物件（§5.3）
//   ・会話単位のカウンタと、その上限の判断（§5.2・§7.1・§10.3）
// 守られなかったことに後から気づけない規則なので、プロンプトではなく書き込み口で止める。
//
// 保存先は Redis（Vercel → Storage → Upstash for Redis）。Vercel の関数は呼び出しごとに
// 状態を持たないため、外部の保存先が要る。ローカル開発（VERCEL 未設定）ではファイルに保存する。
//
// 環境変数
//   KV_REST_API_URL / KV_REST_API_TOKEN   （または UPSTASH_REDIS_REST_URL / _TOKEN）
//   CRM_TOKEN       ワークフローの env.crm_token と同じ値
//   CRM_VIEW_CODE   担当者画面の閲覧コード

import { timingSafeEqual } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const env = (k) => (process.env[k] || '').trim()

/* ============================================================ 保存先 */

const P = 'mangiro:crm:'

function redisConf() {
  const url = env('KV_REST_API_URL') || env('UPSTASH_REDIS_REST_URL')
  const token = env('KV_REST_API_TOKEN') || env('UPSTASH_REDIS_REST_TOKEN')
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null
}

// Upstash REST: コマンドの配列をまとめて送る
async function redis(cmds) {
  const c = redisConf()
  const r = await fetch(c.url + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  })
  if (!r.ok) throw new Error('Redis ' + r.status)
  const out = await r.json()
  return out.map((x) => { if (x.error) throw new Error(x.error); return x.result })
}

// ローカル開発用（1 ファイルに丸ごと保存）。本番では使わない
const DEV_FILE = '.crm-dev.json'
async function devLoad() { try { return JSON.parse(await readFile(DEV_FILE, 'utf8')) } catch { return { kv: {}, sets: {}, lists: {} } } }
async function devSave(db) { await writeFile(DEV_FILE, JSON.stringify(db, null, 1)) }

function storeReady() { return !!redisConf() || !env('VERCEL') }

const store = {
  async get(keys) {
    if (redisConf()) {
      const res = await redis(keys.map((k) => ['GET', P + k]))
      return res.map((v) => (v == null ? null : JSON.parse(v)))
    }
    const db = await devLoad(); return keys.map((k) => db.kv[k] ?? null)
  },
  async set(pairs) {   // [[key, value], ...]
    if (!pairs.length) return
    if (redisConf()) return void await redis(pairs.map(([k, v]) => ['SET', P + k, JSON.stringify(v)]))
    const db = await devLoad(); for (const [k, v] of pairs) db.kv[k] = v; await devSave(db)
  },
  async sadd(key, member) {
    if (redisConf()) return void await redis([['SADD', P + key, member]])
    const db = await devLoad(); const s = new Set(db.sets[key] || []); s.add(member); db.sets[key] = [...s]; await devSave(db)
  },
  async smembers(key) {
    if (redisConf()) return (await redis([['SMEMBERS', P + key]]))[0] || []
    return (await devLoad()).sets[key] || []
  },
  async lpush(key, value, max = 300) {
    if (redisConf()) return void await redis([['LPUSH', P + key, JSON.stringify(value)], ['LTRIM', P + key, 0, max - 1]])
    const db = await devLoad(); db.lists[key] = [value, ...(db.lists[key] || [])].slice(0, max); await devSave(db)
  },
  async lrange(key, n = 60) {
    if (redisConf()) return ((await redis([['LRANGE', P + key, 0, n - 1]]))[0] || []).map((v) => JSON.parse(v))
    return ((await devLoad()).lists[key] || []).slice(0, n)
  },
}

/* ============================================================ 業務ルール */

const LEAD_COLS = [
  'lead_key', 'user_key', 'created_at', 'updated_at',
  'opportunity_name', 'account_name', 'email', 'phone',
  'phase', 'lead_source',
  'rating', 'rating_set_by', 'rating_reasons',
  'purchase_timing', 'pref_ward', 'pref_budget_max_yen', 'pref_layout',
  'pref_area_min_sqm', 'pref_walk_max',
  'purchase_purpose', 'purchase_financing', 'invest_goal',
  'hearing_notes',
  'viewed_properties', 'top_property',
  'meeting_status', 'meeting_contact_method', 'meeting_time_pref', 'meeting_summary',
  'granted', 'owner', 'consent_email',
]
const MEETING_STATUS = ['未案内', '辞退', '希望', '日程確定']
const RANK = { COOL: 1, WARM: 2, HOT: 3 }   // COLD は担当者専用（AI は付けない）

// 日本時間の ISO 風文字列（Apps Script 版と同じ形式）
const now = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }).replace(' ', 'T')
const has = (v) => v !== undefined && v !== null && v !== ''
const normEmail = (v) => String(v || '').trim().toLowerCase()

async function audit(op, userKey, leadKey, detail) {
  const e = { ts: now(), operation: op, user_key: userKey || '', lead_key: leadKey || '', detail: JSON.stringify(detail || {}) }
  const subjects = new Set([userKey && 'u:' + userKey, leadKey && 'l:' + leadKey].filter(Boolean))
  for (const s of subjects) await store.lpush('audit:' + s, e)
}

/** メール優先、無ければ user_key で 1 件引く。 */
async function findLead(req) {
  const email = normEmail(req.email)
  if (email) {
    const [l] = await store.get(['lead:' + email])
    if (l) return l
  }
  const uk = String(req.user_key || '').trim()
  if (uk) {
    const [mail] = await store.get(['uk:' + uk])
    if (mail) { const [l] = await store.get(['lead:' + mail]); if (l) return l }
  }
  return null
}

async function viewsOf(uk) {
  if (!uk) return {}
  const [v] = await store.get(['views:' + uk])
  return v || {}
}

/** 閲覧の一覧と「最も関心の高い物件」（§5.3）。 */
function viewSummary(views) {
  const list = Object.values(views)
  if (!list.length) return { list: '', top: '', count: 0 }
  const byTime = list.slice().sort((a, b) => String(b.last_viewed_at).localeCompare(String(a.last_viewed_at)))
  const top = byTime.slice().sort((a, b) =>
    (Number(b.question_count) || 0) - (Number(a.question_count) || 0) ||
    String(b.last_viewed_at).localeCompare(String(a.last_viewed_at)))[0]
  return { list: byTime.map((r) => r.property_no).join(','), top: top ? top.property_no : '', count: list.length }
}

/** 評価の更新可否。AI は下げられず、担当者が付けた値は上書きできない（§6.2）。 */
function nextRating(cur, curBy, incoming, incomingBy) {
  if (!incoming) return { rating: cur, by: curBy, changed: false, reason: 'no_input' }
  if (curBy === 'agent' && incomingBy !== 'agent') return { rating: cur, by: curBy, changed: false, reason: 'agent_set_protected' }
  if (incomingBy === 'agent') return { rating: incoming, by: 'agent', changed: incoming !== cur || curBy !== 'agent', reason: 'agent_override' }
  if ((RANK[incoming] || 0) > (RANK[cur] || 0)) return { rating: incoming, by: 'ai', changed: true, reason: 'raised' }
  return { rating: cur, by: curBy || 'ai', changed: false, reason: 'not_raised' }
}

function validate(op, req, fromAgent) {
  if (op === 'create_lead') {
    if (!normEmail(req.email)) return 'EMAIL_REQUIRED'
    if (!has(req.account_name) && !has(req.lead_name)) return 'NAME_REQUIRED'
  }
  if (['get_lead_status', 'update_lead', 'log_property_view'].includes(op) && !has(req.user_key) && !has(req.email)) return 'KEY_REQUIRED'
  if (op === 'log_property_view' && (!has(req.property_no) || !has(req.user_key))) return has(req.property_no) ? 'KEY_REQUIRED' : 'PROPERTY_NO_REQUIRED'
  if (op === 'conv_state' && !has(req.conversation_id)) return 'CONVERSATION_ID_REQUIRED'
  if (has(req.meeting_status) && !MEETING_STATUS.includes(req.meeting_status)) return 'MEETING_STATUS_INVALID'
  if (has(req.rating) && !['HOT', 'WARM', 'COOL', 'COLD'].includes(req.rating)) return 'RATING_INVALID'
  if (req.rating === 'COLD' && !fromAgent) return 'COLD_IS_AGENT_ONLY'
  return null
}

const ERR_MSG = {
  EMAIL_REQUIRED: 'email は必須です', NAME_REQUIRED: 'lead_name は必須です', KEY_REQUIRED: 'user_key か email が必要です',
  PROPERTY_NO_REQUIRED: 'property_no は必須です', CONVERSATION_ID_REQUIRED: 'conversation_id は必須です（{{sys_conversation_id}}）',
  MEETING_STATUS_INVALID: '面談の状況は 未案内／辞退／希望／日程確定 のいずれかです', RATING_INVALID: '評価は HOT／WARM／COOL／COLD のいずれかです',
  COLD_IS_AGENT_ONLY: 'COLD は担当者だけが設定します', LEAD_NOT_FOUND: '該当するリードがありません',
}

async function saveLead(rec) {
  const pairs = [['lead:' + rec.lead_key, rec]]
  if (rec.user_key) pairs.push(['uk:' + rec.user_key, rec.lead_key])
  await store.set(pairs)
  await store.sadd('leads', rec.lead_key)
}

/* ============================================================ 操作 */

async function opCreateLead(req) {
  const email = normEmail(req.email)
  const exist = await findLead({ email, user_key: req.user_key })
  const uk = req.user_key || (exist && exist.user_key) || ''
  const vs = viewSummary(await viewsOf(uk))
  const rat = nextRating(exist ? exist.rating : '', exist ? exist.rating_set_by : '', req.rating, req.rating_set_by || 'ai')

  const rec = {}
  for (const c of LEAD_COLS) rec[c] = exist ? (exist[c] ?? '') : ''
  // 値のあるものだけ上書き。空で既存を消さない
  for (const c of ['account_name', 'phone', 'purchase_timing', 'pref_ward', 'pref_budget_max_yen', 'pref_layout',
    'pref_area_min_sqm', 'pref_walk_max', 'purchase_purpose', 'purchase_financing', 'invest_goal', 'hearing_notes',
    'meeting_status', 'meeting_contact_method', 'meeting_time_pref', 'meeting_summary', 'owner', 'consent_email', 'rating_reasons']) {
    if (has(req[c])) rec[c] = req[c]
  }
  // 別の user_key で登録し直した場合も、前の端末の閲覧記録を残すため旧キーの対応は消さない
  rec.lead_key = email; rec.email = email
  if (req.user_key) rec.user_key = req.user_key
  rec.created_at = exist ? exist.created_at : now()
  rec.updated_at = now()
  rec.opportunity_name = (rec.account_name || '') + '-'
  rec.phase = rec.phase || '1.条件のヒアリング'
  rec.lead_source = rec.lead_source || 'MANGIRO AI チャット'
  rec.rating = rat.rating; rec.rating_set_by = rat.by
  rec.viewed_properties = vs.list; rec.top_property = vs.top
  rec.granted = true                       // 登録＝詳細開示可
  if (!rec.meeting_status) rec.meeting_status = '未案内'

  await saveLead(rec)
  await audit('create_lead', rec.user_key, email, { created: !exist, rating: rat })
  return {
    ok: true, created: !exist, lead_key: email, granted: true,
    rating: rec.rating, rating_set_by: rec.rating_set_by, rating_changed: rat.changed, rating_note: rat.reason,
    meeting_status: rec.meeting_status, viewed_count: vs.count, top_property: vs.top,
  }
}

async function opUpdateLead(req) {
  const exist = await findLead(req)
  if (!exist) return { ok: false, error: 'LEAD_NOT_FOUND', message: ERR_MSG.LEAD_NOT_FOUND }
  const rat = nextRating(exist.rating, exist.rating_set_by, req.rating, req.rating_set_by || 'ai')
  const rec = { ...exist }, changed = []
  for (const c of LEAD_COLS) {
    if (['lead_key', 'email', 'created_at', 'rating', 'rating_set_by', 'viewed_properties', 'top_property', 'granted'].includes(c)) continue
    if (has(req[c]) && req[c] !== rec[c]) { rec[c] = req[c]; changed.push(c) }
  }
  rec.rating = rat.rating; rec.rating_set_by = rat.by
  if (rat.changed) changed.push('rating')
  const vs = viewSummary(await viewsOf(rec.user_key))
  rec.viewed_properties = vs.list; rec.top_property = vs.top
  rec.updated_at = now()
  await saveLead(rec)
  await audit('update_lead', rec.user_key, rec.lead_key, { changed, rating: rat, by: req.rating_set_by === 'agent' ? 'agent' : 'ai' })
  return { ok: true, lead_key: rec.lead_key, updated_fields: changed, rating: rec.rating, rating_set_by: rec.rating_set_by,
           rating_note: rat.reason, meeting_status: rec.meeting_status }
}

async function opGetLeadStatus(req) {
  const exist = await findLead(req)
  const vs = viewSummary(await viewsOf(req.user_key || (exist && exist.user_key)))
  if (!exist) {
    return { ok: true, found: false, granted: false, rating: '', rating_set_by: '', meeting_status: '未案内',
             viewed_count: vs.count, top_property: vs.top, viewed_properties: vs.list }
  }
  return {
    ok: true, found: true, granted: exist.granted === true,
    lead_key: exist.lead_key, lead_name: exist.account_name,
    rating: exist.rating, rating_set_by: exist.rating_set_by,
    meeting_status: exist.meeting_status || '未案内',
    meeting_contact_method: exist.meeting_contact_method || '', meeting_time_pref: exist.meeting_time_pref || '',
    viewed_count: vs.count, top_property: vs.top, viewed_properties: vs.list,
    created_at: exist.created_at, updated_at: exist.updated_at,
  }
}

async function opLogPropertyView(req) {
  const uk = String(req.user_key).trim(), pno = String(req.property_no).trim()
  const views = await viewsOf(uk)
  const hit = views[pno]
  const q = req.kind === 'question' ? 1 : 0
  views[pno] = hit
    ? { ...hit, last_viewed_at: now(), view_count: (Number(hit.view_count) || 0) + 1, question_count: (Number(hit.question_count) || 0) + q }
    : { user_key: uk, property_no: pno, first_viewed_at: now(), last_viewed_at: now(), view_count: 1, question_count: q }
  await store.set([['views:' + uk, views]])
  await store.sadd('viewers', uk)
  const vs = viewSummary(views)
  // リードが既にあれば一覧も追従させる（面談前サマリーに効く）
  const lead = await findLead({ user_key: uk })
  if (lead) await saveLead({ ...lead, viewed_properties: vs.list, top_property: vs.top, updated_at: now() })
  await audit('log_property_view', uk, lead ? lead.lead_key : '', { property_no: pno, kind: req.kind || 'detail' })
  return { ok: true, property_no: pno, view_count: views[pno].view_count, question_count: views[pno].question_count,
           top_property: vs.top, viewed_count: vs.count, viewed_properties: vs.list }
}

/** 会話単位のカウンタ。読み取りと更新を 1 往復にまとめる（確認と表示の隙間で二重に出さない）。 */
async function opConvState(req) {
  const cid = String(req.conversation_id).trim()
  const [hit] = await store.get(['conv:' + cid])
  const rec = {
    conversation_id: cid, user_key: req.user_key || (hit ? hit.user_key : ''),
    created_at: hit ? hit.created_at : now(), updated_at: now(),
    form_shown: hit ? !!hit.form_shown : false, ask_count: hit ? Number(hit.ask_count) || 0 : 0,
    meeting_invite_count: hit ? Number(hit.meeting_invite_count) || 0 : 0,
    meeting_declined: hit ? !!hit.meeting_declined : false, hearing_notes: hit ? hit.hearing_notes || '' : '',
  }
  for (const f of [].concat(req.bump || [])) if (f === 'ask_count' || f === 'meeting_invite_count') rec[f] += 1
  const st = req.set || {}
  const truthy = (v) => v === true || v === 'true'
  if (st.form_shown !== undefined) rec.form_shown = truthy(st.form_shown)
  if (st.meeting_declined !== undefined) rec.meeting_declined = truthy(st.meeting_declined)
  if (has(st.hearing_notes)) rec.hearing_notes = rec.hearing_notes ? rec.hearing_notes + ' / ' + st.hearing_notes : st.hearing_notes
  await store.set([['conv:' + cid, rec]])
  // 会話の聞き取りはリードのヒアリングメモにも反映する（担当者画面で見えるように）
  if (has(st.hearing_notes) && rec.user_key) {
    const lead = await findLead({ user_key: rec.user_key })
    if (lead && !String(lead.hearing_notes || '').includes(st.hearing_notes)) {
      await saveLead({ ...lead, hearing_notes: lead.hearing_notes ? lead.hearing_notes + ' / ' + st.hearing_notes : st.hearing_notes, updated_at: now() })
    }
  }
  return {
    ok: true, conversation_id: cid, created: !hit,
    form_shown: rec.form_shown, ask_count: rec.ask_count, meeting_invite_count: rec.meeting_invite_count,
    meeting_declined: rec.meeting_declined, hearing_notes: rec.hearing_notes,
    can_show_form: !rec.form_shown, should_handoff: rec.ask_count >= 2,
    can_invite_meeting: rec.meeting_invite_count < 2 && !rec.meeting_declined,
  }
}

/* ---- 担当者画面（読み取り） ---- */

async function opListLeads() {
  const keys = await store.smembers('leads')
  const leads = (await store.get(keys.map((k) => 'lead:' + k))).filter(Boolean)
  const viewMaps = await store.get(leads.map((l) => 'views:' + (l.user_key || '-')))
  leads.forEach((l, i) => {
    const vs = Object.values(viewMaps[i] || {})
    l.viewed_count = vs.length
    l.view_total = vs.reduce((s, v) => s + (Number(v.view_count) || 0), 0)
    l.question_total = vs.reduce((s, v) => s + (Number(v.question_count) || 0), 0)
  })
  leads.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
  const viewers = await store.smembers('viewers')
  const leadUsers = new Set(leads.map((l) => l.user_key).filter(Boolean))
  // まだ登録していない閲覧者は件数だけ返す
  return { ok: true, leads, anonymous_viewers: viewers.filter((u) => !leadUsers.has(u)).length, generated_at: now() }
}

async function opGetLead(req) {
  const lead = await findLead(req)
  if (!lead) return { ok: false, error: 'LEAD_NOT_FOUND', message: ERR_MSG.LEAD_NOT_FOUND }
  const views = Object.values(await viewsOf(lead.user_key))
    .sort((a, b) => String(b.last_viewed_at).localeCompare(String(a.last_viewed_at)))
  const a1 = lead.user_key ? await store.lrange('audit:u:' + lead.user_key) : []
  const a2 = await store.lrange('audit:l:' + lead.lead_key)
  const seen = new Set()
  const auditLog = [...a1, ...a2].filter((e) => { const k = e.ts + e.operation + e.detail; if (seen.has(k)) return false; seen.add(k); return true })
    .sort((x, y) => String(y.ts).localeCompare(String(x.ts))).slice(0, 60)
  return { ok: true, lead, views, audit: auditLog }
}

const AGENT_OPS = { conv_state: opConvState, create_lead: opCreateLead, update_lead: opUpdateLead,
                    get_lead_status: opGetLeadStatus, log_property_view: opLogPropertyView }
const STAFF_OPS = { list_leads: opListLeads, get_lead: opGetLead, update_lead: opUpdateLead }
const STAFF_EDITABLE = ['rating', 'meeting_status', 'owner', 'meeting_summary']

function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b))
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y)
}

/* ============================================================ 入口 */

export async function handleCrm(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'MANGIRO CRM', operations: Object.keys(AGENT_OPS), store: redisConf() ? 'redis' : (env('VERCEL') ? 'none' : 'dev-file') })
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })

  let body
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}) }
  catch { return res.status(400).json({ ok: false, error: 'BAD_REQUEST', message: 'JSON ではありません' }) }

  const operation = String(body.operation || '')
  let request = body.request && typeof body.request === 'object' ? body.request : {}

  // 呼び出し元の判定
  const agentToken = env('CRM_TOKEN'), viewCode = env('CRM_VIEW_CODE')
  let caller = null
  if (has(body.token)) {
    if (!agentToken) return res.status(503).json({ ok: false, error: 'CRM_TOKEN_NOT_CONFIGURED', message: 'サーバーに CRM_TOKEN が設定されていません' })
    if (!same(body.token, agentToken)) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED', message: 'token が一致しません' })
    caller = 'agent'
  } else {
    if (!storeReady()) return res.status(503).json({ ok: false, error: 'CRM_NOT_CONFIGURED' })
    if (!viewCode) return res.status(503).json({ ok: false, error: 'VIEW_CODE_NOT_CONFIGURED' })
    if (!same(req.headers['x-crm-code'] || '', viewCode)) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' })
    caller = 'staff'
  }
  if (!storeReady()) return res.status(503).json({ ok: false, error: 'STORE_NOT_CONFIGURED', message: 'Redis（KV_REST_API_URL）が設定されていません' })

  const ops = caller === 'agent' ? AGENT_OPS : STAFF_OPS
  const fn = ops[operation]
  if (!fn) return res.status(400).json({ ok: false, error: 'UNKNOWN_OPERATION', message: '使用できる操作は ' + Object.keys(ops).join(' / ') + ' です' })

  if (caller === 'staff') {
    // 担当者画面から変えられるのは 4 項目だけ。評価は担当者の設定として扱う
    const r = { email: request.email }
    if (operation === 'update_lead') {
      for (const k of STAFF_EDITABLE) if (has(request[k])) r[k] = request[k]
      if (r.rating) r.rating_set_by = 'agent'
    }
    request = r
  } else if (has(request.lead_name) && !has(request.account_name)) {
    request.account_name = request.lead_name; delete request.lead_name
  }

  const err = validate(operation, request, caller === 'staff' || request.rating_set_by === 'agent')
  if (err) return res.status(400).json({ ok: false, error: err, message: ERR_MSG[err] || err })

  try {
    const out = await fn(request)
    return res.status(out.ok ? 200 : 400).json(out)
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'CRM_EXCEPTION', message: String(e.message || e) })
  }
}
