import { useTour } from '../i18n.jsx'
import Reveal from './Reveal.jsx'

const SEASONS = ['clear', 'sunset', 'snow', 'night']

export default function Seasons() {
  const { t, setWeather } = useTour()
  const go = (w) => { setWeather(w); document.getElementById('top')?.scrollIntoView({ behavior: 'smooth' }) }
  return (
    <section className="section seasons" id="seasons">
      <div className="wrap">
        <Reveal className="sec-head">
          <span className="kicker">{t('season_kicker')}</span>
          <h2>{t('season_title')}</h2>
          <p>{t('season_sub')}</p>
        </Reveal>
        <div className="season-grid">
          {SEASONS.map((k) => (
            <Reveal key={k} className={'sg ' + k} onClick={() => go(k)}><b>{t(k + '_h')}</b><span>{t(k + '_s')}</span></Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
