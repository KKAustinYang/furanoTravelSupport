export default function Records({ records, openReport }) {
  return (
    <div className="card panel">
      <div className="sec-h"><div><div className="cn">研修履歴</div><div className="eyebrow">TRAINING RECORDS ・ 行をクリックでレポート表示</div></div></div>
      <table className="tbl">
        <thead><tr><th>シナリオ</th><th>お客様</th><th>難易度</th><th>日時</th><th>所要</th><th>スコア</th><th></th></tr></thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={i} className={'clickable' + (r.isNew ? ' isnew' : '')} onClick={() => openReport(r)}>
              <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{r.sc}{r.isNew && <span className="new-badge">NEW</span>}</td>
              <td>{r.pe}</td>
              <td><span className={'lv ' + r.dfc}>{r.df}</span></td>
              <td className="mono">{r.dsh}</td>
              <td className="mono">{r.dur}</td>
              <td><span className={'gradepill g' + r.g}>{r.score} · {r.g}</span></td>
              <td className="rowgo">›</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
