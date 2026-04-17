import { defineConfig, loadEnv } from "vite"
import vue from "@vitejs/plugin-vue"
import tencentcloud from "tencentcloud-sdk-nodejs"

const { lke } = tencentcloud
const { Client } = lke.v20231130

const readJsonBody = req =>
  new Promise((resolve, reject) => {
    let raw = ""
    req.on("data", chunk => {
      raw += chunk
    })
    req.on("end", () => {
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch (err) {
        reject(err)
      }
    })
    req.on("error", reject)
  })

const credentialMiddlewarePlugin = env => ({
  name: "credential-middleware",
  configureServer(server) {
    server.middlewares.use("/lke-api-common", async (req, res) => {
      if (req.method !== "POST") {
        res.statusCode = 405
        res.setHeader("Content-Type", "application/json; charset=utf-8")
        res.end(JSON.stringify({ message: "Method Not Allowed" }))
        return
      }

      const secretId = process.env.TENCENT_SECRET_ID || env.TENCENT_SECRET_ID
      const secretKey = process.env.TENCENT_SECRET_KEY || env.TENCENT_SECRET_KEY
      const botBizId = process.env.TENCENT_BOT_BIZ_ID || env.TENCENT_BOT_BIZ_ID
      const region = process.env.TENCENT_REGION || env.TENCENT_REGION || "ap-guangzhou"

      if (!secretId || !secretKey || !botBizId) {
        res.statusCode = 500
        res.setHeader("Content-Type", "application/json; charset=utf-8")
        res.end(
          JSON.stringify({
            message:
              "缺少环境变量：TENCENT_SECRET_ID / TENCENT_SECRET_KEY / TENCENT_BOT_BIZ_ID。请在项目根目录创建 .env.local 后重启 npm run dev。"
          })
        )
        return
      }

      if (!/^\d{10,}$/.test(String(botBizId))) {
        res.statusCode = 500
        res.setHeader("Content-Type", "application/json; charset=utf-8")
        res.end(
          JSON.stringify({
            message:
              "TENCENT_BOT_BIZ_ID 格式不正确：应填写应用 ID（纯数字），不是 AppKey。请到腾讯云控制台复制应用 ID。"
          })
        )
        return
      }

      try {
        const body = await readJsonBody(req)
        const fileType = (body.fileType || "pdf").toLowerCase()
        const isPublic = Boolean(body.isPublic)
        const typeKey = body.typeKey || "realtime"

        const client = new Client({
          credential: {
            secretId,
            secretKey
          },
          region,
          profile: {
            httpProfile: {
              endpoint: "lke.tencentcloudapi.com"
            }
          }
        })

        const result = await client.DescribeStorageCredential({
          BotBizId: botBizId,
          FileType: fileType,
          IsPublic: isPublic,
          TypeKey: typeKey
        })

        const normalized = {
          Response: {
            TmpSecretId: result.Credentials?.TmpSecretId,
            TmpSecretKey: result.Credentials?.TmpSecretKey,
            Token: result.Credentials?.Token,
            ExpiredTime: result.ExpiredTime,
            Bucket: result.Bucket,
            Region: result.Region,
            UploadPath: result.UploadPath,
            Type: result.Type
          }
        }

        res.statusCode = 200
        res.setHeader("Content-Type", "application/json; charset=utf-8")
        res.end(JSON.stringify(normalized))
      } catch (error) {
        res.statusCode = 500
        res.setHeader("Content-Type", "application/json; charset=utf-8")
        res.end(
          JSON.stringify({
            message: error?.message || "DescribeStorageCredential 调用失败"
          })
        )
      }
    })
  }
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")

  return {
    plugins: [vue(), credentialMiddlewarePlugin(env)],
    server: {
      proxy: {
        // 1. 对话接口代理（adp/v2/chat 需走 wss.lke.cloud.tencent.com）
        "/lke-api": {
          target: "https://wss.lke.cloud.tencent.com",
          changeOrigin: true,
          rewrite: path => path.replace(/^\/lke-api/, "")
        },

        // 2. 实时文档解析接口代理（注意：只有这里才需要 wss. ！！！）
        "/lke-doc": {
          target: "https://wss.lke.cloud.tencent.com",
          changeOrigin: true,
          rewrite: path => path.replace(/^\/lke-doc/, "")
        },

        // 3. 原本的上传接口代理
        "/lke-upload": {
          target: "https://lke.cloud.tencent.com",
          changeOrigin: true,
          rewrite: path => path.replace(/^\/lke-upload/, ""),
          timeout: 300000
        }
      }
    }
  }
})
