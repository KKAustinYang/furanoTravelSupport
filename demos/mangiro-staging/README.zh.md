# 虚拟样板间（バーチャルステージング）Demo — 中文说明

面向不动产平台 **MANGIRO**（运营方：KINAKO）的提案用 Demo。
把空房的房源照片交给 AI 摆上家具，客户在会议室里可以自己动手点、拖动 Before/After 对比。

- 页面：`demos/mangiro-staging/index.html`（单文件静态页，无需构建）
- 线上路径：`/d/mangiro-staging/index.html`
- 两条路径：**3 个样板房源用事先生成的图**（离线可跑）；**上传的照片实时判定 + 实时生成**

---

## 1. 两条路径，不要混起来

| | 样板房源 3 套 | 上传的照片 |
|---|---|---|
| 图片 | **事先生成**，已提交进仓库 | **当场生成** |
| 房间类型 | `manifest.json` 里手写 | **LLM 看图判定** |
| 网络 | 首屏之后一次请求都没有 | 走 `/api` 代理调 Modellix |
| 用途 | 谈判现场的主线，绝不能出事 | 展示「用你自己的照片也能跑」 |

规格书原本要求「纯前端、运行时不生成」，理由是**目的不是技术验证而是让提案通过**，
会议室里卡住提案就死了。后来客户改了规则，允许上传 + 实时生成，于是做成两条路径：

> 演示时**一定先走样板房源**。网络不稳的会场里，能保证 ②〜⑦ 全程走完的只有这一条。
> 上传是网络正常时的加分项。

仍然不能做的事：

- 把样板房源换成实时生成
- 把**服务端的** `MODELLIX_KEY` 交给浏览器（必须走同源 `/api` 代理，密钥只在服务端）。
  客户自己的 key 是另一回事，见下面「客户自带 key」一节
- 直接 `fetch` Modellix 返回的绝对 URL（CORS 会挂，必须 `toProxyPath()` 转成同源路径）
- 对会扣费的 POST 无脑重试（会重复计费）
- **分享按钮** —— 生成图一旦作为广告扩散，就会落入日本不动产表示规约的适用范围，
  所以功能定位是「会员本人查看用」。※ **保存（下载）后来按客户要求加上了**：
  存下来的图带着水印，不做扩散导线这条原则没变

## 2. 与规格书的差异（按仓库既有约定走）

规格书要求 Next.js(App Router) + TypeScript + Tailwind，路径 `/d/staging/`。
但本仓库 `demos/` 的约定是「**一个 slug 一个自包含静态页**」，
`build-demos.mjs` 会把 `demos/<slug>/` 原样拷到 `public/d/<slug>/`。
规格书 §9 自己写了「与既有约定冲突时以既有约定为准」，所以：

| 规格书 | 实际实现 | 原因 |
|---|---|---|
| Next.js + TS + Tailwind | 单文件 HTML + CSS 变量 + 原生 JS | 与 QNAP / property-video / tryon-aurora 同一粒度 |
| `/d/staging/` | `/d/mangiro-staging/` | `demos/<slug>` 就是公开路径，slug 里保留客户名 |
| `public/staging/manifest.json` | `demos/mangiro-staging/staging/manifest.json` | 路径必须是**相对路径**，不能以 `/` 开头（页面挂在 `/d/` 下） |

画面流程、日文文案、配色、日文排版规则、验收标准，都严格按规格书执行。
**界面上的日文原样使用规格书里的字符串，不要改写。**

## 3. 图片是怎么来的（这是这次的重点）

不是占位图，是真的调 Modellix 生成的。两步：

```
① 空房照片   google/nano-banana-pro        (文生图)  → staging/<prop>/<img>/original.jpg
② 摆家具     google/nano-banana-pro-edit   (图生图)  → staging/<prop>/<img>/<style>-<n>.jpg
```

真实项目里第 ① 步不存在——那里放的是客户自己拍的空房照片。这次没有素材，所以先用文生图
造出「日本公寓空房」这种非常典型的房源照片，再拿它当 ② 的输入。

