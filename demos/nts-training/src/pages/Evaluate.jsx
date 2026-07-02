import { useState } from 'react'

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1]) // strip data: prefix
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

export default function Evaluate({ scn, onDone, onSkip, go }) {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | error
  const [err, setErr] = useState('')
  const p = scn.persona

  async function run() {
    if (!file) return
    setStatus('loading'); setErr('')
    try {
      const base64 = await toBase64(file)
      const format = (file.name.split('.').pop() || 'mp3').toLowerCase()
      const r = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, format, name: file.name, cat: scn.cat })
      })
      const data = await r.json()
      if (!r.ok || !data.eval) { setStatus('error'); setErr(data.error || 'AIの評価に失敗しました。' + (data.raw ? '（応答: ' + String(data.raw).slice(0, 80) + '…）' : '')); return }
      onDone(data.eval)
    } catch (e) {
      setStatus('error'); setErr('通信に失敗しました。評価サーバー（npm run server）が起動しているか確認してください。')
    }
  }

  return (
    <div className="report" style={{ maxWidth: 640 }}>
      <button className="back" onClick={() => go('records')}>‹ スキップして履歴へ</button>
      <div className="card" style={{ padding: '34px 32px', textAlign: 'center' }}>
        <div className="ev-ava">{p.img ? <img src={p.img} alt={p.name} /> : p.init}</div>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, marginTop: 16 }}>対応おつかれさまでした</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 8, lineHeight: 1.8 }}>
          {scn.name}（{p.name}）の通話音声をアップロードすると、<br />AI が内容を分析して評価レポートを作成します。
        </p>

        {status !== 'loading' && (
          <>
            <label className="ev-drop">
              <input type="file" accept=".mp3,.wav,audio/*" style={{ display: 'none' }} onChange={e => { setFile(e.target.files[0]); setStatus('idle') }} />
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
              <div className="ev-drop-t">{file ? file.name : '音声ファイルを選択（.mp3 / .wav）'}</div>
              <div className="ev-drop-s">クリックしてアップロード</div>
            </label>
            {status === 'error' && <div className="ev-err">{err}</div>}
            <div className="ev-actions">
              <button className="btn btn-ghost" onClick={onSkip}>サンプルで表示</button>
              <button className="btn btn-primary" disabled={!file} style={{ opacity: file ? 1 : .5 }} onClick={run}>AIで評価する →</button>
            </div>
          </>
        )}

        {status === 'loading' && (
          <div className="ev-loading">
            <div className="ev-spinner" />
            <div className="ev-loading-t">AI が通話を分析中…</div>
            <div className="ev-loading-s">音声の長さにより数十秒かかる場合があります</div>
          </div>
        )}
      </div>
    </div>
  )
}
