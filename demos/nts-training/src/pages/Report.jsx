import { useState, useEffect } from 'react'
import { comps, strengths, improves, moments, radarVals } from '../data.js'
import { Radar } from '../charts.jsx'
import { CountUp } from '../anim.jsx'
import Logo from '../Logo.jsx'

const gradeWord = { S: '優秀', A: '良好', B: '標準', C: '要改善' }

export default function Report({ rec, go }) {
  const [anim, setAnim] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnim(true), 80); return () => clearTimeout(t) }, [])

  const R = 58, C = 2 * Math.PI * R
  const off = C * (1 - rec.score / 100)
  const best = comps.reduce((a, b) => (b.sc > a.sc ? b : a))
  const worst = comps.reduce((a, b) => (b.sc < a.sc ? b : a))
  const summary = `${strengths[0]}のが印象的でした。次は「${improves[0]}」を意識すると、応対の質はさらに高まります。`

  const meta = [
    { k: 'CUSTOMER', v: rec.pe }, { k: 'DIFFICULTY', v: rec.df },
    { k: 'DURATION', v: rec.dur, mono: true }, { k: 'WORDS', v: rec.w, mono: true },
    { k: 'COMPLIANCE', v: rec.comp },
  ]

  return (
    <div className="report">
      <div className="rep-topbar">
        <button className="back" onClick={() => go('records')}>‹ 研修履歴へ戻る</button>
      </div>

      {/* PDF専用ヘッダー（画面では非表示） */}
      <div className="print-only print-head">
        <div className="ph-l"><div className="ph-logo"><Logo /></div><div><b>応対力トレーニング</b><span>応対品質フィードバックレポート</span></div></div>
        <div className="ph-r"><b>株式会社日本テレシステム</b><span>{rec.date}</span></div>
      </div>

      <div className="rep-hero">
        <div className="rh-bg" aria-hidden="true" />
        <div className="score-ring">
          <svg width="150" height="150" viewBox="0 0 150 150">
            <defs>
              <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2FD4BF" /><stop offset="1" stopColor="#2E9E5B" /></linearGradient>
              <filter id="rgb"><feGaussianBlur stdDeviation="3.2" /></filter>
            </defs>
            <circle cx="75" cy="75" r={R} fill="none" stroke="rgba(255,255,255,.10)" strokeWidth="12" />
            <circle cx="75" cy="75" r={R} fill="none" stroke="url(#rg)" strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={anim ? off : C} transform="rotate(-90 75 75)" opacity=".55" filter="url(#rgb)" style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.22,1,.36,1)' }} />
            <circle cx="75" cy="75" r={R} fill="none" stroke="url(#rg)" strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={anim ? off : C} transform="rotate(-90 75 75)" style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.22,1,.36,1)' }} />
          </svg>
          <div className="num"><b><CountUp end={rec.score} duration={1400} delay={200} /></b><s>/ 100</s></div>
        </div>

        <div className="info">
          <div className="rh-eyebrow"><span>FEEDBACK REPORT</span><i /><span className="mono">{rec.date}</span></div>
          <div className="rh-titlerow">
            <h2>{rec.sc}</h2>
            <span className={'grade-badge g' + rec.g}>GRADE {rec.g} ・ {gradeWord[rec.g]}</span>
          </div>
          <p className="rh-summary">{summary}</p>
          <div className="subm">
            {meta.map((m, i) => (
              <div className="sm-cell" key={i}><div className="k">{m.k}</div><div className={'v' + (m.mono ? ' mono' : '')}>{m.v}</div></div>
            ))}
          </div>
        </div>
      </div>

      <div className="rep-grid">
        <div className="card panel comp-card">
          <div className="sec-h"><div><div className="cn">評価項目</div><div className="eyebrow">COMPETENCY BREAKDOWN</div></div><span className="chip gray">全 6 項目</span></div>
          {comps.map((c, i) => (
            <div className="comp-row" key={i}>
              <div className="comp-top"><span className="nm">{c.nm}<em>{c.en}</em></span><span className="sc" style={{ color: c.c }}><CountUp end={c.sc} duration={1200} delay={300 + i * 90} /></span></div>
              <div className="comp-bar"><i style={{ width: (anim ? c.sc : 0) + '%', background: `linear-gradient(90deg,${c.c},${c.c}bb)`, transitionDelay: (i * 0.08) + 's' }} /></div>
              <div className="comp-note">{c.note}</div>
            </div>
          ))}
        </div>

        <div className="rep-right">
          <div className="card radar-card">
            <div className="sec-h" style={{ width: '100%' }}><div><div className="cn">能力バランス</div><div className="eyebrow">COMPETENCY RADAR</div></div></div>
            <Radar vals={radarVals} size={196} />
            <div className="radar-hl">
              <div className="rh-item best"><span className="lb">最も高い</span><span className="nm">{best.nm}</span><span className="sc">{best.sc}</span></div>
              <div className="rh-item worst"><span className="lb">伸びしろ</span><span className="nm">{worst.nm}</span><span className="sc">{worst.sc}</span></div>
            </div>
          </div>

          <div className="card sw-card good">
            <h4><span className="chip teal">STRENGTHS</span>良かった点</h4>
            <ul className="sw-list good">{strengths.map((s, i) => <li key={i}><span className="mk">✦</span><span>{s}</span></li>)}</ul>
          </div>
          <div className="card sw-card imp">
            <h4><span className="chip coral">IMPROVEMENTS</span>改善ポイント</h4>
            <ul className="sw-list imp">{improves.map((s, i) => <li key={i}><span className="mk">→</span><span>{s}</span></li>)}</ul>
          </div>
        </div>
      </div>

      <div className="card km">
        <div className="sec-h"><div><div className="cn">キーモーメント</div><div className="eyebrow">KEY MOMENTS</div></div><span className="chip gray">通話ハイライト</span></div>
        <div className="km-line">
          {moments.map((m, i) => (
            <div className="km-item" key={i}>
              <div className="km-dot"><span className={m.chip === 'good' ? 'good' : 'advice'} /></div>
              <div className="km-time">{m.t}</div>
              <div className="km-body">
                <div className="lb">{m.lb}<span className={'km-chip ' + (m.chip === 'good' ? 'good' : 'advice')}>{m.chip === 'good' ? 'GOOD' : 'ADVICE'}</span></div>
                <div className="qt">「{m.qt}」</div>
                <div className="nt">{m.nt}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rep-actions">
        <button className="btn btn-primary" onClick={() => go('roleplay')}>もう一度 対応する</button>
        <button className="btn btn-pdf" onClick={() => window.print()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
          レポートをPDFで保存
        </button>
        <button className="btn btn-ghost" onClick={() => go('records')}>履歴に戻る</button>
      </div>

      {/* PDF専用フッター（画面では非表示） */}
      <div className="print-only print-foot">
        <span>株式会社日本テレシステム ・ 応対力トレーニング（AIロールプレイ研修）</span>
        <span>Powered by GPTBots Audio ・ innovation for communication</span>
      </div>
    </div>
  )
}
