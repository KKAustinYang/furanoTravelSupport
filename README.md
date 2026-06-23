# Aurora Mobile — Demo Showcase (Vite + React)

面向日本客户的产品 demo 展示库。Linear 风格深色设计,日本語 / English 切换,
覆盖 GPTBots · EngageLab · Modellix 三大产品线。

**统一一个项目、一次部署。** 内含两个页面(Vite 多页面):
- `/`（`index.html`）— 展示库主页
- `/tourism.html` — 通用「観光AIアシスタント」互动 demo(EngageLab 客服聊天 + GPTBots 分析 + Modellix 海报生成)。展示库里的「観光AIガイド」卡片点击后打开它。

## 本地开发

```bash
npm install        # 安装依赖(首次)
npm run dev        # 本地预览, 打开 http://localhost:5173
npm run build      # 生产构建, 输出到 dist/
npm run preview    # 预览构建产物
```

## 环境变量

把 `.env.example` 复制成 `.env.local`(已被 git 忽略),填入真实值:

```
MODELLIX_KEY=mdlx-...                 # Modellix 海报生成用(服务端密钥, 不带 VITE_ 前缀)
VITE_ENGAGELAB_APPKEY=...             # EngageLab WebPush(可留空=关闭)
```

**在哪配置 API key:**
- 本地开发:项目根目录 `.env.local` 里的 `MODELLIX_KEY`(已填好)。
- 线上:Vercel → 你的项目 → **Settings → Environment Variables** → 添加 `MODELLIX_KEY`(三个环境都勾上)。

### 🔒 Modellix 密钥安全代理(已内置)

`api/[...path].js` 是一个 Vercel serverless 函数:浏览器只调用本站的 `/api/*`,函数在**服务端**加上 `Authorization: Bearer <MODELLIX_KEY>` 再转发给 Modellix。

- `MODELLIX_KEY` **不带 `VITE_` 前缀**,因此不会被打包进前端——密钥不会出现在前端代码或网络请求里,客户看不到、无法盗刷。
- 本地 `npm run dev` 时,由 Vite 的 dev 代理做同样的注入(从 `.env.local` 读 `MODELLIX_KEY`),所以本地也能正常生成海报。
- `VITE_ENGAGELAB_APPKEY` 是 WebPush 的公开 appkey,本来就该在前端,保留 `VITE_` 前缀即可。

## 加 / 改 demo(最常用)

所有内容数据都在 **`src/data/content.js`** 一个文件里,改这里即可,不用动布局和样式。

找到 `const DEMOS = [ ... ]`,每个 demo 一项:

```js
{
  cat: 'agent',                  // 分类: agent(GPTBots) / engage(EngageLab) / model(Modellix)
  icon: 'chat',                  // 图标名, 见同文件 ICONS(chat,chart,spark,globe,shield,mail,
                                 //   layers,bell,cpu,user,tag,search,support,window,sms,phone,lock)
  url: 'https://your-demo-link', // ← 加这一行, 卡片点击就打开你的真实 demo(新标签页); 不写则不跳转
  ja: { t: '日本語タイトル', d: '日本語の説明' },
  en: { t: 'English title', d: 'English description' },
  tags: ['GPTBots', 'タグ'],
}
```

- 首屏胶囊「N つのライブデモ」会按 demo 数量自动更新。
- 新增分类: 在 `CATS` 里加一项, demo 的 `cat` 指向它即可。
- 卡片图标颜色按分类自动取(见 `TINT`)。

## 部署到 GitHub + Vercel(自动部署)

### 1. 初始化并推到 GitHub
在项目根目录执行(首次):

```bash
git init
git add -A
git commit -m "Initial commit: Aurora Mobile demo showcase"
```

在 GitHub 新建一个**空**仓库(不要勾选 README),然后:

```bash
git remote add origin https://github.com/<你的账号>/aurora-demo.git
git branch -M main
git push -u origin main
```

### 2. 在 Vercel 导入
- 登录 vercel.com → Add New → Project → 选这个 GitHub 仓库。
- Vercel 自动识别 Vite,Framework 选 **Vite**,Build Command `npm run build`,Output `dist`(一般会自动填好)。
- **配置环境变量**(见上一节):`MODELLIX_KEY`、`VITE_ENGAGELAB_APPKEY`,然后点 Deploy。
- `api/[...path].js` serverless 函数会自动处理 `/api/*`(服务端注入 Modellix 密钥),无需额外设置。
- 之后每次 `git push` 到 `main`,Vercel 自动重新构建并上线。

### 3. 绑定域名 aurora-mobile.jp
- Vercel 项目 → Settings → Domains → 添加 `aurora-mobile.jp`。
- 回 **XServer 的 DNS 设置**,加 Vercel 给的 `A` 记录(通常 `76.76.21.21`,以面板显示为准)和 `www` 的 `CNAME`。
- ⚠️ **MX(邮箱)记录保持不变**——邮箱在 XServer 上,不要整体迁 nameserver。

## 访问控制(给销售用、不想公开)
已加 `noindex`。要加密码可用 Cloudflare Access(免费档,邮箱白名单),或在 app 里加一个共享密码登录页。

## 目录结构

```
aurora-demo/
├─ index.html              # 展示库入口
├─ tourism.html            # 观光 demo 入口(/tourism.html)
├─ vercel.json             # Vercel 配置
├─ vite.config.js          # 多页面 + dev 代理(dev 时注入密钥)
├─ api/
│  └─ [...path].js         # 🔒 serverless 代理(服务端注入 Modellix 密钥)
├─ .env.example            # 环境变量模板(复制成 .env.local)
├─ public/                 # EngageLab WebPush SDK + service worker
└─ src/
   ├─ main.jsx             # 展示库挂载入口
   ├─ App.jsx              # 展示库页面结构
   ├─ index.css            # 展示库样式
   ├─ data/
   │  └─ content.js        # ★ demo 数据 + 双语文案(改这里)
   └─ tourism/             # 观光 demo(独立样式, 互不冲突)
      ├─ main.jsx  App.jsx  styles.css  config.js
      ├─ components/        # Nav / Hero / Features / ChatSection / Footer
      └─ lib/               # engagelab.js(WebPush) / modellix.js(画像生成)
```
