import { useState, useEffect, useRef } from 'react'
import { transcripts } from '../data.js'

function fmt(s) { return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') }

export default function Call({ scn, onEndRequest }) {
  const p = scn.persona
  const [sec, setSec] = useState(0)
  const [shown, setShown] = useState(0)
  const timer = useRef(null)

  const script = (transcripts[scn.cat] || transcripts['アウトバウンド']).map(m => ({ ...m, t: m.t.replace(/\{NAME\}/g, p.name) }))

  useEffect(() => {
    setSec(0); setShown(scn.iframe ? script.length : 0)
    timer.current = setInterval(() => setSec(s => s + 1), 1000)
    return () => clearInterval(timer.current)
  }, [scn.id])

  useEffect(() => {
    if (scn.iframe) return
    if (shown >= script.length) return
    const m = script[shown]
    const t = setTimeout(() => setShown(v => v + 1), m && m.who === 'tip' ? 750 : 1150)
    return () => clearTimeout(t)
  }, [shown, scn.id])

  const waves = Array.from({ length: 44 })

  return (
    <div className="call">
      <div className="call-head">
        <div className="rt"><span className="rec"><span className="b" />REC</span><span className="sc-nm">{scn.name}</span></div>
        <div className="rt"><span className={'lv ' + scn.lvClass}>{scn.lv}</span><span className="tm">{fmt(sec)}</span></div>
      </div>

      <div className="card cust-bar">
        <div className="ava">{p.img ? <img src={p.img} alt={p.name} /> : p.init}</div>
        <div><div className="nm">{p.name}<span>{p.age}</span></div></div>
        <div className="emo"><span className="lab">お客様の感情</span><span className="val">{p.mood}</span></div>
      </div>

      <div className={'card chat' + (scn.iframe ? ' live' : '')}>
        {scn.iframe
          ? <iframe className="agent-frame" title={p.name} src={scn.iframe} allow="microphone *; camera *; autoplay *; display-capture *" />
          : script.slice(0, shown).map((m, i) => (
              m.who === 'tip'
                ? <div className={'tip ' + m.kind} key={i}><span className="ic">{m.kind === 'good' ? 'GOOD' : 'HINT'}</span><span>{m.t}</span></div>
                : <div className={'msg ' + m.who} key={i}>
                    <div className="av">{m.who === 'you' ? '私' : (p.img ? <img src={p.img} alt="" /> : p.init)}</div>
                    <div><div className="who">{m.who === 'you' ? 'あなた · YOU' : 'お客様'}</div><div className="bubble">{m.t}</div></div>
                  </div>
            ))}
      </div>

      <div className="card mic-bar">
        {scn.iframe
          ? <><span className="live-note"><span className="live-dot" />実際の AI と通話中です。通話が終わったら「対応を終了」を押してください。</span><button className="btn-end" onClick={() => onEndRequest(sec)}>対応を終了</button></>
          : <>
              <div className="mic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg></div>
              <div className="wave">{waves.map((_, i) => <i key={i} style={{ animationDelay: (i * 0.035) + 's' }} />)}</div>
              <span className="hint-txt">話す・割り込む</span>
              <button className="btn-end" onClick={() => onEndRequest(sec)}>対応を終了</button>
            </>}
      </div>
    </div>
  )
}
