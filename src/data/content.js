const ICONS={
  chat:'<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  chart:'<path d="M4 20V4M4 20h16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M8 16v-3M12 16v-7M16 16v-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>',
  globe:'<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 12h17M12 3.5c2.5 2.4 2.5 14.6 0 17M12 3.5c-2.5 2.4-2.5 14.6 0 17" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  shield:'<path d="M12 3 5 6v5c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6l-7-3Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m9 11.5 2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  mail:'<rect x="3.5" y="5.5" width="17" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 7.5 12 13l7.5-5.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  layers:'<path d="m12 4 8 4-8 4-8-4 8-4Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m4 12 8 4 8-4M4 16l8 4 8-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  bell:'<path d="M12 3a6 6 0 0 0-6 6v3.5L4 16h16l-2-3.5V9a6 6 0 0 0-6-6Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9.5 19a2.5 2.5 0 0 0 5 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  cpu:'<rect x="6" y="6" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  user:'<circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  tag:'<path d="M4 13 11 6h7v7l-7 7-7-7Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="14.5" cy="9.5" r="1.4" fill="currentColor"/>',
  search:'<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  support:'<path d="M5 12.5a7 7 0 0 1 14 0" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="3.5" y="12.5" width="3.6" height="6.5" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="16.9" y="12.5" width="3.6" height="6.5" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  window:'<rect x="3.5" y="5" width="17" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 9h17" stroke="currentColor" stroke-width="1.7"/><circle cx="6.4" cy="7" r=".7" fill="currentColor"/><circle cx="8.7" cy="7" r=".7" fill="currentColor"/>',
  sms:'<path d="M4 6h16a1.6 1.6 0 0 1 1.6 1.6v6.8A1.6 1.6 0 0 1 20 16H9l-4 3v-3a1.6 1.6 0 0 1-1.6-1.6V7.6A1.6 1.6 0 0 1 5 6Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="9" cy="11.2" r="1" fill="currentColor"/><circle cx="12" cy="11.2" r="1" fill="currentColor"/><circle cx="15" cy="11.2" r="1" fill="currentColor"/>',
  phone:'<rect x="6.5" y="3" width="11" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10.5 18h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  lock:'<rect x="5" y="10.5" width="14" height="9.5" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="1.7"/>'
};
const TINT={ agent:'#8d9bff', engage:'#3fd6bd', model:'#b39bff' };
const DEMOS=[
  {cat:'agent', icon:'chat', url:'/tourism.html', ja:{t:'観光AIガイド',d:'観光スポット・モデルコース・天気・宿泊から多言語対応・緊急時案内まで、旅に寄り添う観光AIアシスタントのライブデモ。'},en:{t:'Tourism AI Guide',d:'A multilingual tourism AI assistant — spots, routes, weather, lodging and more. Live interactive demo.'},tags:['GPTBots','観光','Live']},
  {cat:'agent', icon:'support', url:'/d/nts-training/index.html', ja:{t:'応対力トレーニングAI（ロールプレイ研修）',d:'コールセンター向けの応対力トレーニング。AIロールプレイのお客様と実際に音声で対話し、評価レポートまで自動生成するデモ。'},en:{t:'Contact-Center Roleplay Training',d:'Agent-skills training for call centers — practice live voice roleplay with AI customers and get an auto-generated evaluation report.'},tags:['GPTBots','研修','Voice']},
  {cat:'agent', icon:'chart', ja:{t:'観光対話ログ分析アシスタント',d:'観光AIに寄せられた会話ログを分析し、統計レポートを自動作成するエージェント。'},en:{t:'Conversation Analytics Assistant',d:'Analyzes tourism chat logs and auto-generates statistical reports.'},tags:['GPTBots','Analytics']},
  {cat:'agent', icon:'spark', ja:{t:'顧客LTVスコアリングAI',d:'来店・客単価・利用データから顧客のLTVスコアを算出するデモAI。'},en:{t:'Customer LTV Scoring AI',d:'Predicts customer lifetime-value scores from visit and usage data.'},tags:['GPTBots','LTV']},
  {cat:'agent', icon:'globe', ja:{t:'多言語翻訳アシスタント',d:'日本語・英語・中国語・韓国語など、多言語間の翻訳を行うAIアシスタント。'},en:{t:'Multilingual Translation Assistant',d:'Translates across Japanese, English, Chinese, Korean and more.'},tags:['GPTBots','翻訳']},
  {cat:'agent', icon:'shield', ja:{t:'GreenReach 保険金請求サポート',d:'保険金請求に必要な情報を、対話形式でわかりやすく確認・整理するサポートAI。'},en:{t:'Insurance Claim Support',d:'Guides customers through insurance claims conversationally.'},tags:['GPTBots','保険']},
  {cat:'agent', icon:'user', ja:{t:'Aurora Management コンシェルジュ',d:'各種お問い合わせに24時間対応する、AIバーチャルコンシェルジュのデモ。'},en:{t:'Aurora Management Concierge',d:'A 24/7 AI virtual concierge for handling all kinds of inquiries.'},tags:['GPTBots','Concierge']},
  {cat:'agent', icon:'tag', ja:{t:'Zeven 真贋鑑定スペシャリスト',d:'ブランド中古品の型番特定や真贋判定を支援する、専門AIスペシャリストのデモ。'},en:{t:'Luxury Authentication Specialist',d:'An expert AI that identifies and authenticates pre-owned luxury goods.'},tags:['GPTBots','真贋鑑定']},
  {cat:'agent', icon:'search', ja:{t:'物件検索・提案AI',d:'ご要望をヒアリングし、最新の掲載情報から条件に合う物件を提案するAIエージェント。'},en:{t:'Property Search & Recommendation',d:'Interviews requirements and recommends matching properties from live listings.'},tags:['GPTBots','物件検索']},
  {cat:'engage', icon:'support', ja:{t:'LiveDesk オムニチャネルサポート',d:'メール・チャット・WhatsApp を一画面で扱う、カスタマーサポート受信箱のデモ。'},en:{t:'LiveDesk Omnichannel Support',d:'A unified support inbox for email, chat and WhatsApp.'},tags:['EngageLab','LiveDesk']},
  {cat:'engage', icon:'layers', ja:{t:'Marketing Automation',d:'条件分岐とチャネルを組み合わせ、行動に応じた配信ジャーニーを設計するデモ。'},en:{t:'Marketing Automation',d:'Design behavior-driven journeys across channels with branching logic.'},tags:['EngageLab','Journey']},
  {cat:'engage', icon:'bell', ja:{t:'AppPush モバイルプッシュ',d:'高到達率のモバイルプッシュ通知を、リアルタイムに配信・計測するデモ。'},en:{t:'AppPush Mobile Notifications',d:'Deliver and measure high-deliverability mobile push in real time.'},tags:['EngageLab','AppPush']},
  {cat:'engage', icon:'window', ja:{t:'WebPush ウェブプッシュ',d:'ブラウザ向けのプッシュ通知でサイト再訪を促すデモ。'},en:{t:'WebPush Notifications',d:'Bring visitors back with browser-based web push.'},tags:['EngageLab','WebPush']},
  {cat:'engage', icon:'mail', ja:{t:'Email メール配信',d:'テンプレート作成から大規模配信・効果測定まで行うメール配信のデモ。'},en:{t:'Email Delivery',d:'From template design to large-scale email delivery and analytics.'},tags:['EngageLab','Email']},
  {cat:'engage', icon:'sms', ja:{t:'SMS 配信',d:'到達性の高いSMSをグローバルに配信するデモ。'},en:{t:'SMS Delivery',d:'Send high-deliverability SMS to customers worldwide.'},tags:['EngageLab','SMS']},
  {cat:'engage', icon:'phone', ja:{t:'WhatsApp Business 対話',d:'WhatsApp 公式 API を活用した、お客様との双方向コミュニケーションのデモ。'},en:{t:'WhatsApp Business Conversations',d:'Two-way customer conversations on the official WhatsApp Business API.'},tags:['EngageLab','WhatsApp']},
  {cat:'engage', icon:'lock', ja:{t:'Silent Auth 番号認証',d:'SMSレスでシームレスに本人確認を行う、番号認証(Silent Auth)のデモ。'},en:{t:'Silent Auth Verification',d:'Seamless SMS-less phone-number verification (Silent Auth).'},tags:['EngageLab','Silent Auth']},
  {cat:'model', icon:'cpu', ja:{t:'Modellix AI モデルコンソール',d:'主要なマルチモーダルAIモデルを、ひとつのコンソールから呼び出せる MaaS のデモ。'},en:{t:'Modellix AI Model Console',d:'Access leading multimodal AI models from a single MaaS console.'},tags:['Modellix','MaaS','AI']}
];
const CATS={ all:{ja:'すべて',en:'All'}, agent:{ja:'AI エージェント',en:'AI Agents'}, engage:{ja:'エンゲージメント',en:'Engagement'}, model:{ja:'AI モデル',en:'AI Models'} };
const FROWS=[
  {c:'#8d9bff', ch:'GPTBots', mv:'1,472', ja:'観光AIガイド', en:'Tourism AI Guide'},
  {c:'#3fd6bd', ch:'EngageLab', mv:'769', ja:'LiveDesk サポート', en:'LiveDesk Support'},
  {c:'#b39bff', ch:'Modellix', mv:'693', ja:'AIモデル呼び出し', en:'Model API calls'}
];
const I18N={
  ja:{nav_demos:'デモ一覧',nav_about:'私たちについて',nav_contact:'お問い合わせ',nav_cta:'お問い合わせ',
    hero_pill_tag:'NEW',hero_pill:'{n}つのライブデモを公開中',
    hero_title:'顧客体験の<br><span class="grad-text">すべて</span>を、ひとつに。',
    hero_lead:'GPTBots・EngageLab・Modellix の製品を、実際に動かして体験。AIエージェントから全チャネル配信まで、ひとつのショーケースに。',
    hero_cta1:'デモを見る',hero_cta2:'お問い合わせ →',
    mock_title:'Aurora Console',mock_n1:'概要',mock_n2:'AIエージェント',mock_n3:'キャンペーン',mock_n4:'分析',mock_n5:'設定',
    mock_s1:'アクティブ会話',mock_s2:'AI 返信率',mock_s3:'本日配信',mock_ch:'月間アクティブ推移',
    trust_line:'NASDAQ 上場。GPTBots・EngageLab・Modellix で世界中の顧客体験を支えています。',
    show_tag:'Demo Showcase',show_title:'すべてのデモを、ひとつに。',show_sub:'製品カテゴリーで絞り込み、気になるデモを開いてご覧ください。',
    cta_title:'次の一歩を、ご一緒に。',cta_sub:'デモのカスタマイズや導入のご相談を承ります。お気軽にお問い合わせください。',
    cta_btn1:'お問い合わせ',cta_btn2:'デモ一覧へ戻る',
    foot_desc:'カスタマーエンゲージメントとデータインテリジェンスのグローバルリーダー。',
    foot_product:'Product',foot_company:'Company',foot_l1:'デモ一覧',foot_l4:'会社概要',foot_l5:'お問い合わせ',foot_l6:'プライバシーポリシー',
    foot_note:'aurora-mobile.jp — プロダクトデモ ショーケース',card_open:'デモを開く'},
  en:{nav_demos:'Demos',nav_about:'About',nav_contact:'Contact',nav_cta:'Contact',
    hero_pill_tag:'NEW',hero_pill:'{n} live demos now available',
    hero_title:'Everything for<br><span class="grad-text">customer experience</span>.',
    hero_lead:'Experience GPTBots, EngageLab and Modellix — from AI agents to omnichannel delivery, all in one showcase.',
    hero_cta1:'View demos',hero_cta2:'Contact us →',
    mock_title:'Aurora Console',mock_n1:'Overview',mock_n2:'AI Agents',mock_n3:'Campaigns',mock_n4:'Analytics',mock_n5:'Settings',
    mock_s1:'Active chats',mock_s2:'AI reply rate',mock_s3:'Sent today',mock_ch:'Monthly active trend',
    trust_line:'NASDAQ-listed. Powering customer experience worldwide with GPTBots, EngageLab and Modellix.',
    show_tag:'Demo Showcase',show_title:'All demos, in one place.',show_sub:'Filter by product and open any demo to explore it live.',
    cta_title:"Let's take the next step.",cta_sub:'We are happy to customize any demo or discuss your needs. Reach out anytime.',
    cta_btn1:'Get in touch',cta_btn2:'Back to demos',
    foot_desc:'A global leader in customer engagement and data intelligence.',
    foot_product:'Product',foot_company:'Company',foot_l1:'Demos',foot_l4:'Company',foot_l5:'Contact',foot_l6:'Privacy Policy',
    foot_note:'aurora-mobile.jp — Product Demo Showcase',card_open:'Open demo'}
};

export { ICONS, TINT, DEMOS, CATS, FROWS, I18N };
