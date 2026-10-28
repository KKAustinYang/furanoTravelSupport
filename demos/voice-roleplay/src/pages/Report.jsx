import { useState, useEffect, useMemo } from 'react'
import confetti from 'canvas-confetti'
import { sampleEval } from '../data.js'

// レポート表示時の🎉演出（生成直後のみ）。ブランドカラーで上品に。
function celebrateBurst(grade) {
  if (typeof window === 'undefined') return
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const colors = ['#0F8C7E', '#2FD4BF', '#B0853F', '#2E9E5B', '#C5502A', '#F6ECD4']
  const fire = (o) => confetti({ colors, zIndex: 3000, disableForReducedMotion: true, ...o })
  const big = 'SA'.includes(grade) ? 160 : 120 // 好成績はより盛大に
  // ① 中央からの大きな一発（スコア公開に同期）
  const t0 = setTimeout(() => fire({ particleCount: big, spread: 95, startVelocity: 46, origin: { y: 0.34 }, scalar: 1.05, ticks: 220 }), 240)
  // ② 両サイドから吹き上げる連射（約0.9秒）
  const end = Date.now() + 900
  let raf = 0
  const frame = () => {
    fire({ particleCount: 4, angle: 62, spread: 58, startVelocity: 58, origin: { x: 0, y: 0.95 } })
    fire({ particleCount: 4, angle: 118, spread: 58, startVelocity: 58, origin: { x: 1, y: 0.95 } })
    if (Date.now() < end) raf = requestAnimationFrame(frame)
  }
  const t1 = setTimeout(() => { raf = requestAnimationFrame(frame) }, 260)
  return () => { clearTimeout(t0); clearTimeout(t1); cancelAnimationFrame(raf) }
}

const RES = { pass: { c: 'pass', i: '✓', l: 'できた' }, part: { c: 'part', i: '!', l: '一部' }, fail: { c: 'fail', i: '✕', l: '要改善' } }
const CMP = { pass: { c: 'pass', i: '✓', l: '適合' }, caution: { c: 'caution', i: '!', l: '要注意' }, fail: { c: 'fail', i: '✕', l: '違反' } }
const BANNER_IC = { ok: '✓', caution: '!', ng: '✕' }
const gW = { S: '優秀', A: '良好', B: '標準', C: '要改善', D: '不合格' }

// チェックリストからスコア類を確定的に再計算（LLM の算術ミス・不整合を吸収）。
// テンプレート NTS_評価レポート の即時関数を移植。元データは破壊せずクローンして返す。
function normalize(src) {
  const ev = JSON.parse(JSON.stringify(src || {}))
  let ach = 0, tot = 0, catSum = 0
  ;(ev.categories || []).forEach(c => {
    let p = 0, pt = 0
    ;(c.checks || []).forEach(k => { if (k.result === 'pass') p++; else if (k.result === 'part') pt++ })
    c.total = (c.checks || []).length
    c.achieved = p
    c.score = Math.round((c.max || 0) * (p + pt * 0.5) / (c.total || 1))
    ach += p; tot += c.total; catSum += c.score
  })
  let pen = 0, hasFail = false, hasCau = false
  ;(((ev.compliance || {}).checks) || []).forEach(c => {
    if (c.result === 'fail') { pen += 20; hasFail = true }
    else if (c.result === 'caution') { pen += 2; hasCau = true }
  })
  const s = Math.max(0, catSum - pen)
  ev.score = s; ev.achieved = ach; ev.total = tot
  let g = s >= 90 ? 'S' : s >= 80 ? 'A' : s >= 70 ? 'B' : s >= 60 ? 'C' : 'D'
  if (hasFail && 'SAB'.includes(g)) g = 'C'
  ev.grade = g
  if (ev.compliance) ev.compliance.status = hasFail ? 'ng' : (hasCau ? 'caution' : 'ok')
  return ev
}

function Sect({ no, ttl, en }) {
  return <div className="sect"><span className="no">{no}</span><span className="ttl">{ttl}</span><span className="en">{en}</span><span className="rule" /></div>
}

