# 巅峰球星卡 · Web 版

这是可直接部署到任意静态托管的版本（GitHub Pages / Netlify / Vercel）。

- 入口：`index.html`
- 离线：`sw.js`（Service Worker，需 HTTPS 或 localhost 才能注册）
- 主屏幕图标：`icons/`（已在 index.html 里内联声明）

## 部署

**Netlify Drop**：把整个 dist 文件夹拖到 https://app.netlify.com/drop

**GitHub Pages**：推到仓库 → Settings → Pages → 选 main 分支根目录

部署后手机 Safari 打开 → 分享 → 添加到主屏幕。
