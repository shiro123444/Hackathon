# Hackathon Site

黑客松。  


## 启动

```bash
npm install
npm run dev
```

默认地址：

```text
http://127.0.0.1:4175/
```

## 部署

生产构建：

```bash
npm run build
```

生产启动：

```bash
npm run start
```

需要先配置邮件环境变量：

 `SMTP_HOST`
 `SMTP_PORT`
 `SMTP_SECURE`
 `SMTP_USER`
 `SMTP_PASS`
 `APPLY_TO_EMAIL`

也可以直接在项目根目录放 `.env` 或 `.env.local`，`server.mjs` 会自动读取。


## 架构

 `src/App.jsx`
  场景叙事主控，滚轮推进章节进度。
 `src/components/HeroCanvas.jsx`
  Three.js / R3F 场景，相机路径、光束、空间结构、3D 标题。
 `src/components/StoryChapterOverlay.jsx`
  章节说明层，只保留辅助文案和动作区。
 `src/components/ApplyForm.jsx`
  报名表单，提交到 `/api/apply`。
 `server.mjs`
  Node 服务，开发时托管 Vite，中转报名邮件。

