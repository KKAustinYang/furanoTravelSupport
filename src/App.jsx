import { useState, useEffect } from 'react'
import { ICONS, TINT, DEMOS, CATS, FROWS, I18N } from './data/content'

const LOGO_PATHS = (
  <>
    <path d="M 9,82 C 4,50 24,17 48,13 C 70,20 84,46 88,84 C 84,58 70,50 56,47 C 53,56 49,68 46,80 C 40,80 34,81 9,82 Z" fill="url(#lg)" />
    <path d="M 49,16 C 60,22 66,34 65,47 C 64,55 58,59 52,58 C 49,49 48,30 49,16 Z" fill="url(#lb)" />
  </>
)

function Logo({ className }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      {LOGO_PATHS}
    </svg>
  )
}

function Icon({ name, color }) {
  return (
    <svg viewBox="0 0 24 24" style={{ color }} dangerouslySetInnerHTML={{ __html: ICONS[name] || '' }} />
  )
}

export default function App() {
  const [lang, setLang] = useState('ja')
  const [filter, setFilter] = useState('all')
  const [scrolled, setScrolled] = useState(false)

  const t = (k) => {
    const v = I18N[lang][k]
    if (v == null) return ''
    return v.replace('{n}', DEMOS.length)
  }

  // sticky nav background on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // document language + title
  useEffect(() => {
    document.documentElement.lang = lang
    document.title = lang === 'ja' ? 'Aurora Mobile — デモショーケース' : 'Aurora Mobile — Demo Showcase'
  }, [lang])

  // reveal-on-scroll (re-run when content changes)
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }),
      { threshold: 0.12 }
    )
    document.querySelectorAll('.reveal:not(.in)').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [lang, filter])

  const demos = DEMOS.filter((d) => filter === 'all' || d.cat === filter)

  return (
    <>
      {/* shared gradient defs for the logo */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="8" y1="84" x2="86" y2="18" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#1AD79B" />
            <stop offset=".5" stopColor="#22BEDC" />
            <stop offset="1" stopColor="#5a8cff" />
          </linearGradient>
          <linearGradient id="lb" x1="49" y1="59" x2="64" y2="15" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#5566ff" />
            <stop offset="1" stopColor="#8a7bff" />
          </linearGradient>
        </defs>
      </svg>

      {/* NAV */}
      <header className={scrolled ? 'scrolled' : ''}>
        <div className="wrap nav">
          <a className="brand" href="#top">
            <Logo className="logo" />
            <span className="name">Aurora Mobile</span>
          </a>
          <div className="nav-right">
            <nav className="nav-links">
              <a href="#showcase">{t('nav_demos')}</a>
              <a href="#about">{t('nav_about')}</a>
              <a href="#contact">{t('nav_contact')}</a>
            </nav>
            <div className="lang" role="group" aria-label="language">
              <button className={lang === 'ja' ? 'active' : ''} onClick={() => setLang('ja')}>日本語</button>
              <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
            </div>
            <a className="btn btn-primary btn-sm" href="#contact">{t('nav_cta')}</a>
          </div>
        </div>
      </header>

      <main id="top">
        {/* HERO */}
        <section className="hero">
          <div className="hero-glow" />
          <div className="wrap">
            <a className="pill" href="#showcase">
              <span className="tag">{t('hero_pill_tag')}</span>
              <span>{t('hero_pill')}</span>
              <span className="chev">→</span>
            </a>
            <h1 dangerouslySetInnerHTML={{ __html: t('hero_title') }} />
            <p className="lead">{t('hero_lead')}</p>
            <div className="btns">
              <a className="btn btn-primary btn-md" href="#showcase">{t('hero_cta1')}</a>
              <a className="btn btn-ghost btn-md" href="#contact">{t('hero_cta2')}</a>
            </div>

            {/* product frame: analytics console */}
            <div className="frame reveal">
              <div className="f-bar">
                <i /><i /><i />
                <span className="ft">{t('mock_title')}</span>
                <span className="live"><b />Live</span>
              </div>
              <div className="f-body">
                <div className="f-side">
                  <div className="si on"><b /><span>{t('mock_n1')}</span></div>
                  <div className="si"><b /><span>{t('mock_n2')}</span></div>
                  <div className="si"><b /><span>{t('mock_n3')}</span></div>
                  <div className="si"><b /><span>{t('mock_n4')}</span></div>
                  <div className="si"><b /><span>{t('mock_n5')}</span></div>
                </div>
                <div className="f-main">
                  <div className="f-stats">
                    <div className="st"><small>{t('mock_s1')}</small><b>1,472</b></div>
                    <div className="st"><small>{t('mock_s2')}</small><b>93%</b></div>
                    <div className="st"><small>{t('mock_s3')}</small><b>128,400</b></div>
                  </div>
                  <div className="f-chart">
                    <div className="fc-head"><span className="fl">{t('mock_ch')}</span><span className="fr">Realtime</span></div>
                    <svg viewBox="0 0 520 116" aria-hidden="true">
                      <defs>
                        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor="#6e8bff" stopOpacity=".26" />
                          <stop offset="1" stopColor="#6e8bff" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <line className="gl" x1="0" y1="24" x2="520" y2="24" />
                      <line className="gl" x1="0" y1="56" x2="520" y2="56" />
                      <line className="gl" x1="0" y1="88" x2="520" y2="88" />
                      <polygon points="24,92 76,88 128,90 180,84 232,86 284,78 336,46 386,18 440,58 496,38 496,104 24,104" fill="url(#cg)" />
                      <polyline className="l1" points="24,92 76,88 128,90 180,84 232,86 284,78 336,46 386,18 440,58 496,38" />
                      <polyline className="l2" points="24,99 76,98 128,100 180,97 232,99 284,96 336,95 386,96 440,93 496,91" />
                      <circle className="pt" cx="386" cy="18" r="3.6" />
                    </svg>
                    <div className="fc-x"><span>Feb</span><span>Apr</span><span>Jun</span></div>
                  </div>
                  <div className="f-rows">
                    {FROWS.map((x, i) => (
                      <div className="f-row" key={i}>
                        <span className="dot" style={{ background: x.c }} />
                        <span className="nm">{x[lang]}</span>
                        <span className="ch">{x.ch}</span>
                        <span className="mv">{x.mv}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST */}
        <section className="trust">
          <div className="wrap">
            <p>{t('trust_line')}</p>
            <span className="pillrow"><span className="d" />NASDAQ: JG · GPTBots · EngageLab · Modellix</span>
          </div>
        </section>

        {/* SHOWCASE */}
        <section className="section" id="showcase">
          <div className="wrap">
            <div className="sec-head reveal">
              <span className="eyebrow"><span className="n">01</span> <span>{t('show_tag')}</span></span>
              <h2>{t('show_title')}</h2>
              <p>{t('show_sub')}</p>
            </div>
            <div className="filters-wrap reveal">
              <div className="filters">
                {Object.keys(CATS).map((k) => (
                  <button
                    key={k}
                    className={'chip' + (k === filter ? ' active' : '')}
                    onClick={() => setFilter(k)}
                  >
                    {CATS[k][lang]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid">
              {demos.map((d, i) => {
                const col = TINT[d.cat] || '#8d9bff'
                const linkProps = d.url
                  ? { href: d.url, target: '_blank', rel: 'noopener' }
                  : { href: '#showcase' }
                return (
                  <a
                    className="card reveal"
                    style={{ transitionDelay: (i % 3) * 50 + 'ms' }}
                    key={d.cat + i}
                    {...linkProps}
                  >
                    <div className="ico" style={{ color: col }}>
                      <Icon name={d.icon} color={col} />
                    </div>
                    <h3>{d[lang].t}</h3>
                    <p>{d[lang].d}</p>
                    <div className="tags">
                      {d.tags.map((x, j) => <span key={j}>{x}</span>)}
                    </div>
                    <span className="card-link">{t('card_open')} <span className="chev">→</span></span>
                  </a>
                )
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="cta" id="contact">
          <div className="cta-glow" />
          <div className="wrap reveal">
            <h2>{t('cta_title')}</h2>
            <p>{t('cta_sub')}</p>
            <div className="btns">
              <a className="btn btn-primary btn-md" href="mailto:contact@aurora-mobile.jp">{t('cta_btn1')}</a>
              <a className="btn btn-ghost btn-md" href="#showcase">{t('cta_btn2')}</a>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer id="about">
        <div className="wrap">
          <div className="foot-top">
            <div>
              <div className="foot-brand">
                <Logo className="logo" />
                <span className="name">Aurora Mobile</span>
              </div>
              <p className="foot-desc">{t('foot_desc')}</p>
              <span className="foot-pill"><span className="d" />NASDAQ: JG</span>
            </div>
            <div className="foot-cols">
              <div>
                <h4>{t('foot_product')}</h4>
                <a href="#showcase">{t('foot_l1')}</a>
                <a href="#showcase">GPTBots</a>
                <a href="#showcase">EngageLab</a>
                <a href="#showcase">Modellix</a>
              </div>
              <div>
                <h4>{t('foot_company')}</h4>
                <a href="#about">{t('foot_l4')}</a>
                <a href="#contact">{t('foot_l5')}</a>
                <a href="#">{t('foot_l6')}</a>
              </div>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 Aurora Mobile Limited. All rights reserved.</span>
            <span>{t('foot_note')}</span>
          </div>
        </div>
      </footer>
    </>
  )
}
