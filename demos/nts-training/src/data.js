// ===== NTS 応対力トレーニング — インナーシグナル デモデータ =====

// 全 6 シナリオに Audio Agent（GPTBots）を接続済み。
// 難易度・業務ごとに専用 Agent を割り当て。
export const scenarios = [
  // ── 業務A：アウトバウンド（定期案内）──
  { id:'out-e', cat:'アウトバウンド', lv:'初級', lvClass:'e', role:'オペレーター（定期獲得）',
    time:'約5分', count:520, emo:'前向き', real:true, name:'定期コースのご案内 ・ 初級',
    iframe:'https://stg-jp.gptbots.ai/widget/eec6z0wziwbxgfltefrynq2/chat.html',
    quote:'あら、はい。ちょうど乾燥が気になっていて…。',
    desc:'お試しセット購入者へ、定期コースをご案内するアウトバウンド。案内フローを覚え、成約体験を積みます。',
    persona:{ name:'森 久子', age:'55歳', job:'主婦', init:'森', mood:'前向き' } },

  { id:'out-m', cat:'アウトバウンド', lv:'中級', lvClass:'m', role:'オペレーター（定期獲得）',
    time:'約6分', count:300, emo:'様子見', real:true, name:'定期コースのご案内 ・ 中級',
    iframe:'https://stg-jp.gptbots.ai/widget/eex9lwnpkxaggw1dfsmk74e/chat.html',
    quote:'今使ってる化粧品があるので、間に合ってるんですけど。',
    desc:'反論に応えながら、定期のメリットと「いつでも解約可」を伝えて成約に導きます。',
    persona:{ name:'佐藤 美和子', age:'45歳', job:'パート勤務', img:'persona_sato.png', mood:'様子見' } },

  { id:'out-h', cat:'アウトバウンド', lv:'上級', lvClass:'h', role:'オペレーター（定期獲得）',
    time:'約7分', count:190, emo:'警戒', real:true, name:'定期コースのご案内 ・ 上級',
    iframe:'https://stg-jp.gptbots.ai/widget/eermrpxidatcz0zolnb1bpe/chat.html',
    quote:'勧誘の電話ですか？今ちょっと忙しいんですけど。',
    desc:'多忙で警戒の強いお客様に、薬機法に配慮しつつ、クロージングと離脱防止まで実践します。',
    persona:{ name:'三浦 彩', age:'42歳', job:'共働き', init:'三', mood:'警戒' } },

  // ── 業務B：インバウンド（解約引き止め）── 田中 由紀
  { id:'in-e', cat:'インバウンド', lv:'初級', lvClass:'e', role:'オペレーター（解約対応）',
    time:'約5分', count:150, emo:'申し訳なさ', real:true, name:'定期解約の引き止め ・ 初級',
    iframe:'https://stg-jp.gptbots.ai/widget/eeoxrwg4yv2xyjcnnqlskao/chat.html',
    quote:'定期便を解約したくて。使い切れずに溜まっちゃって…。',
    desc:'「解約したい」というお申し出に、傾聴と代替提案で引き止め成功を体験します。',
    persona:{ name:'高橋 節子', age:'58歳', job:'主婦', init:'高', mood:'申し訳なさ' } },

  { id:'in-m', cat:'インバウンド', lv:'中級', lvClass:'m', role:'オペレーター（解約対応）',
    time:'約6分', count:360, emo:'不満', real:true, name:'定期解約の引き止め ・ 中級',
    iframe:'https://stg-jp.gptbots.ai/widget/eevpdnh5syllaicx5sl38ou/chat.html',
    quote:'定期便を解約したいんです。効果も感じないし、高いので。',
    desc:'解約理由に丁寧に向き合い、的確な提案で継続・休止に導く力を鍛えます。',
    persona:{ name:'田中 由紀', age:'38歳', job:'共働き', img:'persona_tanaka.png', mood:'不満' } },

  { id:'in-h', cat:'インバウンド', lv:'上級', lvClass:'h', role:'オペレーター（解約対応）',
    time:'約7分', count:210, emo:'苛立ち', real:true, name:'定期解約の引き止め ・ 上級',
    iframe:'https://stg-jp.gptbots.ai/widget/ee86b0hnosay1l8dlzzf6s1/chat.html',
    quote:'もう解約って言ってますよね？何度も同じ説明は困ります。',
    desc:'強い解約意思・感情・コンプライアンスまで。解約意思を尊重しつつ、円満に着地させます。',
    persona:{ name:'木村 玲子', age:'45歳', job:'クレーム傾向', init:'木', mood:'苛立ち' } },
]