一次跑完：空房 12 张 + 摆家具 45 张（5 个房间 × 3 种风格 × 3 个方案）＝ 57 张，
2K 出图后缩到长边 1600px 的 JPEG 再提交（整个 demo 目录 14MB）。
单张约 **$0.12**，全套约 **$6.9**。

以前偶尔会撞上 Google 的安全过滤（`Requests to remove watermarks violate...`）——它把 prompt 里
「**加**水印」的指令误判成「去水印」。**把烧字挪到服务端、prompt 里不再提水印之后就没有了**。
实时生成那条路径仍保留失败重试一次作为保险。

### 跑脚本

```bash
node demos/mangiro-staging/tools/generate.mjs           # 只补缺的（幂等）
node demos/mangiro-staging/tools/generate.mjs --dry     # 只打印 prompt，不花钱
node demos/mangiro-staging/tools/generate.mjs --only prop-02
```

- 已存在的文件会跳过。要重做就**先删掉再跑**
- `MODELLIX_KEY` 自动从仓库根的 `.env.local` 读
- 依赖 `sharp` 做缩放和合成，不挑操作系统
- `manifest.json` 由脚本里的 `PROPERTIES` 定义自动生成，**不要手写**

### 一个容易踩的坑：图生图的输入不要用返回的 URL

Modellix 返回的结果 URL 大约 **7 天过期**。如果 ② 直接吃 ① 返回的 URL，
过几天想单独重做某一张就没法复现了。所以脚本一律把本地的 `original.jpg`
转成 Base64 Data URL 传进去（已验证 `nano-banana-pro-edit` 接受 Data URL）。

## 4. Prompt 设计（唯一定义在 `staging/prompts.json`）

图生图的 prompt 固定由 4 段拼成，顺序不能变：

```
RULES  →  STYLE  →  LAYOUT  →  QUALITY
```

**RULES（结构保持）是整段 prompt 的本体，也是合规要求，不能删、不能压缩。**
它锁死：相机位置/焦段/构图、墙、天花板、地板材质和木纹方向、窗和阳台外的景色、
门、踢脚线、插座、空调、以及日光的方向和色温。只允许「往现有地板上放家具、
往现有墙上挂画」，并且要求投出与原光照一致的接触阴影。

理由不是画面好看，是**法律**：房源图里出现不存在的户型，在日本可能构成
宅建业法上的夸大广告。所以这段按合规要求对待，而不是当成调参空间。

**里面的「PIXEL-ALIGNED」那一段尤其不能删。** 只说「不要改结构」的时候，模型会
把房间的造型保住，却**把相机拉远／转个角度**（实测 3 张里有 2 张这样）。必须把
「叠上去要能重合」「消失点不许动」「不许裁剪、缩放、旋转、纠正水平」全部写出来，
视角才真正被锁住。要精简 prompt 的话，先动别的段落。

其余四段：

- **STYLE**：和风摩登 / 自然北欧 / 酒店风，各自的材质、色板、灯光气质
- **LAYOUT**：「一次请求出 3 个方案」的实体差异。同一种风格下家具构成本身就不同
  （会客为主 / 餐桌为主 / 休闲椅阅读角），并且按房间类型（客厅 / 卧室）分成两套
- **QUALITY**：全画幅 + 17mm 移轴、垂直线笔直、材质细节、留白，杂志级布景
- **水印和法定标注不写进 prompt**。让模型画会出两种事故：字形偶尔崩、以及 Google 的
  安全过滤把它当成「去水印请求」直接驳回整次生成。改成生成之后用 sharp 合成（见下节）

风格的 `key` 和 `label` 必须和 `index.html` 里的 `STYLES` 保持一致。

## 4-2. 水印改成服务端合成（sharp）

法定标注和 logo 在**生成之后**用 sharp 合成（`api/_stamp.js`）。三个要点：

**① 两层分开，不能混。**

| 层 | 内容 | 能否替换 |
|---|---|---|
| ① 法定表記バー | `※AIによるバーチャルステージング画像です` / `実際の物件に家具・調度品は含まれません` | **不可**（必须） |
| ② ブランドロゴ | MANGIRO logo | 可（`STAGING_LOGO_DATA_URL` 覆盖，不用重新部署） |

混成一层的话，客户想换 logo 就会连合规标注一起去掉。合成必须是 `composite([notice, logo])` 两个 layer。

