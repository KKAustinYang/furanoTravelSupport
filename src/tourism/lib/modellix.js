
// 同源の /api/v1 を叩く → vite.config.js の proxy が Modellix へ転送（CORS回避）
const API_BASE = '/api/v1';

// 絶対URL（http/https どちらでも、ホスト名問わず）をパスだけにして、必ず同源proxy経由にする。
// ※ Modellix は http:// の照会URLを返すことがあり、文字列replaceでは消せないため URL でパースする。
function toProxyPath(u) {
  try {
    const url = new URL(u);          // 絶対URLならパス＋クエリだけ取り出す
    return url.pathname + url.search;
  } catch {
    return u;                        // すでに相対パスならそのまま
  }
}

export const TEXT_STYLES = [
  'A vintage 1950s railway travel poster of a scenic Japanese travel town. Stylized rolling flower fields in bold colorful stripes, gentle green hills and mountains and a stylized sun. Flat colors, screen-print texture, art deco influence, crisp outlines. Large retro title "TRAVEL" at the top and a small Japanese subtitle "花咲く美しい町". Premium vintage tourism poster, 2:3 vertical.',
  'A Japanese ukiyo-e woodblock print travel poster of a scenic Japanese travel destination. Flowing rows of flowers, distant mountains, stylized clouds and waves of blossoms, in the style of Hokusai and Hiroshige. Traditional flat colors, fine linework, paper texture, indigo and soft purple tones. Vertical brush-calligraphy title "旅". Artistic, 2:3 vertical poster.',
  'A modern flat vector illustration travel poster of a charming Japanese travel town. Cute stylized flower fields, colorful rolling hills, gentle mountains, a hot-air balloon and a small train, cheerful palette with soft purple and teal, soft shapes, minimal gradients. Rounded Japanese title "たび". Bright, charming, premium illustration, 2:3 vertical.',
  'A delicate watercolor travel poster of a scenic Japanese travel destination. Hand-painted flower fields fading into soft mountains and a dreamy sky, loose brush strokes, paper texture, gentle purple and green washes, airy negative space at the top. Elegant handwritten-style Japanese title "旅". Soft, artistic, premium watercolor, 2:3 vertical.',
  'A breathtaking cinematic photograph of a scenic Japanese travel destination in summer. Endless blooming flower fields in colorful rows, gentle green hills, distant mountains and a blue sky with soft clouds. Golden hour light, ultra photorealistic, vibrant natural colors, travel poster, 2:3 vertical.',
];

export const PHOTO_STYLES = [
  'Transform this photo into a rich textured oil painting with visible brush strokes and vivid colors. Keep the original composition.',
  'Transform this photo into a soft, delicate watercolor painting with paper texture and gentle washes. Keep the original composition.',
  'Transform this photo into a Japanese ukiyo-e woodblock print style with flat colors and fine linework. Keep the original composition.',
  'Transform this photo into a beautiful anime illustration with clean lines and soft cel shading. Keep the original composition.',
  'Turn this photo into a vintage travel poster illustration with flat screen-print colors and bold shapes. Keep the original composition.',
];

async function submitTask(endpoint, payload) {
  const r = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const j = await r.json();
  console.log('[modellix] submit response:', j);
  if (!j.data || !j.data.task_id) throw new Error(j.message || '送信に失敗しました');
  // 結果照会先：get_result.url があればそれを、無ければ /tasks/{id}
  let poll = (j.data.get_result && j.data.get_result.url)
    ? j.data.get_result.url
    : `${API_BASE}/tasks/${j.data.task_id}`;
  // 絶対URL→相対パスに変換して、こちらも proxy 経由にする（CORS回避の要）
  poll = toProxyPath(poll);
  // Vercel の rewrite は /api/* のみ転送。照会パスが /api 配下でないと SPA に吸われるため警告。
  if (!poll.startsWith('/api/')) {
    console.warn('[modellix] 照会パスが /api 配下ではありません→Vercelで転送されない可能性:', poll);
  }
  console.log('[modellix] poll url:', poll);
  return poll;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 結果オブジェクトから画像URLを取り出す（APIのゆらぎに対応）
function pickImageUrl(result) {
  if (!result) return null;
  return (
    result.resources?.[0]?.url ||
    result.images?.[0]?.url ||
    result.data?.[0]?.url ||
    (Array.isArray(result) ? result[0]?.url : null) ||
    null
  );
}

async function pollTask(taskUrl) {
  // 画像→画像(edit, high)は重く、100秒では足りないことがあるため最大3分待つ
  const MAX_MS = 180000;
  const INTERVAL = 2500;
  const deadline = Date.now() + MAX_MS;
  let lastStatus = '不明';

  while (Date.now() < deadline) {
    await sleep(INTERVAL);
    const r = await fetch(taskUrl);

    // プロキシ経路ミスでHTML(SPA)が返るケースを検知して分かりやすく落とす
    const raw = await r.text();
    let j;
    try {
      j = JSON.parse(raw);
    } catch {
      throw new Error(`結果取得に失敗（プロキシ経路を確認）: ${raw.slice(0, 80)}`);
    }

    const st = j.data && j.data.status;
    lastStatus = st || lastStatus;
    console.log('[modellix] poll status:', st, j.data);

    if (st === 'success' || st === 'succeeded' || st === 'completed') {
      const url = pickImageUrl(j.data.result);
      if (url) return url;
      throw new Error('生成は完了しましたが画像URLを取得できませんでした');
    }
    if (st === 'failed' || st === 'error') {
      throw new Error(j.data.error || j.data.message || '生成に失敗しました');
    }
    // pending / processing / running / queued などはそのまま継続
  }
  throw new Error(`タイムアウトしました（最後の状態: ${lastStatus}）。もう一度お試しください。`);
}

export async function generate(endpoint, payload) {
  const taskUrl = await submitTask(endpoint, payload);
  return await pollTask(taskUrl);
}
