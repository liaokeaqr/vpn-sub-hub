
# VPN 订阅中心 (AI 聚合版)

这是一个利用 Gemini 3 Pro 智能搜索并自动验证 VPN 订阅链接的项目。

## 🚀 部署状态
- **自动同步**: 每日 00:00 (CST)
- **部署平台**: GitHub Pages
- **技术栈**: React 19 + Vite + Gemini API

## 🛠️ 维护指南
1. **更新密钥**: 如果搜索失效，请检查 GitHub Secrets 中的 `API_KEY` 是否过期。
2. **手动同步**: 在 GitHub Actions 页面点击 `Run workflow` 即可立即触发全网搜索。
3. **本地调试**: `npm run dev` (需在本地配置 `.env` 文件)。

## ⚖️ 免责声明
本工具仅用于网络技术研究。请遵守当地法律法规。
