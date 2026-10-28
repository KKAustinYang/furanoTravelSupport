import { scenarios, kpis, leaders, dist, gradeDist, radarVals, trend, trendLabels } from '../data.js'
import { Radar, LineChart, Donut } from '../charts.jsx'
import { CountUp } from '../anim.jsx'

// '82.4' や '96' から小数桁数を推定
const decimalsOf = s => { const i = String(s).indexOf('.'); return i < 0 ? 0 : String(s).length - i - 1 }

export default function Dashboard({ go, openScn, records }) {
  const featured = scenarios.find(s => s.id === 'in-m')
  const mx = Math.max(...dist.map(d => d.n))
  return (
    <>
      <div className="hero">
        <div className="hero-l">
          <div className="hero-report"><span className="hr-label">応対品質レポート</span><span className="hr-line" /><span className="hr-vol">Vol.07 — 2026.07</span></div>
          <div className="hero-date">木曜日 ・ おはようございます</div>
          <h1>おかえりなさい、<br />直子さん。</h1>
          <p>今週の平均スコアは <b><CountUp end={82.4} decimals={1} duration={1400} /></b>。定期成約率は先月比 <b><CountUp end={5.2} decimals={1} prefix="+" suffix="pt" duration={1400} delay={200} /></b> と、チームは着実に伸びています。今日も一本、丁寧に磨いていきましょう。</p>
          <div className="hero-kpis">
            {kpis.map((k, i) => (
              <div className="hk" key={i}><div className="hk-en">{k.en}</div><div className="hk-v"><CountUp end={parseFloat(k.v)} decimals={decimalsOf(k.v)} duration={1300} delay={i * 120} />{k.unit && <small>{k.unit}</small>}</div><div className="hk-k">{k.k} <span className="up">{k.up}</span></div></div>
            ))}
          </div>
          <div className="hero-actions">
            <button className="btn-hero" onClick={() => go('roleplay')}>▶ ロールプレイを始める</button>
            <button className="btn-hero-link" onClick={() => go('records')}>履歴を見る</button>
          </div>
        </div>
        <div className="hero-r">
          <div className="case-card" onClick={() => openScn(featured)}>
            <img className="case-img" src="persona_tanaka.png" alt="田中 由紀" />
            <div className="case-shade" />
            <div className="case-chips"><span className="case-star">★ 本日のおすすめ</span><span className="case-emo">● 不満</span></div>
            <div className="case-overlay">
              <div className="case-no">CASE FILE No.05 <span className="cn-line" /> INBOUND</div>
              <div className="case-scn">中級 ・ 定期解約の引き止め</div>
              <div className="case-name">田中 由紀 <span>38歳 ・ 共働き</span></div>
              <div className="case-quote">❝ 定期便を解約したいんです。効果も感じないし、高いので。</div>
              <button className="case-btn">このお客様に対応する →</button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid2">
        <div className="card panel">
          <div className="sec-h"><div><div className="cn">スコア推移</div><div className="eyebrow">SCORE TREND ・ 週平均</div></div>
            <div className="legend"><span><i style={{ background:'#0F8C7E' }} />平均スコア</span><span><i style={{ background:'#C5502A' }} />合格ライン</span></div>
          </div>
          <LineChart data={trend} labels={trendLabels} />
        </div>
        <div className="card panel">
          <div className="sec-h"><div><div className="cn">能力レーダー</div><div className="eyebrow">COMPETENCY RADAR</div></div></div>
          <div style={{ display:'flex', justifyContent:'center', paddingTop:6 }}><Radar vals={radarVals} size={204} /></div>
        </div>
      </div>

      <div className="grid2c">
        <div className="card panel">
          <div className="sec-h"><div><div className="cn">評価グレード分布</div><div className="eyebrow">GRADE DISTRIBUTION</div></div></div>
          <Donut items={gradeDist} />
        </div>
        <div className="card panel">
          <div className="sec-h"><div><div className="cn">ランキング</div><div className="eyebrow">TEAM LEADERBOARD</div></div><span className="chip gray">獲得・CS 全 42 名</span></div>
          {leaders.map((b, i) => (
            <div className="lead-row" key={b.r}><span className={'rank' + (b.r <= 3 ? ' g' + b.r : '')}>{b.r}</span><span className="ava">{b.nm[0]}</span><div className="nm">{b.nm}<div className="dp">{b.dp}</div></div><span className="sc"><CountUp end={b.sc} duration={1100} delay={i * 90} /></span></div>
          ))}
        </div>
      </div>

      <div className="grid2">
        <div className="card panel">
          <div className="sec-h"><div><div className="cn">シナリオ別 練習回数</div><div className="eyebrow">SCENARIO DISTRIBUTION</div></div></div>
          {dist.map((d, i) => (
            <div className="dist-row" key={i}><span className="nm">{d.nm}</span><div className="dist-bar"><i style={{ '--w': (d.n / mx * 100) + '%', width:(d.n / mx * 100) + '%', animationDelay:(i * 0.08) + 's' }} /></div><span className="n"><CountUp end={d.n} duration={1100} delay={i * 80} /> 回</span></div>
          ))}
        </div>
        <div className="card panel">
          <div className="sec-h"><div><div className="cn">最近の対応</div><div className="eyebrow">RECENT SESSIONS</div></div><button className="mini-btn" onClick={() => go('records')}>すべて見る</button></div>
          {records.slice(0, 4).map((r, i) => {
            const isIn = r.cat === 'インバウンド'
            return (
              <div className="mini-rec" key={i}>
                <div className="ic" style={{ background: isIn ? 'var(--brand-soft)' : 'var(--accent-soft)', color: isIn ? 'var(--brand-dark)' : '#a5401f' }}>{r.pe[0]}</div>
                <div className="nm">{r.sc}<span>{r.pe} · {r.dsh}</span></div>
                <span className={'gradepill g' + r.g}>{r.score} · {r.g}</span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
