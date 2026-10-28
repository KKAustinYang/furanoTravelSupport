import { scenarios } from '../data.js'

export default function Settings() {
  return (
    <>
      <div className="set-note">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v5M12 16h.01" /></svg>
        実際に会話できる Audio Agent は「佐藤 美和子」「田中 由紀」の2名です。他はプレースホルダ（テスト用）です。
      </div>
      <div className="card panel" style={{ marginBottom: 18 }}>
        <div className="sec-h"><div><div className="cn">連携アカウント</div><div className="eyebrow">GPTBots CONNECTION</div></div><span className="conn"><span className="d" />接続正常 ・ 最終同期 3 分前</span></div>
      </div>
      <div className="card panel">
        <div className="sec-h"><div><div className="cn">対応 Agent 設定</div><div className="eyebrow">AGENT CONFIGURATION</div></div><button className="mini-btn">+ Agent を追加</button></div>
        <table className="tbl">
          <thead><tr><th>シナリオ</th><th>お客様</th><th>カテゴリ</th><th>Agent 連携</th><th>操作</th></tr></thead>
          <tbody>
            {scenarios.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{s.name}</td>
                <td>{s.persona.name}</td>
                <td><span className={'chip ' + (s.cat === 'インバウンド' ? 'coral' : 'teal')}>{s.cat}</span></td>
                <td>{s.iframe ? <span className="status-on"><span className="d" />接続済み</span> : <span className="status-off"><span className="d" />未連携</span>}</td>
                <td><button className="mini-btn">編集</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