**② 字号按图宽百分比算，别写死 px。**

条高 `0.10w`、字号 `0.022w`、logo 宽 `0.17w`。不同分辨率下观感一致；写死 px 的话 4K 上会小到
看不见，达不到「消費者が容易に認識できる」。

**③ 原图不外流。**

浏览器拿到的 URL 永远是合成后的，没有返回原图的接口：

```
/api/stamped/aigc/image/xxx.png
  → 取 https://file.modellix.ai/aigc/image/xxx.png → sharp 合成 → 返回 JPEG
```

host 写死、只允许 GET、不带认证头，路径只允许 `[A-Za-z0-9._-/]` 且拒绝 `..`。dev 环境也调
同一个函数（`vite.config.js` 的 `local-node-endpoints`）。样板房源在生成时就已经烧好了，
走不到这条路径。

### 烧进图里的条 ≠ 页面上的说明

对比滑块会**按位置遮住**烧进去的文字（文案左对齐，滑块在中间时一个字都看不到）。
烧录是给「导出的文件」用的开示，所以页面上另外常驻一行 `.viewer-note`。
两者不要合并成一处。

### 文字不在运行时绘制

`api/_stamp-assets.js` 里存的是**已经烧成 PNG** 的两层（base64），运行时只按宽度缩放。
因为 Vercel 的运行环境没有日文字体，运行时画 SVG 文本会变成豆腐块（□□□）。

改文案或换 logo 之后，在有字体的机器上重新生成：

```bash
node demos/mangiro-staging/tools/make-overlays.mjs   # 重写 api/_stamp-assets.js
```

## 4-3. 换品牌时怎么重新烧字

改了品牌名或 logo，**不要重新生成，贴回去就行**：

```bash
node demos/mangiro-staging/tools/make-overlays.mjs   # ① 重做两层 overlay
node demos/mangiro-staging/tools/restamp.mjs         # ② 给已有的 45 张重贴（零费用）
```

重新生成 45 张要 $5.5，重贴几秒钟、不花钱。

**法定标注条做成不透明就是为了这个。** 半透明的话，旧标注的字会从底下透出来。
条的位置和高度是按图宽比例算的，所以贴回同一张图必然覆盖同一块区域。
以后想把它调回半透明，要知道这等于放弃了重贴的能力。

`original.jpg`（空房照片＝相当于客户原片）不在重贴范围内。

## 4-4. 客户自带 key

页面右上「APIキー」可以让客户填自己的 Modellix key：

```
浏览器  →  /api/llm/... , /api/v1/...      →  api/proxy.js  →  Modellix
           X-Modellix-Key: <客户的 key>        原样中继，不保存不记录
```

规矩（和 `demos/property-video/CLAUDE.md` 一致）：

- **key 必须走 header，绝不能进 query string**（URL 会留在访问日志、浏览器历史、Referer 里）
- 只存 `localStorage`，不上传服务端、不写日志
- 界面上一律打码显示（`mdlx-…cdef`）
- 401/403 不重试，提示重新输入（这类错误在扣费之前就被挡住）
- 格式校验和代理端一致（可打印 ASCII、16–200 字符）

**不填也能用**——回退到服务端的 `MODELLIX_KEY`（我们出钱的 demo key）。样板房源是
事先生成的，本来就不调 API。填了之后，生成费用记在客户自己账上。

## 5. 页面结构（`index.html`）

单文件，无依赖。核心几个函数：

| 函数 | 作用 |
|---|---|
| `show(view)` | 面板切换。`props / rooms / styles / gen / patterns / result`，单页推进不跳转 |
| `renderSteps()` / `renderSummary()` | 顶部步骤条 + 已选（房源/房间/风格）胶囊，每个都能「変更」回退 |
| `styleExample(key)` | 风格卡缩略图。**故意不用当前选中的房间**，避免提前剧透结果；优先取同类型房间的别的房源 |
| `runGeneration(isRegen)` | 约 2.5 秒的演出，3 段文案每 0.8 秒切换；**图片全部加载完才出结果** |
| `setSplit(v)` | Before/After 分割，只用 `clip-path: inset()`，不引入任何库 |
| `stampedUrl(u)` | 生成结果一律换成 `/api/stamped/*` 再拿去显示——浏览器永远看不到未合成的原图 |
| `saveUrl(u)` | 保存当前这张。到这一步两条路径都已经是同源 URL；失败就退回新标签页打开 |
| `pushHistory()` / `openRecord(r)` | 生成历史。一次生成 = 一条记录（含 3 个方案），点开回到当时的对比画面。**不做持久化**——上传照片的 Data URL 塞进 localStorage 容易在谈判中途爆配额 |
| `switchVariant(i)` | 结果页直接换方案。**保持对比线位置**只换 After 那张——滑块跳回去的话，用户就不知道刚才在比什么了 |

