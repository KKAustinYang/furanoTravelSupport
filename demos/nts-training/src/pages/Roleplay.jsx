import { scenarios, bizList, negEmo } from '../data.js'

const cats = ['すべて', 'アウトバウンド', 'インバウンド']
const LVN = { e: 1, m: 2, h: 3 } // 塗りつぶすレベルドット数

export default function Roleplay({ openScn, curCat, setCurCat, search, setSearch }) {
  return (
    <>
      <div className="lib-top">
        <div className="search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4-4" /></svg>
          <input placeholder="シナリオを検索" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="cats">
          {cats.map(c => {
            const val = c === 'すべて' ? '' : c
            const n = val === '' ? scenarios.length : scenarios.filter(s => s.cat === val).length
            return <button key={c} className={'cat' + (curCat === val ? ' active' : '')} onClick={() => setCurCat(val)}>{c}<span className="cnt">{n}</span></button>
          })}
        </div>
      </div>

      {bizList.map(b => {
        if (curCat !== '' && curCat !== b.cat) return null
        const cards = scenarios.filter(s => s.cat === b.cat && (search === '' || s.persona.name.includes(search) || s.quote.includes(search)))
        if (!cards.length) return null
        return (
          <div className="rp-section" key={b.cat}>
            <div className="rp-head">
              <span className="rp-no">{b.no}</span><span className="rp-title">{b.title}</span>
              <span className={'rp-chip biz-' + b.theme}>{b.cat}</span><span className="rp-chip kpi">{b.kpi}</span>
              <span className="rp-desc">{b.desc}</span>
            </div>
            <div className="rp-cards">
              {cards.map(s => {
                const p = s.persona, neg = negEmo.includes(s.emo)
                return (
                  <div className={'rp-card ' + b.theme} key={s.id} onClick={() => openScn(s)}>
                    <div className="rp-photo">
                      {p.img
                        ? <><img src={p.img} alt={p.name} /><div className="shade" /></>
                        : <><div className={'grad ' + b.theme}><span className="rp-init">{p.init}</span></div><div className="shade" /></>}
                      <span className={'rp-lv lv-' + s.lvClass}>{s.lv}<span className="lv-dots">{[0, 1, 2].map(k => <i key={k} className={k < LVN[s.lvClass] ? 'on' : ''} />)}</span></span>
                      <span className={'rp-emo' + (neg ? ' neg' : '')}>● {s.emo}</span>
                      <div className="rp-nm"><b>{p.name}</b><span>{p.age} ・ {p.job}</span></div>
                    </div>
                    <div className="rp-body">
                      <div className="rp-quote"><span className="qm">❝</span><span>{s.quote}</span></div>
                      <div className="rp-foot"><span className="rp-meta">◷ {s.time.replace('約', '')} ・ {s.count}回</span><span className="rp-go">対応する ›</span></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </>
  )
}