export default function Report({ rec, go, celebrate }) {
  const ev = useMemo(() => normalize(rec.evalData && rec.evalData.categories ? rec.evalData : sampleEval), [rec])

  const [anim, setAnim] = useState(false)
  useEffect(() => { setAnim(false); const t = setTimeout(() => setAnim(true), 140); return () => clearTimeout(t) }, [rec])
  // 生成直後にレポートを開いたときだけ🎉（履歴からの再表示では出さない）
  useEffect(() => { if (celebrate) return celebrateBurst(ev.grade) }, [])

  const R = 54, C = 2 * Math.PI * R, off = C * (1 - ev.score / 100)
  const hasPrev = typeof ev.prev === 'number'
  const delta = hasPrev ? ev.score - ev.prev : 0
  const passLine = ev.passLine ?? 70
  const cleared = ev.score >= passLine

  const cs = ev.compliance || { status: 'ok', banner: '', checks: [] }
  const a = ev.audio || { talk: {}, metrics: [] }
  const talkTotal = ((+a.talk?.customer || 0) + (+a.talk?.operator || 0)) || 100
  const cu = Math.round((+a.talk?.customer || 0) / talkTotal * 100)
  const op = 100 - cu

  const km = ev.key_moments || []
  const goodN = km.filter(m => m.type === 'good').length
  const adviceN = km.length - goodN

  return (
    <div className="report">
      <button className="back" onClick={() => go('records')}>‹ 研修履歴へ戻る</button>

      <div className="std-ribbon">
        <span>準拠基準：</span><b>電話応対技能検定（もしもし検定／JTUA）</b>の評価観点<span className="dot" />
        <b>コンタクトセンター・モニタリング標準（21項目）</b><span className="dot" /><b>薬機法・特商法</b>を最優先ゲートとして判定
      </div>

      {/* exec summary */}
      <div className="exec">
        <div className="exec-top">
          <div className="score-ring">
            <svg width="140" height="140" viewBox="0 0 140 140">
              <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2E9E5B" /><stop offset="1" stopColor="#2FD4BF" /></linearGradient></defs>
              <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="11" />
              <circle cx="70" cy="70" r={R} fill="none" stroke="url(#rg)" strokeWidth="11" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={anim ? off : C} transform="rotate(-90 70 70)" style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.22,1,.36,1)' }} />
            </svg>
            <div className="num"><b>{ev.score}</b><s>/ 100</s></div>
          </div>
          <div className="exec-info">
            <div className="exec-badges">
              <span className="grade-badge">★ GRADE {ev.grade} · {gW[ev.grade] || ''}</span>
              {hasPrev && <span className={'delta' + (delta < 0 ? ' down' : '')}>{delta >= 0 ? '▲' : '▼'} 前回比 {delta >= 0 ? '+' : ''}{delta}（{ev.prev}→{ev.score}）</span>}
              <span className={'passline' + (cleared ? '' : ' miss')}>合格基準 {passLine}点 ▸ {cleared ? 'クリア' : '未達'}</span>
            </div>
            <h2>{ev.scenario || rec.sc} — 総合評価</h2>
            {ev.verdict && <div className="verdict">{ev.verdict}</div>}
            {ev.nextAction && <div className="nextact">▶ 次アクション：{ev.nextAction}</div>}
            <div className="exec-strip">
              <div className="cell"><div className="k">CUSTOMER</div><div className="v">{ev.customer || rec.pe}</div></div>
              <div className="cell"><div className="k">達成項目</div><div className="v">{ev.achieved} / {ev.total}</div></div>
              <div className="cell"><div className="k">着地 OUTCOME</div><div className="v">{ev.outcome || '—'}</div></div>
              <div className="cell"><div className="k">DURATION</div><div className="v">{ev.duration || rec.dur}</div></div>
            </div>
          </div>
        </div>
      </div>

      {/* 01 compliance */}
      <Sect no="01" ttl="法令コンプライアンス" en="COMPLIANCE — TOP PRIORITY GATE" />
      <div className={'cmp-banner ' + cs.status}><span className="ic">{BANNER_IC[cs.status] || '✓'}</span><b>{cs.banner}</b></div>
      <div className="card cmp-card">
        {(cs.checks || []).map((c, i) => {
          const r = CMP[c.result] || CMP.pass
          return (
            <div className="cmp-row" key={i}>
              <div className="cmp-h">
                <span className={'cmp-ic ' + r.c}>{r.i}</span>
                <div className="cmp-tt"><div className="it">{c.item} <span className="law-tag">{c.law}</span></div><div className="cmp-area">{c.area}</div></div>
                <span className={'cmp-res ' + r.c}>{r.l}</span>
              </div>
              {c.rephrase && (c.rephrase.ng || c.rephrase.ok) && (
                <div className="rephrase">
                  <div className="rp-ng"><span className="rp-lab">検出 NG</span><span className="tx">{c.rephrase.ng || '（該当発話なし）'}</span></div>
                  <div className="rp-ok"><span className="rp-lab">推奨 OK</span><span className="tx">{c.rephrase.ok}</span></div>
                </div>
              )}
              {c.why && <div className="rp-why">{c.why}</div>}
              {c.note && <div className="cmp-note">{c.note}</div>}
            </div>
          )
        })}
      </div>

      {/* 02 audio analysis */}
      <Sect no="02" ttl="音声・話し方 分析" en="VOICE ANALYSIS — AI ONLY" />
      <div className="card aud">
        <div className="tl-wrap">
          <div className="tl-head"><span className="cu">お客様 {cu}%</span><span className="op">オペレーター {op}%</span></div>
          <div className="tl-bar"><div className="tl-cu" style={{ width: (anim ? cu : 0) + '%' }}>{cu}%</div><div className="tl-op">{op}%</div></div>
          {a.talk?.note && <div className="tl-note">トークリッスン比：{a.talk.note}</div>}
        </div>
        {(a.metrics || []).map((m, i) => {
          const vc = m.vc || 'pass'
          let bar
          if (m.range) {
            const span = (m.max - m.min) || 1
            const rl = (m.range[0] - m.min) / span * 100
            const rw = (m.range[1] - m.range[0]) / span * 100
            const dp = (m.actual - m.min) / span * 100
            bar = <div className="m-track"><span className="m-range" style={{ left: rl + '%', width: rw + '%' }} /><span className={'m-dot ' + vc} style={{ left: (anim ? dp : 0) + '%' }} /></div>
          } else {
            bar = <div className="m-track"><span className={'m-fill ' + vc} style={{ width: (anim ? (m.fill || 0) : 0) + '%' }} /></div>
          }
          return (
            <div className="metric" key={i}>
              <div className="m-name">{m.name}</div>
              <div className="m-val">{m.val}{m.unit && <s>{m.unit}</s>}</div>
              {bar}
              <div className={'m-ver ' + vc}>{m.ver}</div>
              {m.note && <div className="m-note">{m.note}</div>}
            </div>
          )
        })}
      </div>

      {/* 03 scorecard */}
      <Sect no="03" ttl="評価スコアカード" en="SCORECARD — 21 ITEMS" />
      {(ev.categories || []).map((cat, i) => {
        const rate = cat.total ? Math.round(cat.achieved / cat.total * 100) : 0
        return (
          <div className="card chk-card" key={i}>
            <div className="chk-head">
              <div><div className="cn">{cat.name}</div><div className="eyebrow">{cat.en}</div></div>
              <div className="chk-meta"><span className="chk-count"><b>{cat.achieved}</b> / {cat.total} 達成</span><span className="chk-score">{cat.score}<s>/{cat.max}</s></span></div>
            </div>
            <div className="chk-prog"><i style={{ width: (anim ? rate : 0) + '%' }} /></div>
            <div className="chk-list">
              {(cat.checks || []).map((c, j) => {
                const r = RES[c.result] || RES.fail
                return (
                  <div className={'chk-row ' + r.c} key={j}>
                    <span className={'chk-ic ' + r.c}>{r.i}</span>
                    <div className="chk-main">
                      <div className="chk-item">{c.item}<span className={'chk-res ' + r.c}>{r.l}</span></div>
                      {c.quote && <div className="chk-q">「{c.quote}」</div>}
                      {c.note && <div className="chk-note">{c.note}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* 04 outcome / kpi */}
      <Sect no="04" ttl="業務成果" en="OUTCOME & KPI" />
      <div className="kpi-grid">
        {(ev.kpi || []).map((k, i) => <div className="card kpi" key={i}><div className="k">{k.k}</div><div className="v">{k.v}</div><div className="d">{k.d}</div></div>)}
      </div>

      {/* 05 strengths / improvements */}
      <Sect no="05" ttl="良かった点・改善ポイント" en="STRENGTHS & IMPROVEMENTS" />
      <div className="sw-cols">
        <div className="card sw-card">
          <h4><span className="chip teal">STRENGTHS</span>良かった点</h4>
          <ul className="sw-list good">{(ev.strengths || []).map((s, i) => {
            const point = typeof s === 'string' ? s : s.point
            const quote = typeof s === 'string' ? '' : s.quote
            return <li key={i}><span className="mk">✦</span><div><span className="sw-p">{point}</span>{quote && <span className="sw-q">「{quote}」</span>}</div></li>
          })}</ul>
        </div>
        <div className="card sw-card">
          <h4><span className="chip coral">IMPROVEMENTS</span>改善ポイント</h4>
          <ul className="sw-list imp">{(ev.improvements || []).map((s, i) => {
            const point = typeof s === 'string' ? s : s.point
            const advice = typeof s === 'string' ? '' : s.advice
            return <li key={i}><span className="mk">→</span><div><span className="sw-p">{point}</span>{advice && <span className="sw-adv">💡 {advice}</span>}</div></li>
          })}</ul>
        </div>
      </div>

      {/* 06 model answer */}
      {ev.model && (ev.model.ideal || ev.model.you) && (
        <>
          <Sect no="06" ttl="模範トーク例" en="MODEL ANSWER" />
          <div className="card model">
            {ev.model.ctx && <div className="ctx">{ev.model.ctx}</div>}
            <div className="mt-row mt-you"><span className="mt-lab">今回</span><span className="mt-tx">{ev.model.you}</span></div>
            <div className="mt-row mt-model"><span className="mt-lab">模範</span><span className="mt-tx">{ev.model.ideal}</span></div>
            {ev.model.why && <div className="mt-why">{ev.model.why}</div>}
          </div>
        </>
      )}

      {/* 07 key moments */}
      {km.length > 0 && (
        <>
          <Sect no="07" ttl="キーモーメント" en="KEY MOMENTS" />
          <div className="card km">
            <div className="sec-h"><div><div className="cn">通話ハイライト</div><div className="eyebrow">TIMELINE</div></div><span className="pill-soft">GOOD {goodN} ・ ADVICE {adviceN}</span></div>
            {km.map((m, i) => {
              const good = m.type === 'good'
              const st = good ? { background: 'var(--brand-soft)', color: 'var(--brand-dark)' } : { background: '#F4EAD5', color: '#8A6414' }
              return (
                <div className="km-item" key={i}>
                  <div className="km-time">{m.time}</div>
                  <div className="km-body">
                    <div className="lb">{m.label}<span className="chip" style={st}>{good ? 'GOOD' : 'ADVICE'}</span></div>
                    {m.quote && <div className="qt">「{m.quote}」</div>}
                    {m.note && <div className="nt">{m.note}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* 08 focus */}
      {ev.focus && ev.focus.length > 0 && (
        <>
          <Sect no="08" ttl="次回の重点" en="FOCUS FOR NEXT TIME" />
          <div className="card focus">
            <div className="badge">今回のフォーカス（{ev.focus.length}点だけ）</div>
            {ev.focus.map((f, i) => <div className="focus-item" key={i}><div className="focus-n">{i + 1}</div><div className="focus-tx">{f}</div></div>)}
          </div>
        </>
      )}

      {/* coaching */}
      {ev.coaching && (
        <div className="card coach">
          <div className="coach-badge">COACHING</div>
          <div className="cn" style={{ marginBottom: 8 }}>上長・本人向け 総括</div>
          <p>{ev.coaching}</p>
        </div>
      )}

      <div className="rep-actions">
        <button className="btn btn-primary" onClick={() => go('roleplay')}>もう一度 対応する</button>
        <button className="btn btn-pdf" onClick={() => window.print()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
          PDFで保存
        </button>
        <button className="btn btn-ghost" onClick={() => go('records')}>履歴に戻る</button>
      </div>

      {/* PDF（印刷）専用フッター — 画面では非表示 */}
      <div className="print-foot">
        <span>株式会社日本テレシステム ・ 応対力トレーニング（AI 評価レポート）</span>
        <span>Powered by GPTBots Audio</span>
      </div>
    </div>
  )
}
