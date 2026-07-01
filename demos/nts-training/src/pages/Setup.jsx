const diffText = {
  '初級': 'お客様は落ち着いており、案内・提案に前向きです。',
  '中級': '前向きだが慎重。1〜2の反論・確認に応える必要があります。',
  '上級': '警戒・感情が強く、薬機法やクロージングまで臨機応変が求められます。',
}
const diffEn = { '初級': 'BASIC', '中級': 'NORMAL', '上級': 'ADVANCED' }

export default function Setup({ scn, go, startCall }) {
  const p = scn.persona
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
            <span className="mood-tag">感情 · {p.mood}</span>
          </div>
        </div>
        <div>
          <div className="card panel" style={{ marginBottom: 20 }}>
            <div className="opt-h"><span className="num">2</span>難易度</div>
            <div className="diff-card">
              <div className="top"><span className="cn">難易度 ・ {scn.lv}</span><span className={'lv ' + scn.lvClass}>{diffEn[scn.lv]}</span></div>
              <div className="dd">{diffText[scn.lv]}</div>
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
