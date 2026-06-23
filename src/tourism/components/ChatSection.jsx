import { useState } from 'react';
import Reveal from './Reveal.jsx';
import { useTour } from '../i18n.jsx';
import { TEXT_STYLES, PHOTO_STYLES, generate } from '../lib/modellix.js';

const TOURIST_SRC = 'https://livedesk.engagelab.com/console/livedesk/widget/?website_token=LneQjgQg2SjetrywxQntEeMV&mode=standalone';
const STAFF_SRC = 'https://jp.gptbots.ai/widget/eefwoas9zrx8nnqepxloql9/chat.html';

const TEXT_CARDS = [
  { ico: '🎞', label: 'レトロ観光ポスター', sub: 'Vintage' },
  { ico: '🌊', label: '浮世絵・和風', sub: 'Ukiyo-e' },
  { ico: '🎨', label: 'フラットイラスト', sub: 'Flat' },
  { ico: '💧', label: '水彩', sub: 'Watercolor' },
  { ico: '📷', label: '映画風', sub: 'Cinematic' },
];
const PHOTO_CARDS = [
  { ico: '🖼', label: '油絵風', sub: 'Oil' },
  { ico: '💧', label: '水彩風', sub: 'Watercolor' },
  { ico: '🌊', label: '浮世絵風', sub: 'Ukiyo-e' },
  { ico: '✨', label: 'アニメ風', sub: 'Anime' },
  { ico: '🎞', label: 'レトロポスター風', sub: 'Poster' },
];

export default function ChatSection() {
  const { t } = useTour();
  const [bot, setBot] = useState('tourist');
  const [mode, setMode] = useState('text');
  const [imgUrl, setImgUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const BOTS = ['tourist', 'staff', 'image'];
  const cycle = (d) => setBot((b) => BOTS[(BOTS.indexOf(b) + d + 3) % 3]);

  const TITLES = { tourist: t('title_tourist'), staff: t('title_staff'), image: t('title_image') };

  const runGen = async (endpoint, payload) => {
    setBusy(true);
    setResult({ type: 'loading' });
    try {
      const url = await generate(endpoint, payload);
      setResult({ type: 'image', value: url });
    } catch (e) {
      setResult({ type: 'error', value: e.message });
    } finally {
      setBusy(false);
    }
  };

  const genText = (i) => runGen('openai/gpt-image-2', { prompt: TEXT_STYLES[i], size: '1024x1536', quality: 'high' });
  const genPhoto = (i) => {
    if (!/^https?:\/\//.test(imgUrl)) {
      setResult({ type: 'error', value: t('ig_need_url') });
      return;
    }
    runGen('openai/gpt-image-2-edit', { images: [imgUrl], prompt: PHOTO_STYLES[i], size: '1024x1024', quality: 'high' });
  };

  return (
    <section className="chat-section" id="chat">
      <Reveal className="chat-head">
        <div className="eyebrow">{t('chat_kicker')}</div>
        <h2>{t('chat_title')}</h2>
        <p>{t('chat_sub')}</p>
      </Reveal>

      <Reveal className="chat-tabs">
        <button className="tab-arrow" onClick={() => cycle(-1)} aria-label="previous">‹</button>
        <button className={bot === 'tourist' ? 'on' : ''} onClick={() => setBot('tourist')}>🌿 {t('tab_tourist')}<small>TOURIST</small></button>
        <button className={bot === 'staff' ? 'on' : ''} onClick={() => setBot('staff')}>📊 {t('tab_staff')}<small>STAFF</small></button>
        <button className={bot === 'image' ? 'on' : ''} onClick={() => setBot('image')}>🎨 {t('tab_image')}<small>IMAGE</small></button>
        <button className="tab-arrow" onClick={() => cycle(1)} aria-label="next">›</button>
      </Reveal>

      <Reveal className="chat-frame">
        <div className="bar">
          <span className="dot" style={{ background: '#ff5f57' }}></span>
          <span className="dot" style={{ background: '#febc2e' }}></span>
          <span className="dot" style={{ background: '#28c840' }}></span>
          <span className="title">{TITLES[bot]}</span>
          <span className="live"><span className="pulse"></span>{t('online')}</span>
        </div>

        <iframe className={bot === 'tourist' ? '' : 'hidden'} src={TOURIST_SRC} allow="camera;microphone" title="tourist" />
        <iframe className={bot === 'staff' ? '' : 'hidden'} src={STAFF_SRC} allow="microphone *" title="staff" />

        <div className={'imagegen' + (bot === 'image' ? '' : ' hidden')}>
          <div className="ig-modes">
            <button className={mode === 'text' ? 'on' : ''} onClick={() => setMode('text')}>{t('ig_text_mode')}</button>
            <button className={mode === 'photo' ? 'on' : ''} onClick={() => setMode('photo')}>{t('ig_photo_mode')}</button>
          </div>

          <div className={'ig-mode' + (mode === 'text' ? ' on' : '')}>
            <div className="ig-hint">{t('ig_text_hint')}</div>
            <div className="ig-cards">
              {TEXT_CARDS.map((c, i) => (
                <button key={c.label} className="ig-card" disabled={busy} onClick={() => genText(i)}>
                  <span className="ig-ico">{c.ico}</span><b>{c.label}</b><small>{c.sub}</small>
                </button>
              ))}
            </div>
          </div>

          <div className={'ig-mode' + (mode === 'photo' ? ' on' : '')}>
            <div className="ig-hint">{t('ig_photo_hint')}</div>
            <input className="ig-input" placeholder={t('ig_input_ph')} value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} />
            {/^https?:\/\//.test(imgUrl) && <img className="ig-preview" src={imgUrl} alt="preview" />}
            <div className="ig-cards">
              {PHOTO_CARDS.map((c, i) => (
                <button key={c.label} className="ig-card" disabled={busy} onClick={() => genPhoto(i)}>
                  <span className="ig-ico">{c.ico}</span><b>{c.label}</b><small>{c.sub}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="ig-result">
            {result?.type === 'loading' && (<div className="ig-loading"><div className="ig-spin"></div>{t('ig_loading')}</div>)}
            {result?.type === 'error' && <div className="ig-err">⚠️ {result.value}</div>}
            {result?.type === 'image' && (
              <>
                <img className="out" src={result.value} alt="generated" />
                <a className="ig-download" href={result.value} target="_blank" rel="noopener noreferrer">⬇ ダウンロード / 拡大表示</a>
              </>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