export const bizList = [
  { cat:'アウトバウンド', no:'01', title:'定期コースのご案内', kpi:'KPI：定期成約率', desc:'お試し購入者へ、定期の魅力を伝えて成約へ', theme:'out' },
  { cat:'インバウンド',   no:'02', title:'定期解約の引き止め', kpi:'KPI：解約阻止率', desc:'解約希望のお客様を、傾聴と代替提案で継続へ', theme:'in' },
]
export const negEmo = ['不満','苛立ち','警戒']

export const kpis = [
  { en:'SCORE', v:'82.4', k:'平均スコア', up:'▲+3.1' },
  { en:'CONV.', v:'34.6', unit:'%', k:'定期成約率', up:'▲+5.2pt' },
  { en:'RETENTION', v:'61.8', unit:'%', k:'解約阻止率', up:'▲+8pt' },
  { en:'COMPLY', v:'96', unit:'%', k:'遵守率', up:'▲+2pt' },
]

export const comps = [
  { nm:'傾聴・共感', en:'EMPATHY', sc:80, c:'#0F8C7E', note:'お客様の気持ちに寄り添えていました。相づちをもう少し増やすと、さらに安心されます。' },
  { nm:'ヒアリング・状況把握', en:'DISCOVERY', sc:78, c:'#B0853F', note:'解約理由は引き出せましたが、背景（使用状況・お金の不安）をもう一歩深掘りできると理想です。' },
  { nm:'提案力・クロージング', en:'PROPOSAL', sc:85, c:'#0F8C7E', note:'休止という代替を提示し、無理なく着地に導けました。' },
  { nm:'説明の正確性', en:'ACCURACY', sc:82, c:'#0F8C7E', note:'解約条件（5日前まで）を正確に案内できました。' },
  { nm:'コンプライアンス', en:'COMPLIANCE', sc:92, c:'#2E9E5B', note:'効果の断定など薬機法上の問題はなく、解約意思も尊重できていました。' },
  { nm:'応対マナー・言葉遣い', en:'ETIQUETTE', sc:84, c:'#0F8C7E', note:'敬語は適切です。やや早口になる場面がありました。' },
]
export const strengths = ['まず解約のお申し出を尊重できた','解約理由に共感を示せた','「いつでも休止・解約可」を明確に伝えられた']
export const improves  = ['解約理由の背景をもう一歩ヒアリング','代替提案（休止・間隔変更）をより具体的に','解約条件（5日前まで）を早めに明示']
export const moments = [
  { t:'00:35', lb:'解約意思の尊重', chip:'good', qt:'かしこまりました。まずはご事情をお伺いできますか。', nt:'頭ごなしに引き止めず、まず受け止められています。' },
  { t:'02:10', lb:'代替提案', chip:'advice', qt:'お届けの間隔を空けることもできます。', nt:'提案はできましたが、もう一歩具体的だと、より効果的です。' },
  { t:'04:05', lb:'解約条件の案内', chip:'good', qt:'次回お届けの5日前まででしたら承れます。', nt:'ルールを明確に案内できています。' },
]

export const initialRecords = [
  { sc:'定期解約の引き止め ・ 中級', cat:'インバウンド', pe:'田中 由紀', df:'中級', dfc:'m', dsh:'07/01 14:22', dur:'05:12', score:82, g:'A', w:342, comp:'指摘 0 件', date:'2026/07/01 14:22' },
  { sc:'定期コースのご案内 ・ 中級', cat:'アウトバウンド', pe:'佐藤 美和子', df:'中級', dfc:'m', dsh:'06/30 11:05', dur:'06:40', score:76, g:'B', w:388, comp:'指摘 1 件', date:'2026/06/30 11:05' },
  { sc:'定期解約の引き止め ・ 上級', cat:'インバウンド', pe:'木村 玲子', df:'上級', dfc:'h', dsh:'06/29 16:40', dur:'05:55', score:69, g:'C', w:410, comp:'指摘 2 件', date:'2026/06/29 16:40' },
  { sc:'定期コースのご案内 ・ 初級', cat:'アウトバウンド', pe:'森 久子', df:'初級', dfc:'e', dsh:'06/28 10:12', dur:'04:20', score:84, g:'A', w:265, comp:'指摘 0 件', date:'2026/06/28 10:12' },
]

