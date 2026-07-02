import { useState } from 'react'
import Logo from './Logo.jsx'
import Home from './Home.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Roleplay from './pages/Roleplay.jsx'
import Setup from './pages/Setup.jsx'
import Call from './pages/Call.jsx'
import Report from './pages/Report.jsx'
import Records from './pages/Records.jsx'
import Settings from './pages/Settings.jsx'
import { initialRecords } from './data.js'

const titles = {
  dashboard: ['ダッシュボード', '応対品質の全体像と直近の研修状況'],
  roleplay: ['ロールプレイ', 'シナリオを選んで応対の練習を始めます'],
  setup: ['ロールプレイ', 'お客様と難易度を確認します'],
  call: ['対応中', 'AI のお客様とリアルタイムで応対します'],
  report: ['フィードバック', '今回の対応を項目別に振り返ります'],
  records: ['研修履歴', 'これまでの対応記録の一覧・クリックでレポート'],
  settings: ['Agent 設定', '各シナリオの対応 Agent を管理します'],
}
const navMap = { dashboard: 'dashboard', roleplay: 'roleplay', setup: 'roleplay', call: 'roleplay', report: 'records', records: 'records', settings: 'settings' }
const NAV = [
  { id: 'dashboard', label: 'ダッシュボード', icon: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></> },
  { id: 'roleplay', label: 'ロールプレイ', icon: <><path d="M4 6a2 2 0 0 1 2-2h5v16H6a2 2 0 0 1-2-2z" /><path d="M13 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5z" /></> },
  { id: 'records', label: '研修履歴', icon: <path d="M4 5h16M4 12h16M4 19h10" /> },
]
const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')

export default function App() {
  const [entered, setEntered] = useState(false)
  const [page, setPage] = useState('dashboard')
  const [curScn, setCurScn] = useState(null)
  const [repRec, setRepRec] = useState(null)
  const [records, setRecords] = useState(initialRecords)
  const [collapsed, setCollapsed] = useState(false)
  const [endOpen, setEndOpen] = useState(false)
  const [pendingSec, setPendingSec] = useState(0)
  const [curCat, setCurCat] = useState('')
  const [search, setSearch] = useState('')

  if (!entered) return <Home onEnter={() => setEntered(true)} />

  const go = p => { setPage(p); window.scrollTo(0, 0) }
  const openScn = scn => { setCurScn(scn); go('setup') }
  const openReport = rec => { setRepRec(rec); go('report') }
  const endCall = () => {
    const p = curScn.persona
    const score = curScn.lvClass === 'h' ? 72 : curScn.lvClass === 'm' ? 80 : 88
    const g = score >= 85 ? 'A' : score >= 75 ? 'B' : 'C'
    const rec = { sc: curScn.name, cat: curScn.cat, pe: p.name, df: curScn.lv, dfc: curScn.lvClass, dsh: '07/01 14:2' + (records.length % 9), dur: fmt(pendingSec || 300), score, g, w: 300 + (score % 60), comp: '指摘 0 件', date: '2026/07/01 14:2' + (records.length % 9), isNew: true }
    setRecords([rec, ...records]); setEndOpen(false); go('records')
  }

  const active = navMap[page]
  return (
    <div className="app">
      <aside className={'sidebar' + (collapsed ? ' collapsed' : '')}>
        <div className="side-brand"><div className="logo"><Logo /></div><div><h1>応対力トレーニング</h1><p>AI ROLEPLAY</p></div></div>
        <nav className="nav">
          <div className="nav-sec">MENU</div>
          {NAV.map(n => (
            <button key={n.id} className={'nav-item' + (active === n.id ? ' active' : '')} onClick={() => go(n.id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{n.icon}</svg><span className="nl">{n.label}</span>
            </button>
          ))}
          <div className="nav-sec">MANAGE</div>
          <button className={'nav-item' + (active === 'settings' ? ' active' : '')} onClick={() => go('settings')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15H4.5a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 6 9.4" /></svg><span className="nl">Agent 設定</span>
          </button>
        </nav>
        <div className="side-foot">
          <button className="side-collapse" onClick={() => setCollapsed(c => !c)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 6l-6 6 6 6" /></svg><span className="nl">メニューを閉じる</span>
          </button>
          <div className="side-user"><div className="ava">田</div><div><div className="nm">田村 直子</div><div className="rl">研修管理部</div></div></div>
          <div className="powered">POWERED BY <b>GPTBots Audio</b></div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div><h2>{titles[page][0]}</h2><p>{titles[page][1]}</p></div>
          <div className="top-actions">
            <span className="pill mono">2026 / 07 / 01</span>
            <span className="pill"><span className="dot" />Audio Agent 連携中</span>
          </div>
        </div>
        <div className="content" key={page}>
          {page === 'dashboard' && <Dashboard go={go} openScn={openScn} records={records} />}
          {page === 'roleplay' && <Roleplay openScn={openScn} curCat={curCat} setCurCat={setCurCat} search={search} setSearch={setSearch} />}
          {page === 'setup' && curScn && <Setup scn={curScn} setScn={setCurScn} go={go} startCall={() => go('call')} />}
          {page === 'call' && curScn && <Call scn={curScn} onEndRequest={sec => { setPendingSec(sec); setEndOpen(true) }} />}
          {page === 'report' && repRec && <Report rec={repRec} go={go} />}
          {page === 'records' && <Records records={records} openReport={openReport} />}
          {page === 'settings' && <Settings />}
        </div>
      </main>

      {endOpen && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setEndOpen(false) }}>
          <div className="modal">
            <h3>対応を終了しますか？</h3>
            <p>終了すると、この対応のフィードバックレポートが作成され、研修履歴に記録されます。</p>
            <div className="row"><button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEndOpen(false)}>続ける</button><button className="btn btn-primary" style={{ flex: 1 }} onClick={endCall}>終了してレポートへ</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
