import { useTour } from '../i18n.jsx'

function Mark() {
  return (
    <svg className="mk" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="15" r="7" fill="#ffd76a" />
      <path d="M3 33 L14 19 L22 28 L28 21 L37 33 Z" fill="#2fb6a3" />
      <path d="M3 33 L37 33 L37 37 L3 37 Z" fill="#3f7fe0" />
    </svg>
  )
}

export default function Footer() {
  const { t } = useTour()
  const goChat = (e) => { e.preventDefault(); document.getElementById('chat')?.scrollIntoView({ behavior: 'smooth' }) }
  return (
    <footer>
      <div className="wrap">
        <div className="foot">
          <div className="fb"><Mark /><span>{t('brand')}</span></div>
          <div>
            <a href="#top">{t('f_home')}</a>
            <a href="#features">{t('nav_feat')}</a>
            <a href="#chat" onClick={goChat}>{t('nav_chat')}</a>
          </div>
        </div>
        <div className="copy">© 2026 Tourism AI Demo. Powered by Aurora Mobile.</div>
      </div>
    </footer>
  )
}
