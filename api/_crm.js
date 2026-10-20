// MANGIRO CRM 本体。
//
//   POST /api/crm  { token?, operation, request }
//
// 構成は IREA の商談画面に合わせる：顧客（連絡先）→ 案件（商談）→ タスク。
// AI チャットから書き込むのは 2 つの時点だけ（要件「MANGIRO AI 聊天 → CRM 登録内容」§3）:
//   1. register_lead   … 登録フォームの送信時。顧客と案件を作る。
//                         同じメールに未クローズの案件があれば、新規にせずその案件を更新する
//   2. request_meeting … 面談・内見のご希望時。同じ案件にタスクを 1 件作り、担当者に通知する
// 未登録の訪問者は記録しない。会話単位の回数や閲覧履歴は GPTBots 側（ユーザー属性・キーイベント）が持つ。
//
// 呼び出し元は 2 つ:
//   ・GPTBots ワークフロー（MANGIRO_CRM.flow）… body.token = CRM_TOKEN
//   ・担当者画面（demos/mangiro-homes/crm.html）… ヘッダ X-CRM-Code = CRM_VIEW_CODE
//
// 環境変数
//   KV_REST_API_URL / KV_REST_API_TOKEN   保存先（Upstash Redis）。ローカルでは .crm-dev.json
//   CRM_TOKEN / CRM_VIEW_CODE             上記の認証
//   CRM_NOTIFY_TO                         担当者への通知メールの宛先（未設定なら CRM 画面の通知だけ）
//   SMTP_USER / SMTP_PASS（/ SMTP_HOST / SMTP_PORT / MAIL_FROM） 通知メールの送信（_mail.js と共用）

import { timingSafeEqual, randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import nodemailer from 'nodemailer'

const env = (k) => (process.env[k] || '').trim()

/* ============================================================ 保存先 */

const P = 'mangiro:crm2:'

function redisConf() {
  const url = env('KV_REST_API_URL') || env('UPSTASH_REDIS_REST_URL')
  const token = env('KV_REST_API_TOKEN') || env('UPSTASH_REDIS_REST_TOKEN')
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null
}
async function redis(cmds) {
  const c = redisConf()
  const r = await fetch(c.url + '/pipeline', {
    method: 'POST', headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds),
  })
  if (!r.ok) throw new Error('Redis ' + r.status)
  return (await r.json()).map((x) => { if (x.error) throw new Error(x.error); return x.result })
}
const DEV_FILE = '.crm-dev.json'
async function devLoad() { try { return JSON.parse(await readFile(DEV_FILE, 'utf8')) } catch { return { kv: {}, sets: {}, lists: {} } } }
async function devSave(db) { await writeFile(DEV_FILE, JSON.stringify(db, null, 1)) }
const storeReady = () => !!redisConf() || !env('VERCEL')

const store = {
  async get(keys) {
    if (!keys.length) return []
    if (redisConf()) return (await redis(keys.map((k) => ['GET', P + k]))).map((v) => (v == null ? null : JSON.parse(v)))
    const db = await devLoad(); return keys.map((k) => db.kv[k] ?? null)
  },
  async set(pairs) {
    if (!pairs.length) return
    if (redisConf()) return void await redis(pairs.map(([k, v]) => ['SET', P + k, JSON.stringify(v)]))
    const db = await devLoad(); for (const [k, v] of pairs) db.kv[k] = v; await devSave(db)
  },
  async sadd(key, member) {
    if (redisConf()) return void await redis([['SADD', P + key, member]])
    const db = await devLoad(); db.sets[key] = [...new Set([...(db.sets[key] || []), member])]; await devSave(db)
  },
  async smembers(key) {
    if (redisConf()) return (await redis([['SMEMBERS', P + key]]))[0] || []
    return (await devLoad()).sets[key] || []
  },
  async lpush(key, value, max = 300) {
    if (redisConf()) return void await redis([['LPUSH', P + key, JSON.stringify(value)], ['LTRIM', P + key, 0, max - 1]])
    const db = await devLoad(); db.lists[key] = [value, ...(db.lists[key] || [])].slice(0, max); await devSave(db)
  },
  async lrange(key, n = 100) {
    if (redisConf()) return ((await redis([['LRANGE', P + key, 0, n - 1]]))[0] || []).map((v) => JSON.parse(v))
    return ((await devLoad()).lists[key] || []).slice(0, n)
  },
}

