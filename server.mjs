import express from "express";
import nodemailer from "nodemailer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 4175);
const loadedEnvKeys = new Set();

const app = express();
app.use(express.json({ limit: "1mb" }));

async function loadEnvFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");

    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();

      if (!line || line.startsWith("#")) continue;

      const equalsIndex = line.indexOf("=");
      if (equalsIndex < 0) continue;

      const key = line.slice(0, equalsIndex).trim();
      if (!key) continue;

      let value = line.slice(equalsIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (process.env[key] !== undefined && !loadedEnvKeys.has(key)) continue;

      process.env[key] = value;
      loadedEnvKeys.add(key);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await loadEnvFile(path.join(__dirname, ".env"));
await loadEnvFile(path.join(__dirname, ".env.local"));
await loadEnvFile(path.join(__dirname, `.env.${process.env.NODE_ENV || "development"}`));
await loadEnvFile(path.join(__dirname, `.env.${process.env.NODE_ENV || "development"}.local`));

function env(name, fallback) {
  const value = process.env[name];
  if (value && value.length) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing environment variable: ${name}`);
}

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env("SMTP_HOST"),
    port: Number(env("SMTP_PORT", "587")),
    secure: env("SMTP_SECURE", "false") === "true",
    auth: {
      user: env("SMTP_USER"),
      pass: env("SMTP_PASS")
    }
  });

  return transporter;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

app.post("/api/apply", async (req, res) => {
  const payload = {
    name: String(req.body?.name || "").trim(),
    email: String(req.body?.email || "").trim(),
    teamName: String(req.body?.teamName || "").trim(),
    role: String(req.body?.role || "").trim(),
    projectIdea: String(req.body?.projectIdea || "").trim()
  };

  if (!payload.name || !payload.email || !payload.projectIdea) {
    return res.status(400).json({ ok: false, message: "请至少填写姓名、邮箱和想法简介。" });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return res.status(400).json({ ok: false, message: "邮箱格式不正确。" });
  }

  try {
    const transport = getTransporter();
    const to = env("APPLY_TO_EMAIL");
    const from = env("APPLY_FROM_EMAIL", env("SMTP_USER"));

    await transport.sendMail({
      from,
      to,
      replyTo: payload.email,
      subject: `Hackathon 报名 - ${payload.name}${payload.teamName ? ` / ${payload.teamName}` : ""}`,
      text: [
        `姓名: ${payload.name}`,
        `邮箱: ${payload.email}`,
        `团队/项目名: ${payload.teamName || "未填写"}`,
        `角色: ${payload.role || "未填写"}`,
        "",
        "想法简介:",
        payload.projectIdea
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #111;">
          <h2>Hackathon 报名</h2>
          <p><strong>姓名:</strong> ${escapeHtml(payload.name)}</p>
          <p><strong>邮箱:</strong> ${escapeHtml(payload.email)}</p>
          <p><strong>团队/项目名:</strong> ${escapeHtml(payload.teamName || "未填写")}</p>
          <p><strong>角色:</strong> ${escapeHtml(payload.role || "未填写")}</p>
          <p><strong>想法简介:</strong></p>
          <div style="white-space: pre-wrap; padding: 12px; background: #f5f5f5; border: 1px solid #ddd;">
            ${escapeHtml(payload.projectIdea)}
          </div>
        </div>
      `
    });

    if (env("APPLY_SEND_CONFIRMATION", "true") !== "false") {
      await transport.sendMail({
        from,
        to: payload.email,
        subject: "我们已收到你的黑客松报名",
        text: [
          `${payload.name}，你好：`,
          "",
          "我们已经收到你的报名信息。",
          "如果进入下一轮，我们会再通过这封邮箱联系你。",
          "",
          "感谢你的参与。"
        ].join("\n")
      });
    }

    return res.json({ ok: true, message: "报名信息已发送，我们会尽快查看。" });
  } catch (error) {
    console.error("apply mail failed", error);
    return res.status(500).json({ ok: false, message: "邮件发送失败，请检查 SMTP 配置。" });
  }
});

if (isProduction) {
  const distDir = path.join(__dirname, "dist");
  app.use(express.static(distDir));
  app.use(async (_req, res) => {
    const html = await fs.readFile(path.join(distDir, "index.html"), "utf8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(html);
  });
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "custom"
  });
  app.use(vite.middlewares);

  app.use(async (req, res, next) => {
    try {
      const url = req.originalUrl;
      const template = await fs.readFile(path.join(__dirname, "index.html"), "utf8");
      const html = await vite.transformIndexHtml(url, template);
      res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(html);
    } catch (error) {
      vite.ssrFixStacktrace(error);
      next(error);
    }
  });
}

app.listen(port, () => {
  console.log(`Hackathon site server ready on http://127.0.0.1:${port}`);
});
