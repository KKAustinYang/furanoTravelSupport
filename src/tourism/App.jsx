import { useState, useEffect, useRef, useCallback } from 'react'
import { TourCtx, I18N } from './i18n.jsx'
import Nav from './components/Nav.jsx'
import Hero from './components/Hero.jsx'
import Features from './components/Features.jsx'
import Seasons from './components/Seasons.jsx'
import ChatSection from './components/ChatSection.jsx'
import Footer from './components/Footer.jsx'

const ORDER = ['clear', 'sunset', 'snow', 'night']

export default function App() {
  const [lang, setLang] = useState('ja')
  const [weather, setWeather] = useState('clear')
  const pauseRef = useRef(0)

  const t = useCallback((k) => (I18N[lang][k] ?? k), [lang])

  // manual weather pick pauses auto-cycle for 12s
  const pickWeather = useCallback((w) => {
    setWeather(w)
    pauseRef.current = Date.now() + 12000
  }, [])

  // auto-cycle the sky
  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() < pauseRef.current) return
      setWeather((w) => ORDER[(ORDER.indexOf(w) + 1) % ORDER.length])
    }, 6500)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = lang === 'ja' ? '観光AIアシスタント | Tourism AI' : 'Tourism AI Assistant'
  }, [lang])

  return (
    <TourCtx.Provider value={{ lang, setLang, weather, setWeather: pickWeather, t }}>
      <Nav />
      <Hero />
      <Features />
      <Seasons />
      <ChatSection />
      <Footer />
    </TourCtx.Provider>
  )
}