/* ============================================================ 定数・書式 */

const OWNER = 'Tsuyoshi Hikichi'
const OPP_TYPE = '購入案件依頼'
const LEAD_SOURCE = 'MANGIRO AIチャット'
const STAGES = ['1.条件のヒアリング', '2.物件検索', '3.内見', '4.買付', '5.ローン事前審査', '6.売買契約締結',
                '7.ローン本審査', '8.決済、引渡し', '9.手数料入金', '10.クローズ済み']
const CLOSED = '10.クローズ済み'
const RATINGS = ['Hot', 'Warm', 'Cool']
const RANK = { Cool: 1, Warm: 2, Hot: 3 }
const CATEGORIES = ['投資用', '自己居住用', 'セカンドハウス']
const TIMINGS = { '3ヶ月以内': 3, '半年以内': 6, '1年以内': 12, 'まだ決めていない': 12 }
const LAYOUTS = ['1R-1DK', '1LDK', '2K-2DK', '2LDK', '3R+']
const MEETING_KINDS = ['面談', '内見']
const TASK_STATUS = ['未着手', '完了']

// 担当者が画面で入力する項目（AI は書かない）
const STAFF_FIELDS = ['stage', 'rating', 'probability', 'close_date', 'category', 'owner',
  'property_price', 'expected_yield', 'brokerage_fee', 'payment_date', 'contract_price',
  'completed_date', 'contracted_property', 'file_link']

const has = (v) => v !== undefined && v !== null && String(v).trim() !== ''
const normEmail = (v) => String(v || '').trim().toLowerCase()
const jst = (d = new Date()) => d.toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }).replace(' ', 'T')
const today = () => jst().slice(0, 10)
const newId = (p) => `${p}-${today().replace(/-/g, '')}-${randomBytes(3).toString('hex')}`

