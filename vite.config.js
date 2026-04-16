import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
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

      // 3. 获取 COS 临时凭证接口代理（解决获取凭证 404 的关键）
      "/lke-api-common": {
        target: "https://lke.cloud.tencent.com",
        changeOrigin: true,
        // 如果您的真实凭证接口路径不同，请修改后面的部分
        rewrite: path => path.replace(/^\/lke-api-common/, "/v1/qbot/storage/credential")
      },

      // 4. 原本的上传接口代理
      "/lke-upload": {
        target: "https://lke.cloud.tencent.com",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/lke-upload/, ""),
        timeout: 300000
      }
    }
  }
})
