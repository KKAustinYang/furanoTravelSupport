import { useEffect, useRef } from 'react'
import { useTour } from '../i18n.jsx'

const goChat = () => document.getElementById('chat')?.scrollIntoView({ behavior: 'smooth' })
const WEATHERS = [['clear', '☀️', 'w_clear'], ['sunset', '🌇', 'w_sunset'], ['snow', '❄️', 'w_snow'], ['night', '✦', 'w_night']]

export default function Hero() {
  const { t, weather, setWeather } = useTour()
  const starsRef = useRef(null)
  const snowRef = useRef(null)

  useEffect(() => {
    if (starsRef.current && !starsRef.current.childElementCount) {
      let h = ''
      for (let i = 0; i < 70; i++) {
        const s = Math.random() * 2 + 1
        h += `<span class="star" style="width:${s}px;height:${s}px;top:${Math.random() * 62}%;left:${Math.random() * 100}%;animation-delay:${(Math.random() * 3.5).toFixed(2)}s"></span>`
      }
      starsRef.current.innerHTML = h
    }
    if (snowRef.current && !snowRef.current.childElementCount) {
      let h = ''
      for (let i = 0; i < 70; i++) {
        const s = Math.random() * 4 + 2
        h += `<span class="flake" style="width:${s}px;height:${s}px;left:${Math.random() * 100}%;animation-duration:${(Math.random() * 6 + 6).toFixed(1)}s;animation-delay:${(-Math.random() * 8).toFixed(1)}s;opacity:${(Math.random() * 0.6 + 0.4).toFixed(2)}"></span>`
      }
      snowRef.current.innerHTML = h
    }
  }, [])

  return (
    <section className="scene" id="top" data-w={weather}>
      <div className="layer sky"></div>
      <div className="layer stars" ref={starsRef}></div>
      <div className="layer"><div className="sun"></div><div className="moon"></div></div>
      <div className="layer clouds"><div className="cloud c1"></div><div className="cloud c2"></div><div className="cloud c3"></div></div>
      <div className="layer snow" ref={snowRef}></div>
      <svg className="mountains" viewBox="0 0 1440 460" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 250 L240 120 L430 235 L660 100 L900 250 L1160 130 L1440 270 L1440 460 L0 460 Z" fill="#3f7fae" opacity=".55" />
        <path d="M0 320 L260 210 L520 320 L780 200 L1040 320 L1300 220 L1440 320 L1440 460 L0 460 Z" fill="#2a6f86" opacity=".7" />
        <path d="M0 380 L300 300 L640 388 L980 305 L1280 380 L1440 350 L1440 460 L0 460 Z" fill="#1d5466" opacity=".9" />
        <path d="M0 420 L1440 405 L1440 460 L0 460 Z" fill="#143a47" />
      </svg>
      <div className="layer haze"></div>

      <div className="hero-inner">
        <div className="wrap">
          <span className="eyebrow">{t('hero_eyebrow')}</span>
          <h1 dangerouslySetInnerHTML={{ __html: t('hero_title') }} />
          <p className="lead">{t('hero_lead')}</p>
          <div className="hero-cta">
            <button className="btn-primary" onClick={goChat}>
              {t('hero_cta1')}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
            <a className="btn-ghost" href="#features">{t('hero_cta2')}</a>
          </div>
        </div>
      </div>

      <div className="weather-switch">
        <span className="cap">{t('ws_cap')}</span>
        {WEATHERS.map(([w, ic, k]) => (
          <button key={w} className={'ws' + (weather === w ? ' on' : '')} onClick={() => setWeather(w)}>{ic} <span>{t(k)}</span></button>
        ))}
      </div>
    </section>
  )
}