function addMonths(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1 + n, 1))
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate()
  t.setUTCDate(Math.min(d, last))           // 1/31 + 1ヶ月 → 2/28（月末で止める）
  return t.toISOString().slice(0, 10)
}
function normRating(v) {
  const s = String(v || '').trim().toLowerCase()
  return { hot: 'Hot', warm: 'Warm', cool: 'Cool', cold: 'Cold' }[s] || ''
}
// 購入目的（自由記述）→ 種別
function toCategory(v) {
  const s = String(v || '').toLowerCase()
  if (!s) return ''
  if (/セカンド|second|別荘/.test(s)) return 'セカンドハウス'
  if (/投資|invest|賃貸|利回り/.test(s)) return '投資用'
  if (/自己|居住|自住|住む|own|live|home/.test(s)) return '自己居住用'
  return ''
}
function yen(n) {
  const v = Number(n); if (!v) return ''
  const man = Math.round(v / 10000)
  return man >= 10000 ? `${Math.floor(man / 10000)}億${man % 10000 ? (man % 10000).toLocaleString('ja-JP') + '万' : ''}円` : `${man.toLocaleString('ja-JP')}万円`
}
// 関心の高い物件 = 質問回数が最多、同数なら最後に見たもの（設計書 §5.3）
function topProperty(views) {
  const list = (Array.isArray(views) ? views : []).filter((v) => v && has(v.property_no))
  if (!list.length) return null
  const top = list.slice().sort((a, b) =>
    (Number(b.question_count) || 0) - (Number(a.question_count) || 0) ||
    String(b.last_viewed_at || '').localeCompare(String(a.last_viewed_at || '')))[0]
  return { top, others: list.length - 1 }
}
const cleanNo = (v) => String(v || '').trim().replace(/^(No\.?|#)\s*/i, '')

/** 備考に書くブロック。無い項目は行ごと書かない（要件 §3 の例）。 */
function notesBlock(r, label) {
  const lines = [`【MANGIRO AIチャット】${today()} ${label}`]
  const want = [r.pref_ward, has(r.pref_budget_max_yen) && yen(r.pref_budget_max_yen) && yen(r.pref_budget_max_yen) + '以下', r.pref_layout,
    has(r.pref_area_min_sqm) && Number(r.pref_area_min_sqm) && `${Number(r.pref_area_min_sqm)}㎡以上`,
    has(r.pref_walk_max) && Number(r.pref_walk_max) && `駅徒歩${Number(r.pref_walk_max)}分以内`].filter(Boolean)
  if (want.length) lines.push('希望：' + want.join('／'))
  if (has(r.purchase_timing)) lines.push('購入時期：' + r.purchase_timing)
  if (has(r.purchase_purpose)) lines.push('目的：' + r.purchase_purpose + (has(r.invest_goal) ? `（${r.invest_goal}）` : ''))
  else if (has(r.invest_goal)) lines.push('投資目標：' + r.invest_goal)
  if (has(r.purchase_financing)) lines.push('資金計画：' + r.purchase_financing)
  const tp = topProperty(r.viewed_properties)
  if (tp) lines.push(`関心物件：No.${cleanNo(tp.top.property_no)}${Number(tp.top.question_count) ? `（質問${Number(tp.top.question_count)}回）` : ''}${tp.others ? `、ほか${tp.others}件` : ''}`)
  if (has(r.hearing_notes)) lines.push('ヒアリング：' + r.hearing_notes)
  if (has(r.rating_reasons)) lines.push('評価根拠：' + r.rating_reasons)
  if (has(r.conversation_language)) lines.push('会話言語：' + String(r.conversation_language).toUpperCase())
  return lines.join('\n')
}

/* ============================================================ 検証 */

const ERR_MSG = {
  EMAIL_REQUIRED: 'lead_email は必須です', NAME_REQUIRED: 'lead_name は必須です',
  PURCHASE_TIMING_INVALID: 'purchase_timing は 3ヶ月以内／半年以内／1年以内／まだ決めていない のいずれかです',
  LAYOUT_INVALID: 'pref_layout は 1R-1DK／1LDK／2K-2DK／2LDK／3R+ のいずれかです',
  RATING_INVALID: '評価は HOT／WARM／COOL のいずれかです', COLD_IS_AGENT_ONLY: 'COLD は AI からは設定できません',
  KIND_INVALID: 'kind は 面談 か 内見 です', PROPERTY_NO_REQUIRED: '内見には property_no が必要です',
  SUMMARY_REQUIRED: 'meeting_summary（面談前サマリー）は必須です', LEAD_NOT_FOUND: '登録済みの案件がありません（先に register_lead）',
  STAGE_INVALID: 'フェーズが不正です', CATEGORY_INVALID: '種別が不正です', NOT_FOUND: '見つかりません', STATUS_INVALID: '状態が不正です',
}
const fail = (error) => ({ ok: false, error, message: ERR_MSG[error] || error })

function validateAgent(op, r) {
  if (op === 'register_lead') {
    if (!normEmail(r.lead_email)) return 'EMAIL_REQUIRED'
    if (!has(r.lead_name)) return 'NAME_REQUIRED'
    if (has(r.purchase_timing) && !(r.purchase_timing in TIMINGS)) return 'PURCHASE_TIMING_INVALID'
    if (has(r.pref_layout) && !LAYOUTS.includes(r.pref_layout)) return 'LAYOUT_INVALID'
    if (has(r.rating)) {
      const n = normRating(r.rating)
      if (n === 'Cold') return 'COLD_IS_AGENT_ONLY'
      if (!RATINGS.includes(n)) return 'RATING_INVALID'
    }
  }
  if (op === 'request_meeting') {
    if (!normEmail(r.lead_email)) return 'EMAIL_REQUIRED'
    if (!MEETING_KINDS.includes(r.kind)) return 'KIND_INVALID'
    if (r.kind === '内見' && !has(r.property_no)) return 'PROPERTY_NO_REQUIRED'
    if (!has(r.meeting_summary)) return 'SUMMARY_REQUIRED'
  }
  if (op === 'get_lead_status' && !normEmail(r.lead_email)) return 'EMAIL_REQUIRED'
  return null
}

/* ============================================================ 読み書きの部品 */

async function oppsOf(email) {
  const ids = await store.smembers('opps_of:' + email)
  return (await store.get(ids.map((i) => 'opp:' + i))).filter(Boolean)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
}
const openOpp = (opps) => opps.find((o) => o.stage !== CLOSED) || null

async function saveOpp(o) {
  await store.set([['opp:' + o.id, o]])
  await store.sadd('opps', o.id)
  await store.sadd('opps_of:' + o.contact_key, o.id)
}
async function saveTask(t) {
  await store.set([['task:' + t.id, t]])
  await store.sadd('tasks', t.id)
  await store.sadd('tasks_of:' + t.opp_id, t.id)
}
async function audit(oppId, op, by, detail) {
  await store.lpush('audit:' + oppId, { ts: jst(), operation: op, by, detail })
}

async function sendNotifyMail(subject, text) {
  const to = env('CRM_NOTIFY_TO'), user = env('SMTP_USER'), pass = env('SMTP_PASS')
  if (!to || !user || !pass) return { sent: false, reason: !to ? 'CRM_NOTIFY_TO 未設定' : 'SMTP 未設定' }
  try {
    const t = nodemailer.createTransport({
      host: env('SMTP_HOST') || 'smtp.gmail.com', port: Number(env('SMTP_PORT') || 465),
      secure: Number(env('SMTP_PORT') || 465) === 465, auth: { user, pass },
    })
    await t.sendMail({ from: { name: 'MANGIRO CRM', address: env('MAIL_FROM') || user }, to, subject, text })
    return { sent: true }
  } catch (e) { return { sent: false, reason: String(e.message || e).slice(0, 200) } }
}

/* ============================================================ AI の操作 */

async function opRegisterLead(r) {
  const key = normEmail(r.lead_email)
  const now = jst()

  // 顧客：氏名・メール・電話はフォームの値をそのまま
  const [c0] = await store.get(['contact:' + key])
  const contact = { ...(c0 || { created_at: now }), key, email: String(r.lead_email).trim(), updated_at: now }
  if (has(r.lead_name)) contact.name = String(r.lead_name).trim()
  if (has(r.lead_phone)) contact.phone = String(r.lead_phone).trim()
  await store.set([['contact:' + key, contact]])
  await store.sadd('contacts', key)

  const incoming = normRating(r.rating)
  const category = toCategory(r.purchase_purpose)
  const existing = openOpp(await oppsOf(key))

  if (!existing) {
    const o = {
      id: newId('OPP'), contact_key: key,
      name: `${contact.name || ''}-`, type: OPP_TYPE, owner: OWNER, stage: STAGES[0], probability: '',
      close_date: addMonths(today(), TIMINGS[r.purchase_timing] || 12),
      lead_source: LEAD_SOURCE, rating: incoming || '', rating_set_by: incoming ? 'ai' : '',
      category, notes: notesBlock(r, '登録'),
      purchase_timing: r.purchase_timing || '', conversation_language: r.conversation_language || '',
      property_price: '', expected_yield: '', brokerage_fee: '', payment_date: '', contract_price: '',
      completed_date: '', contracted_property: '', file_link: '',
      created_at: now, updated_at: now,
    }
    await saveOpp(o)
    await audit(o.id, 'register_lead', 'ai', '新規登録（顧客・案件を作成）' + (incoming ? `・評価 ${incoming}` : ''))
    return { ok: true, created: true, opportunity_id: o.id, contact_email: contact.email, stage: o.stage, owner: o.owner,
             rating: o.rating, rating_changed: !!incoming, rating_note: incoming ? 'set' : 'no_input', close_date: o.close_date }
  }

  // 未クローズの案件がある → 更新。評価は上がるときだけ、担当者が付けた評価は変えない
  const o = { ...existing }
  let note = 'no_input', changed = false
  if (incoming) {
    if (o.rating_set_by === 'agent') note = 'agent_set_protected'
    else if ((RANK[incoming] || 0) > (RANK[o.rating] || 0)) { o.rating = incoming; o.rating_set_by = 'ai'; note = 'raised'; changed = true }
    else note = 'not_raised'
  }
  if (!o.category && category) o.category = category
  // 追記。上書きしない。見出しだけの空ブロックは足さない
  const block = notesBlock(r, '更新')
  if (block.includes('\n')) o.notes = (o.notes ? o.notes + '\n\n' : '') + block
  o.updated_at = now
  await saveOpp(o)
  await audit(o.id, 'register_lead', 'ai', '同じメールで再登録（案件を更新）' + (changed ? `・評価 ${o.rating} に上げた` : ''))
  return { ok: true, created: false, opportunity_id: o.id, contact_email: contact.email, stage: o.stage, owner: o.owner,
           rating: o.rating, rating_changed: changed, rating_note: note, close_date: o.close_date }
}

async function opRequestMeeting(r) {
  const key = normEmail(r.lead_email)
  const opp = openOpp(await oppsOf(key))
  if (!opp) return fail('LEAD_NOT_FOUND')
  const pno = has(r.property_no) ? cleanNo(r.property_no) : ''
  const title = `【MANGIRO AIチャット】${r.kind}希望${pno ? ' No.' + pno : ''}`
  const due = today()

  // 同じ案件・同じ日・同じ件名のタスクがあれば作らない（通知も重ねない）
  const ids = await store.smembers('tasks_of:' + opp.id)
  const dup = (await store.get(ids.map((i) => 'task:' + i))).find((t) => t && t.title === title && t.due_date === due)
  if (dup) return { ok: true, created: false, duplicate: true, task_id: dup.id, opportunity_id: opp.id, notified: false }

  const contactLine = [r.contact_method, r.time_pref].filter(has).join('、')
  const task = {
    id: newId('TASK'), opp_id: opp.id, title, assignee: opp.owner || OWNER, due_date: due, priority: '高',
    body: String(r.meeting_summary).trim() + (contactLine ? `\nご連絡：${contactLine}` : ''),
    status: '未着手', kind: r.kind, property_no: pno, trigger: r.trigger || '',
    contact_method: r.contact_method || '', time_pref: r.time_pref || '', created_at: jst(),
  }
  await saveTask(task)

  const text = `MANGIRO AIチャットから${r.kind}のご希望がありました${pno ? `（No.${pno}）` : ''}。タスクに面談前サマリーがあります。` +
    (contactLine ? `ご連絡：${contactLine}` : '')
  const mail = await sendNotifyMail(`【MANGIRO】${r.kind}のご希望${pno ? ` No.${pno}` : ''}（${opp.name}）`,
    `${task.assignee} 様\n\n${text}\n\n案件：${opp.name}\nタスク：${title}\n\n${task.body}\n\nCRM：https://aurora-mobile-japan-demo.vercel.app/d/mangiro-homes/crm.html`)
  const notif = { id: newId('NTF'), ts: jst(), to: task.assignee, text, opp_id: opp.id, task_id: task.id,
                  email_sent: mail.sent, email_note: mail.reason || '' }
  await store.lpush('notifications', notif, 500)

  await store.set([['opp:' + opp.id, { ...opp, updated_at: jst() }]])
  await audit(opp.id, 'request_meeting', 'ai', `${title} を作成・${task.assignee} に通知${mail.sent ? '（メール送信）' : ''}`)
  return { ok: true, created: true, duplicate: false, task_id: task.id, opportunity_id: opp.id,
           notified: true, email_sent: mail.sent }
}

async function opGetLeadStatus(r) {
  const key = normEmail(r.lead_email)
  const opps = await oppsOf(key)
  const o = openOpp(opps)
  if (!o) return { ok: true, found: opps.length > 0, has_open_opportunity: false }
  const ids = await store.smembers('tasks_of:' + o.id)
  const tasks = (await store.get(ids.map((i) => 'task:' + i))).filter(Boolean)
  return { ok: true, found: true, has_open_opportunity: true, opportunity_id: o.id, stage: o.stage, rating: o.rating,
           rating_set_by: o.rating_set_by, meeting_requested: tasks.length > 0, open_tasks: tasks.filter((t) => t.status !== '完了').length }
}

/* ============================================================ 担当者の操作 */

async function opListOpps() {
  const ids = await store.smembers('opps')
  const opps = (await store.get(ids.map((i) => 'opp:' + i))).filter(Boolean)
  const contacts = await store.get(opps.map((o) => 'contact:' + o.contact_key))
  const taskIds = await store.smembers('tasks')
  const tasks = (await store.get(taskIds.map((i) => 'task:' + i))).filter(Boolean)
  const openBy = {}
  for (const t of tasks) if (t.status !== '完了') openBy[t.opp_id] = (openBy[t.opp_id] || 0) + 1
  const rows = opps.map((o, i) => ({ ...o, contact: contacts[i] || { email: o.contact_key }, open_tasks: openBy[o.id] || 0 }))
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
  const notifs = await store.lrange('notifications', 50)
  const [seen] = await store.get(['notifications_seen'])
  return { ok: true, opportunities: rows, tasks: tasks.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
           notifications: notifs, notifications_seen: seen || '', generated_at: jst(), stages: STAGES, owner: OWNER }
}

async function opGetOpp(r) {
  const [o] = await store.get(['opp:' + r.id])
  if (!o) return fail('NOT_FOUND')
  const [contact] = await store.get(['contact:' + o.contact_key])
  const ids = await store.smembers('tasks_of:' + o.id)
  const tasks = (await store.get(ids.map((i) => 'task:' + i))).filter(Boolean).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  const others = (await oppsOf(o.contact_key)).filter((x) => x.id !== o.id).map((x) => ({ id: x.id, name: x.name, stage: x.stage, created_at: x.created_at }))
  return { ok: true, opportunity: o, contact: contact || { email: o.contact_key }, tasks, other_opportunities: others, audit: await store.lrange('audit:' + o.id, 80) }
}

async function opUpdateOpp(r) {
  const [o] = await store.get(['opp:' + r.id])
  if (!o) return fail('NOT_FOUND')
  const next = { ...o }, changed = []
  for (const f of STAFF_FIELDS) {
    if (r[f] === undefined) continue
    let v = r[f] === null ? '' : String(r[f]).trim()
    if (f === 'stage' && !STAGES.includes(v)) return fail('STAGE_INVALID')
    if (f === 'rating') { v = normRating(v); if (v && !RATINGS.includes(v)) return fail('RATING_INVALID') }
    if (f === 'category' && v && !CATEGORIES.includes(v)) return fail('CATEGORY_INVALID')
    if (v !== String(o[f] ?? '')) { next[f] = v; changed.push(f) }
  }
  if (changed.includes('rating')) next.rating_set_by = 'agent'     // 以後 AI からは変わらない
  if (has(r.note)) { next.notes = (o.notes ? o.notes + '\n\n' : '') + `【担当者メモ】${today()}\n${String(r.note).trim()}`; changed.push('notes') }
  if (!changed.length) return { ok: true, updated_fields: [] }
  next.updated_at = jst()
  await saveOpp(next)
  const LABEL = { stage: 'フェーズ', rating: 'リード評価', probability: '確度', close_date: '完了予定日', category: '種別', owner: '担当者',
    property_price: '物件価格', expected_yield: '期待収益', brokerage_fee: '仲介手数料', payment_date: '入金日', contract_price: '成約価格',
    completed_date: '完了日', contracted_property: '成約物件名', file_link: 'ファイルリンク', notes: '備考に追記' }
  await audit(o.id, 'update_opportunity', 'staff', '更新：' + changed.map((f) => LABEL[f] + (f === 'stage' ? `→${next.stage}` : f === 'rating' ? `→${next.rating}` : '')).join('・'))
  return { ok: true, updated_fields: changed, opportunity: next }
}

async function opUpdateTask(r) {
  const [t] = await store.get(['task:' + r.id])
  if (!t) return fail('NOT_FOUND')
  if (!TASK_STATUS.includes(r.status)) return fail('STATUS_INVALID')
  await saveTask({ ...t, status: r.status, done_at: r.status === '完了' ? jst() : '' })
  await audit(t.opp_id, 'update_task', 'staff', `${t.title} → ${r.status}`)
  return { ok: true }
}

async function opMarkNotificationsRead() {
  await store.set([['notifications_seen', jst()]])
  return { ok: true }
}

const AGENT_OPS = { register_lead: opRegisterLead, request_meeting: opRequestMeeting, get_lead_status: opGetLeadStatus }
const STAFF_OPS = { list_opportunities: opListOpps, get_opportunity: opGetOpp, update_opportunity: opUpdateOpp,
                    update_task: opUpdateTask, mark_notifications_read: opMarkNotificationsRead }

function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b))
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y)
}

