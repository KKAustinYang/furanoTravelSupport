import { useTour } from '../i18n.jsx'
import Reveal from './Reveal.jsx'

const CARDS = [['📍', 'spot'], ['🗺️', 'route'], ['🌤️', 'weather'], ['🏨', 'stay'], ['🌐', 'lang'], ['🆘', 'sos']]

export default function Features() {
  const { t } = useTour()
  return (
    <section className="section" id="features">
      <div className="wrap">
        <Reveal className="sec-head">
          <span className="kicker">{t('feat_kicker')}</span>
          <h2>{t('feat_title')}</h2>
          <p>{t('feat_sub')}</p>
        </Reveal>
        <div className="grid">
          {CARDS.map(([ic, k]) => (
            <Reveal key={k} className="card"><div className="ic">{ic}</div><h3>{t(k + '_h')}</h3><p>{t(k + '_p')}</p></Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
