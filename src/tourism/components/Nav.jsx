import { useEffect, useState } from 'react'
import { useTour } from '../i18n.jsx'

const goChat = () => document.getElementById('chat')?.scrollIntoView({ behavior: 'smooth' })

function Mark() {
  return (
    <svg className="mk" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="15" r="7" fill="#ffd76a" />
      <path d="M3 33 L14 19 L22 28 L28 21 L37 33 Z" fill="#2fb6a3" />
      <path d="M3 33 L37 33 L37 37 L3 37 Z" fill="#3f7fe0" />
    </svg>
  )
}

export default function Nav() {
  const { lang, setLang, t } = useTour()
  const [solid, setSolid] = useState(false)
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <header className={solid ? 'solid' : ''}>
      <div className="wrap nav">
        <a className="brand" href="#top"><Mark /><span><b>{t('brand')}</b><small>TOURISM AI</small></span></a>
        <div className="nav-right">
          <nav className="nav-links">
            <a href="#features">{t('nav_feat')}</a>
            <a href="#seasons">{t('nav_season')}</a>
            <a href="#chat" onClick={(e) => { e.preventDefault(); goChat() }}>{t('nav_chat')}</a>
          </nav>
          <div className="lang">
            <button className={lang === 'ja' ? 'on' : ''} onClick={() => setLang('ja')}>日本語</button>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
          </div>
          <button className="nav-cta" onClick={goChat}>{t('nav_cta')}</button>
        </div>
      </div>
    </header>
  )
}
