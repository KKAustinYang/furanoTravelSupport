import Logo from './Logo.jsx'

const FEATURES = [
  { en:'REALTIME ROLEPLAY', t:'リアルタイム音声ロールプレイ',
    d:'AIのお客様と実際に電話で対話。定期案内（アウトバウンド）と解約対応（インバウンド）を、難易度別に何度でも練習できます。',
    icon:<><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10a7 7 0 0 1-14 0M12 19v3"/></> },
  { en:'AI EVALUATION', t:'AIによる自動評価',
    d:'通話をAIが分析し、傾聴・ヒアリング・提案・正確性・コンプライアンス・マナーの6項目で採点。発言を引用した公平なフィードバックを返します。',
    icon:<><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></> },
  { en:'ANALYTICS', t:'ダッシュボード分析',
    d:'スコア推移・能力レーダー・成約率などを可視化。個人からチーム全体まで、育成状況をひと目で把握できます。',
    icon:<><path d="M3 3v18h18"/><path d="M18 9l-5 5-3-3-4 4"/></> },
]

const STEPS = [
  { t:'シナリオを選ぶ', d:'定期案内・解約対応から、練習したい場面を選択します。' },
  { t:'AIとロールプレイ', d:'AIのお客様とリアルタイムで通話し、実践形式で応対します。' },
  { t:'AIが自動で評価', d:'通話内容をAIが分析し、6項目で採点・フィードバックします。' },
  { t:'レポートで振り返り', d:'強み・改善点・キーモーメントを確認し、次の対応へ活かします。' },
]

const BARS = [
  { nm:'傾聴・共感', v:80 }, { nm:'提案力', v:85 }, { nm:'コンプライアンス', v:92 },
]

export default function Home({ onEnter }) {
  return (
    <div className="tl">
      {/* ===== HERO ===== */}
      <header className="tl-hero">
        <div className="tl-hero-bg" aria-hidden="true" />
        <div className="tl-wrap">
          <nav className="tl-nav">
            <div className="tl-brand">
              <div className="tl-logo"><Logo /></div>
              <div className="tl-brand-t"><b>日本テレシステム</b><span>CONTACT CENTER TRAINING</span></div>
            </div>
            <div className="tl-nav-links">
              <a href="#features">特長</a>
              <a href="#personas">登場するお客様</a>
              <a href="#flow">ご利用の流れ</a>
            </div>
            <button className="tl-nav-cta" onClick={onEnter}>システムを開く<span>→</span></button>
          </nav>

          <div className="tl-hero-grid">
            <div className="tl-hero-l">
              <div className="tl-eyebrow"><span className="tl-eyebrow-dot" />株式会社日本テレシステム ・ コンタクトセンター DX</div>
              <h1 className="tl-h1">電話応対を、<br /><span className="tl-h1-ac">AIで、磨く。</span></h1>
              <p className="tl-lead">AIのお客様とリアルタイムで通話し、応対をその場でAIが評価。定期案内から解約対応まで——現場から生まれた、実践型オペレーター育成プラットフォームです。</p>
              <div className="tl-tagline">つながる、ひろがる、ひびきあう<i>innovation&nbsp;for&nbsp;communication</i></div>
              <div className="tl-cta">
                <button className="tl-btn-primary" onClick={onEnter}>応対力トレーニングを開く<span>→</span></button>
                <a className="tl-btn-ghost" href="#features">特長を見る</a>
              </div>
              <div className="tl-stats">
                <div className="tl-stat"><b>6</b><span>実務シナリオ</span></div>
                <div className="tl-stat"><b>6<i>項目</i></b><span>AI評価軸</span></div>
                <div className="tl-stat"><b>+5.2<i>pt</i></b><span>定期成約率</span></div>
              </div>
            </div>

            <div className="tl-hero-r">
              <div className="tl-preview">
                <div className="tl-preview-head">
                  <span className="tl-rec"><i />REC ・ 05:12</span>
                  <span className="tl-livechip"><em />LIVE 評価中</span>
                </div>
                <div className="tl-preview-cust">
                  <img src="persona_tanaka.png" alt="田中 由紀" />
                  <div className="tl-pc-t"><b>田中 由紀</b><span>インバウンド ・ 定期解約の引き止め</span></div>
                </div>
                <div className="tl-preview-body">
                  <div className="tl-ring" style={{ background:'conic-gradient(#2f9bd8 0deg, #0666A9 296deg, rgba(9,44,74,.10) 296deg)' }}>
                    <div className="tl-ring-in"><b>82.4</b><s>SCORE</s></div>
                  </div>
                  <div className="tl-bars">
                    {BARS.map((b, i) => (
                      <div className="tl-bar" key={i}>
                        <div className="tl-bar-top"><span>{b.nm}</span><em>{b.v}</em></div>
                        <div className="tl-bar-tr"><i style={{ width:b.v + '%' }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="tl-preview-foot"><span className="tl-good">GOOD</span>まず解約の意思を尊重できました。</div>
              </div>
              <div className="tl-float">❝ 定期便を解約したいんです。効果も感じないし、高いので。</div>
            </div>
          </div>
        </div>
      </header>

      {/* ===== BUSINESS STRIP ===== */}
      <div className="tl-strip">
        <div className="tl-wrap tl-strip-in">
          <span className="tl-strip-label">日本テレシステムの現場から生まれた研修</span>
          <div className="tl-strip-items">
            <span>インバウンド</span><span>アウトバウンド</span><span>リサーチ</span><span>フルフィルメント</span><span>バックオフィス BPO</span>
          </div>
        </div>
      </div>

      {/* ===== FEATURES ===== */}
      <section className="tl-sec" id="features">
        <div className="tl-wrap">
          <div className="tl-head">
            <div className="tl-sec-eyebrow">FEATURES</div>
            <h2>研修を、ひとつのシステムで。</h2>
            <p>ロールプレイから評価、分析まで。新人オペレーターの応対力を、AIが一貫して支えます。</p>
          </div>
          <div className="tl-fcards">
            {FEATURES.map((f, i) => (
              <div className="tl-fcard" key={i}>
                <div className="tl-fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{f.icon}</svg></div>
                <div className="tl-fc-en">{f.en}</div>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PERSONAS ===== */}
      <section className="tl-sec tl-sec-alt" id="personas">
        <div className="tl-wrap">
          <div className="tl-head">
            <div className="tl-sec-eyebrow">CUSTOMERS</div>
            <h2>登場するお客様</h2>
            <p>実在感のある2名のお客様。感情や迷いまで、AIがリアルに演じます。</p>
          </div>
          <div className="tl-pcards">
            <div className="tl-pcard">
              <div className="tl-ph"><img src="persona_sato.png" alt="佐藤 美和子" /></div>
              <div className="tl-pc-body">
                <span className="tl-tag out">アウトバウンド ・ 定期案内</span>
                <h4>佐藤 美和子 <em>45歳 ・ パート勤務</em></h4>
                <p>お試しセットを購入したお客様。穏やかで丁寧だが慎重で、押し売りは苦手。「続けられるか」への不安に、いかに寄り添えるか。</p>
              </div>
            </div>
            <div className="tl-pcard">
              <div className="tl-ph"><img src="persona_tanaka.png" alt="田中 由紀" /></div>
              <div className="tl-pc-body">
                <span className="tl-tag in">インバウンド ・ 解約引き止め</span>
                <h4>田中 由紀 <em>38歳 ・ 共働き</em></h4>
                <p>定期を解約したいと電話してきたお客様。理性的で忙しく、要領を得ない対応やしつこい引き止めには不快感を示します。</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FLOW ===== */}
      <section className="tl-sec" id="flow">
        <div className="tl-wrap">
          <div className="tl-head">
            <div className="tl-sec-eyebrow">HOW IT WORKS</div>
            <h2>ご利用の流れ</h2>
            <p>選んで、話して、振り返る。たった4ステップで研修が完結します。</p>
          </div>
          <div className="tl-steps">
            {STEPS.map((s, i) => (
              <div className="tl-step" key={i}>
                <div className="tl-no">{String(i + 1).padStart(2, '0')}</div>
                <h4>{s.t}</h4>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== BRAND BAND ===== */}
      <section className="tl-brandband">
        <div className="tl-bb-bg" aria-hidden="true" />
        <div className="tl-wrap tl-bb-in">
          <div className="tl-bb-tag">つながる、ひろがる、ひびきあう</div>
          <div className="tl-bb-sub">innovation for communication</div>
          <p className="tl-bb-lead">人と企業、そして社会に、多様なつながりと広がりを。日本テレシステムはコンタクトセンター／BPO で培った現場知を、AI研修という新しいかたちで次世代のオペレーターへ届けます。</p>
          <div className="tl-bb-meta"><span>Pマーク取得企業</span><span>AIストーム グループ</span><span>東京 ・ 埼玉 ・ 北海道</span></div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <div className="tl-ctaband-wrap">
        <div className="tl-wrap">
          <div className="tl-ctaband">
            <div className="tl-cb-bg" aria-hidden="true" />
            <div className="tl-cb-l">
              <h2>今すぐ、AI応対トレーニングを体験。</h2>
              <p>システムを開いて、ロールプレイから評価レポートまでの流れをご覧ください。</p>
            </div>
            <button className="tl-btn-white" onClick={onEnter}>応対力トレーニングを開く<span>→</span></button>
          </div>
        </div>
      </div>

      {/* ===== FOOTER ===== */}
      <footer className="tl-foot">
        <div className="tl-wrap tl-foot-in">
          <div className="tl-foot-brand">
            <div className="tl-logo lg"><Logo /></div>
            <div className="tl-fb-t">株式会社日本テレシステム</div>
            <div className="tl-fb-s">応対力トレーニング ・ AIロールプレイ研修<br />大塚製薬 インナーシグナル コンタクトセンター向けデモ</div>
          </div>
          <div className="tl-foot-cols">
            <div className="tl-fcol">
              <h5>SERVICE</h5>
              <a>コンタクトセンター</a><a>インバウンド ／ アウトバウンド</a><a>リサーチ</a><a>BPO ・ フルフィルメント</a>
            </div>
            <div className="tl-fcol">
              <h5>OFFICE</h5>
              <a>東京本社</a><a>埼玉オフィス</a><a>北海道オフィス</a>
            </div>
            <div className="tl-fcol">
              <h5>GROUP</h5>
              <a>AIストーム株式会社</a><a>プライバシーマーク取得</a><a>Powered by GPTBots Audio</a>
            </div>
          </div>
        </div>
        <div className="tl-wrap tl-foot-bar">
          <span>© 2026 Nihon Telesystem, Inc.</span>
          <span className="tl-foot-tag">innovation for communication</span>
        </div>
      </footer>
    </div>
  )
}
