// EngageLab WebPush SDK 集成(官方 MTpushInterfaceReady 模式)。
//
// 需要把官方原始文件放到 public/ 根目录:
//   public/webSdk.produce.min.3.3.6.js
//   public/sw.produce.min.3.3.6.js   ← Service Worker,必须在当前域名根路径下
//
// appkey 从环境变量 VITE_ENGAGELAB_APPKEY 读取(Vercel 环境变量里配置)。

const SDK_URL = '/webSdk.produce.min.3.3.6.js';
const SW_URL = '/sw.produce.min.3.3.6.js';

// EngageLab 控制台发的 WebPush appkey
const APPKEY = import.meta.env.VITE_ENGAGELAB_APPKEY;

// user_str:端末ごとに一意な識別子。登录后可换成用户自己的唯一 ID。
function randomUid() {
  const KEY = 'mtWebPushRandomUid';
  let uid = window.localStorage.getItem(KEY);
  if (!uid) {
    uid =
      new Date().getTime().toString(36) +
      Math.floor(Math.random() * 1e7).toString(36);
    window.localStorage.setItem(KEY, uid);
  }
  return uid;
}

let started = false;

export function initEngageLabPush() {
  if (started) return;

  // WebPush 前提:HTTPS + Service Worker / Notification API
  if (
    !('serviceWorker' in navigator) ||
    !('Notification' in window) ||
    !('PushManager' in window)
  ) {
    console.warn('[EngageLab] 当前环境不支持 WebPush,跳过');
    return;
  }
  if (!APPKEY) {
    console.warn('[EngageLab] 未配置 VITE_ENGAGELAB_APPKEY,跳过');
    return;
  }
  started = true;

  // ① 必须在脚本加载前定义 ready 回调,SDK 就绪后会自动调用
  window.MTpushInterfaceReady = () => {
    // 初始化前先注册监听
    // 极光通道断开
    MTpushInterface.mtPush.onDisconnect(() => {
      console.log('[EngageLab] onDisconnect');
    });
    // 收到推送消息(type:0=极光通道, 1=系统通道)
    MTpushInterface.onMsgReceive((msgData) => {
      console.log('[EngageLab] 收到推送:', msgData);
    });

    // 推送初始化
    MTpushInterface.init({
      appkey: APPKEY,
      user_str: randomUid(),
      is_temporary: 'n', // 'n'=持久订阅 / 't'=临时(不订阅)
      swUrl: SW_URL,
      debugMode: import.meta.env.DEV,
      success(data) {
        console.log('[EngageLab] 在线推送创建成功', data);
      },
      fail(err) {
        console.warn('[EngageLab] 在线推送创建失败', err);
      },
      webPushcallback(code, tip) {
        console.log('[EngageLab] 状态码/提示', code, tip);
      },
      canGetInfo(data) {
        // 此回调后可拿到 RegId
        console.log('[EngageLab] 配置信息', data);
        console.log('[EngageLab] RegId =', MTpushInterface.getRegistrationID());
      },
    });
  };

  // ② 注入官方 SDK 脚本
  const s = document.createElement('script');
  s.src = SDK_URL;
  s.async = true;
  s.onerror = () => console.warn(`[EngageLab] 加载失败: ${SDK_URL}`);
  const first = document.getElementsByTagName('script')[0];
  if (first && first.parentNode) {
    first.parentNode.insertBefore(s, first);
  } else {
    document.head.appendChild(s);
  }
}