几个刻意的做法：

- **Before/After 的拖动**用一个透明的 `<input type="range">` 盖在图上。
  鼠标、触摸、键盘一次全解决，而且不会有自己写指针事件时的各种边界 bug。
- **生成动画是必要的**。立刻出图会让人觉得「就是事先准备好的图」，
  把处理步骤用文字讲出来，等待时间本身就变成了对流程的说明。
- **对比视图会限制高度**（`max-width` 按视口高度反算），
  保证笔记本上「图 + 焼き込み注记」一屏装得下，演示时不用滚动。
- `再生成する` 是 Demo 用的假动作：同样的 3 张换个顺序重新展示，不做真生成。

### 「対象外」的房间为什么要显示

浴室、外观、洗面台是**故意灰掉留在列表里的**，不能隐藏。
让客户看到「AI 判断出了哪些照片不该处理」，这个呈现方式本身就是提案材料。
`rejectReason` 悬停/点触时原样显示。

## 6. 怎么加房源 / 房间

1. 在 `tools/generate.mjs` 的 `PROPERTIES` 里加条目
2. 在 `tools/prompts.mjs` 的 `BASE_PROMPTS` 里补同名 key（`prop-0X/img-0Y`）的空房 prompt
3. 跑脚本；`manifest.json` 会自动重写

真实项目里 `original` 换成客户的实拍照片，第 ① 步的文生图就不需要了。

## 7. LLM 用在哪（已实现）

上传的每张照片调一次 `google/gemini-3.6-flash`（走 `/api/llm/v1/chat/completions`），
让它在 `living / bedroom / kitchen / bathroom / entrance / exterior / other` 里选一个，
同时判断 `furnished`（是否已经有大件家具）。规则：

```
stageable = (living 或 bedroom) 且 furnished === false
```

不满足时给出对应的 `rejectReason`：外观 → 「屋外の写真は対象外です」，
已有家具 → 「家具のあるお部屋は対象外です」，其余 → 「対象外の部屋タイプです」。

实测三张图分别判成 リビング・ダイニング（可生成）／キッチン（対象外）／
洋室・已有家具（対象外），与预期一致。判定失败时不让 demo 崩，直接落到「対象外」
并把错误写进 tooltip。

## 8. 仓库改动清单

- 新增 `demos/mangiro-staging/`（页面 + 47 张图 + 生成脚本 + 文档）
- `src/data/content.js`：展示台新增一张卡片
- `api/proxy.js` + `api/_stamp.js` + `api/_stamp-assets.js` + `vite.config.js`：新增 `/api/stamped/*`（服务端合成法定标注与 logo）
- `package.json`：新增依赖 `sharp`
- `build-demos.mjs`：静态 demo 拷贝时同时排除 `tools/`，
  这样生成脚本不会被发布到 `/d/` 下（原本只排除 `node_modules` 和 `*.md`）

## 9. 验收自查（规格书 §7）

- [x] 只替换 `manifest.json` 就能增减房源和图片
- [x] 断网也能走完 ②〜⑦
- [x] 不产生任何外部网络请求（用 Chrome 实测，非同源请求 0 条）
- [x] `stageable:false` 灰掉且不可点，`rejectReason` 悬停显示
- [x] 生成中 3 段文案依次切换
- [x] 3 个方案并排显示、可点选
- [x] Before/After 鼠标和触摸都能拖
- [x] 注记常驻在生成图上（合规要求，不可删改）
- [x] 1280px / 375px 均不破版（1440 与 375 实测截图确认）
