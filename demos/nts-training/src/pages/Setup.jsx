import { scenarios } from '../data.js'

const diffText = {
  '初級': 'お客様は落ち着いており、案内・提案に前向きです。',
  '中級': '前向きだが慎重。1〜2の反論・確認に応える必要があります。',
  '上級': '警戒・感情が強く、薬機法やクロージングまで臨機応変が求められます。',
}
const diffEn = { '初級': 'BASIC', '中級': 'NORMAL', '上級': 'ADVANCED' }
const LV_ORDER = ['e', 'm', 'h']

export default function Setup({ scn, setScn, go, startCall }) {
  const p = scn.persona
  // 同じ業務（アウト/イン）の3難易度から選択できるようにする
  const options = LV_ORDER
    .map(lc => scenarios.find(s => s.cat === scn.cat && s.lvClass === lc))
    .filter(Boolean)
  return (
    <>
      <button className="back" onClick={() => go('roleplay')}>‹ シナリオ一覧へ戻る</button>
      <div className="setup-hero">
        <span className={'chip ' + (scn.cat === 'インバウンド' ? 'coral' : 'teal')}>{scn.cat}</span>
        <h2>{scn.name}</h2>
        <div className="d">{scn.desc}</div>
        <div className="meta">
          <div><div className="k">YOUR ROLE</div><div className="val">{scn.role}</div></div>
          <div><div className="k">LEVEL</div><div className="val">{scn.lv}</div></div>
          <div><div className="k">DURATION</div><div className="val">{scn.time}</div></div>
          <div><div className="k">AGENT</div><div className="val">{scn.real ? '接続済み' : 'テストデータ'}</div></div>
        </div>
      </div>
      <div className="setup-grid">
        <div className="card panel">
          <div className="opt-h"><span className="num">1</span>お客様</div>
          <div className="persona">
            <div className="ava">{p.img ? <img src={p.img} alt={p.name} /> : p.init}</div>
            <div>
              <div className="nm">{p.name}<span>{p.age} ・ {p.job}</span></div>
              <div className="ds">{scn.desc}</div>
            </div>
            <span className="mood-tag">感情 · {scn.emo}</span>
          </div>
        </div>
        <div>
          <div className="card panel" style={{ marginBottom: 20 }}>
            <div className="opt-h"><span className="num">2</span>難易度</div>
            <div className="diff-opts">
              {options.map(o => (
                <button
                  key={o.id}
                  className={'diff-opt ' + o.lvClass + (o.id === scn.id ? ' active' : '')}
                  onClick={() => setScn({ ...o, persona: scn.persona })}>
                  <div className="top"><span className="cn">難易度 ・ {o.lv}</span><span className={'lv ' + o.lvClass}>{diffEn[o.lv]}</span></div>
                  <div className="dd">{diffText[o.lv]}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="card start-box">
            <div className="summ"><span>お客様</span><b>{p.name}</b></div>
            <div className="summ"><span>難易度</span><b>{scn.lv}</b></div>
            <div className="summ" style={{ border: 'none' }}><span>あなたの役割</span><b>{scn.role}</b></div>
            <button className="btn btn-primary" style={{ marginTop: 15, width: '100%' }} onClick={startCall}>対応を始める ›</button>
          </div>
        </div>
      </div>
    </>
  )
}