/* ============================================================ 入口 */

export async function handleCrm(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'MANGIRO CRM', operations: Object.keys(AGENT_OPS),
      store: redisConf() ? 'redis' : (env('VERCEL') ? 'none' : 'dev-file'), notify_email: !!env('CRM_NOTIFY_TO') })
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })

  let body
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}) }
  catch { return res.status(400).json({ ok: false, error: 'BAD_REQUEST', message: 'JSON ではありません' }) }
  const operation = String(body.operation || '')
  const request = body.request && typeof body.request === 'object' ? body.request : {}

  let caller
  if (has(body.token)) {
    if (!env('CRM_TOKEN')) return res.status(503).json({ ok: false, error: 'CRM_TOKEN_NOT_CONFIGURED' })
    if (!same(body.token, env('CRM_TOKEN'))) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED', message: 'token が一致しません' })
    caller = 'agent'
  } else {
    if (!storeReady()) return res.status(503).json({ ok: false, error: 'CRM_NOT_CONFIGURED' })
    if (!env('CRM_VIEW_CODE')) return res.status(503).json({ ok: false, error: 'VIEW_CODE_NOT_CONFIGURED' })
    if (!same(req.headers['x-crm-code'] || '', env('CRM_VIEW_CODE'))) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' })
    caller = 'staff'
  }
  if (!storeReady()) return res.status(503).json({ ok: false, error: 'STORE_NOT_CONFIGURED' })

  const ops = caller === 'agent' ? AGENT_OPS : STAFF_OPS
  const fn = ops[operation]
  if (!fn) return res.status(400).json({ ok: false, error: 'UNKNOWN_OPERATION', message: '使用できる操作は ' + Object.keys(ops).join(' / ') + ' です' })
  if (caller === 'agent') {
    const err = validateAgent(operation, request)
    if (err) return res.status(400).json(fail(err))
  }
  try {
    const out = await fn(request)
    return res.status(out.ok ? 200 : 400).json(out)
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'CRM_EXCEPTION', message: String(e.message || e) })
  }
}
