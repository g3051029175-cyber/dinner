/* 美乐蒂晚餐抽奖 - Service Worker
   策略：预缓存全部资源；后续请求走"缓存优先"（离线可用），
   后台顺带更新缓存（stale-while-revalidate）。 */

const CACHE = 'dinner-melody-v2-20261014';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png'
];

// 安装：预缓存（单个失败不影响整体）
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.all(
        ASSETS.map(url => cache.add(url).catch(err => console.log('precache skip:', url, err)))
      )
    ).then(() => self.skipWaiting())
  );
});

// 激活：清理旧版本缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 取用：缓存优先 + 后台更新
self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.method !== 'GET') return;

  // 只处理同源请求
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  // 页面导航请求：离线时回退到缓存的 index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