export const leaders = [
  { r:1, nm:'佐藤 未来', dp:'獲得1課', sc:92 }, { r:2, nm:'鈴木 大輔', dp:'CS課', sc:89 },
  { r:3, nm:'高橋 彩', dp:'獲得2課', sc:87 }, { r:4, nm:'伊藤 健', dp:'CS課', sc:83 }, { r:5, nm:'渡辺 陽子', dp:'獲得1課', sc:81 },
]
export const dist = [
  { nm:'定期コースのご案内 ・ 初級', n:38 }, { nm:'定期コースのご案内 ・ 中級', n:31 }, { nm:'定期コースのご案内 ・ 上級', n:22 },
  { nm:'定期解約の引き止め ・ 初級', n:26 }, { nm:'定期解約の引き止め ・ 中級', n:24 }, { nm:'定期解約の引き止め ・ 上級', n:15 },
]
export const gradeDist = [
  { g:'S', nm:'S · 優秀', n:6, c:'#B0853F' }, { g:'A', nm:'A · 良好', n:15, c:'#2E9E5B' },
  { g:'B', nm:'B · 標準', n:15, c:'#0F8C7E' }, { g:'C', nm:'C · 要改善', n:6, c:'#C5502A' },
]
export const radarAxes = ['傾聴','ヒアリング','正確性','提案','遵守','マナー']
export const radarVals = [80,78,82,85,92,84]
export const trend = [71,74,73,77,79,81,82.4]
export const trendLabels = ['月','火','水','木','金','土','日']

// モックのロールプレイ台詞（実機接続前のプレビュー用）
export const transcripts = {
  'アウトバウンド':[
    { who:'you', t:'お忙しいところ恐れ入ります。インナーシグナル お客様窓口の鈴木と申します。{NAME}様のお電話でよろしいでしょうか。' },
    { who:'cust', t:'はい、佐藤ですが…。' },
    { who:'tip', kind:'good', t:'名乗りとお客様確認から。丁寧な導入です。' },
    { who:'you', t:'先日お試しいただいた「リジュブネイト ワン」、その後のお肌の調子はいかがでしょうか。' },
    { who:'cust', t:'ええ、まあ…悪くはないと思うんですけど。' },
    { who:'you', t:'ありがとうございます。実は本日、定期コースのお得なご案内でお電話いたしました。' },
    { who:'cust', t:'あら、定期…。おいくらくらいになるんですか？' },
    { who:'tip', kind:'hint', t:'価格だけでなく「いつでも解約・休止可」もセットで伝えると安心されます。' },
    { who:'you', t:'2回目以降も割引・送料無料でお続けいただけます。いつでも解約・休止も可能です。' },
    { who:'cust', t:'そう…なら、一度お願いしてみようかしら。' },
  ],
  'インバウンド':[
    { who:'you', t:'お電話ありがとうございます。インナーシグナル お客様窓口の鈴木でございます。' },
    { who:'cust', t:'もしもし、あの…インナーシグナルの定期を、解約したいんですけど。' },
    { who:'tip', kind:'good', t:'まず解約の意思を尊重する姿勢を。強い引き止めはNGです。' },
    { who:'you', t:'かしこまりました。差し支えなければ、解約のご理由をお伺いできますでしょうか。' },
    { who:'cust', t:'効果がまだよく分からなくて…。それに、少し高いかなと思って。' },
    { who:'you', t:'さようでございますか。実は、お届けの間隔を空けてご負担を抑えることもできますが、いかがでしょうか。' },
    { who:'tip', kind:'hint', t:'理由に向き合った代替提案はOK。一つだけ、丁寧に。' },
    { who:'cust', t:'うーん…そうですね、一度お休みにするのもいいかもしれません。' },
    { who:'you', t:'ありがとうございます。次回お届け予定日の5日前まででしたら、お休み・解約どちらも承れます。' },
    { who:'cust', t:'じゃあ、一度お休みでお願いします。' },
  ],
}
