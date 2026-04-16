<template>
  <div class="app-wrapper">
    <header class="glass-header">
      <div class="header-left">
        <el-button :icon="Menu" circle @click="drawerVisible = true" />
        <div class="logo">
          <span class="title">AcademicFlow <small>跨领域科研学术辅助</small></span>
        </div>
      </div>
      <div class="user-status">
        <el-tag size="small" effect="plain" type="info">科研知识库已就绪</el-tag>
        <el-divider direction="vertical" />
        <span class="user-name">Xiao Chen</span>
        <el-avatar :size="32" src="https://api.dicebear.com/7.x/avataaars/svg?seed=XiaoChen" />
      </div>
    </header>

    <el-drawer v-model="drawerVisible" title="科研任务管理" direction="ltr" size="280px">
      <div class="drawer-content">
        <el-button type="primary" class="new-btn" :icon="Plus" plain>新建科研任务</el-button>
        <div class="section-label">最近检索/审查</div>
        <el-scrollbar height="calc(100vh - 200px)">
          <div v-for="i in 5" :key="i" class="nav-item">
            <el-icon><Search v-if="i % 2 == 0" /><CircleCheck v-else /></el-icon>
            <span class="nav-title">{{ i % 2 == 0 ? "多路文献检索: LLM Agent" : "论文逻辑审查方案" }}</span>
          </div>
        </el-scrollbar>
      </div>
    </el-drawer>

    <el-container class="main-layout">
      <el-main class="chat-main">
        <div class="chat-viewport">
          <el-scrollbar ref="scrollbarRef">
            <div class="message-wrapper">
              <div v-if="messages.length <= 1" class="welcome-section">
                <el-icon :size="48" color="#d1d5db"><Compass /></el-icon>
                <h2>开启您的科研协作</h2>
                <p>支持多路文献检索、逻辑一致性审查及图表数据提取</p>
                <div class="guide-grid">
                  <div class="guide-card" @click="quickCommand('帮我检索关于‘具身智能’的最新跨学科论文')">
                    <el-icon><Search /></el-icon> 检索前沿文献
                  </div>
                  <div class="guide-card" @click="quickCommand('请审查以下段落的逻辑严密性：')">
                    <el-icon><CircleCheck /></el-icon> 逻辑审查
                  </div>
                </div>
              </div>

              <div v-for="(msg, index) in messages" :key="index" :class="['message-row', msg.role]">
                <div class="avatar-area">
                  <el-avatar
                    :size="36"
                    :src="
                      msg.role === 'assistant'
                        ? 'https://api.dicebear.com/7.x/bottts/svg?seed=Science'
                        : 'https://api.dicebear.com/7.x/avataaars/svg?seed=XiaoChen'
                    "
                  />
                </div>
                <div class="message-content">
                  <div class="sender-info">
                    <span class="name">{{ msg.role === "assistant" ? "科研助手 AI" : "Xiao Chen" }}</span>
                  </div>
                  <div class="bubble">
                    <div v-if="msg.loading" class="typing-loader"><span></span><span></span><span></span></div>
                    <div v-else class="text-inner" v-html="msg.content"></div>
                    <div v-if="msg.fileName" class="file-attachment">
                      <el-icon><Document /></el-icon> {{ msg.fileName }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </el-scrollbar>
        </div>

        <div class="input-wrapper">
          <div class="input-card">
            <div class="action-bar">
              <div class="tags">
                <el-button size="small" bg text round :icon="Search" @click="quickCommand('进行多路文献检索：')"
                  >文献搜索</el-button
                >
                <el-button
                  size="small"
                  bg
                  text
                  round
                  :icon="CircleCheck"
                  @click="quickCommand('对以下内容进行逻辑审查：')"
                  >逻辑审查</el-button
                >
                <el-button size="small" bg text round :icon="DataLine" @click="quickCommand('从图中提取实验数据：')"
                  >图表提取</el-button
                >
              </div>
              <div class="upload-area">
                <el-tag
                  v-if="currentFile"
                  closable
                  @close="currentFile = null"
                  size="small"
                  type="success"
                  class="file-tag"
                >
                  {{ currentFile.name }}
                </el-tag>
                <el-upload action="#" :auto-upload="false" :show-file-list="false" :on-change="handleFileChange">
                  <el-button
                    size="small"
                    circle
                    :icon="Paperclip"
                    :type="currentFile ? 'primary' : 'default'"
                    title="上传待审查文档"
                  />
                </el-upload>
              </div>
            </div>

            <el-input
              v-model="userInput"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 8 }"
              placeholder="请输入科研指令，或粘贴论文段落..."
              resize="none"
              @keydown.enter.prevent="handleEnter"
            />

            <div class="bottom-bar">
              <span class="hint">按 Enter 发送指令 · 跨领域科研知识库已连接</span>
              <el-button
                type="primary"
                :icon="Promotion"
                :disabled="!userInput.trim() && !currentFile"
                circle
                @click="sendMessage"
              />
            </div>
          </div>
          <p class="footer-notice">AI 生成内容仅供参考，请结合实验原始数据进行科研判断</p>
        </div>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick } from "vue"
import {
  Menu,
  Plus,
  Search,
  CircleCheck,
  DataLine,
  Memo,
  Promotion,
  Paperclip,
  Compass,
  Document
} from "@element-plus/icons-vue"
import { ElMessage } from "element-plus"
import axios from "axios"
import { v4 as uuidv4 } from "uuid"
import COS from "cos-js-sdk-v5"

// 【修改点 1】：正确导入 CREDENTIALS 对象
import { CREDENTIALS } from "./config/secrets.js"

const formatContent = rawText => {
  if (!rawText) return ""
  let text = rawText
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang || "text"
    const escapedCode = code.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    return `<pre class="code-block"><code class="language-${language}">${escapedCode}</code></pre>`
  })
  text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
  text = text.replace(/^### (.+)$/gm, '<h4 class="md-heading">$1</h4>')
  text = text.replace(/^## (.+)$/gm, '<h3 class="md-heading">$1</h3>')
  text = text.replace(/^# (.+)$/gm, '<h2 class="md-heading">$1</h2>')
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>")
  text = text.replace(/_([^_]+)_/g, "<em>$1</em>")
  text = text.replace(/^- (.+)$/gm, '<li class="md-list">$1</li>')
  text = text.replace(/^\* (.+)$/gm, '<li class="md-list">$1</li>')
  text = text.replace(/^\d+\.\s(.+)$/gm, '<li class="md-list">$1</li>')
  text = text.replace(/(<li class="md-list">.*<\/li>\n?)+/g, match => {
    return `<ul class="md-ul">${match}</ul>`
  })
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="md-link">$1</a>')
  text = text.replace(/\n\n+/g, '</p><p class="md-paragraph">')
  text = text.replace(/\n/g, "<br>")
  if (!text.startsWith("<")) {
    text = `<p class="md-paragraph">${text}</p>`
  }
  return text
}

const drawerVisible = ref(false)
const userInput = ref("")
const scrollbarRef = ref(null)
const currentFile = ref(null)

const currentSessionId = ref(uuidv4())

const messages = reactive([
  {
    role: "assistant",
    // 【修改点 2】：使用配置文件中的 USER_NAME
    content: `您好，<b>${CREDENTIALS.USER_NAME}</b>。我是您的科研辅助智能体。您可以直接提问，或点击左下角回形针上传论文进行审查。`,
    loading: false
  }
])

const handleFileChange = file => {
  currentFile.value = file.raw
  ElMessage.success(`已载入文件: ${file.name}，点击发送按钮开始审查`)
}

const fetchStorageCredential = async () => {
  try {
    // 【修改点 3】：使用配置文件中的 CREDENTIAL_API
    // 注意：这里需要确保您的 vite.config.js 中代理了 /lke-api-common 并且对应后端的真实 STS 接口
    const { data } = await axios.post(CREDENTIALS.CREDENTIAL_API, {
      AppKey: CREDENTIALS.APP_KEY
    })
    return data.Response
  } catch (error) {
    console.error("获取 COS 临时凭证失败:", error)
    throw new Error("无法获取上传凭证，请检查代理配置和密钥接口")
  }
}

const uploadAndParseDocument = async file => {
  try {
    const stsData = await fetchStorageCredential()
    const cos = new COS({
      getAuthorization: (options, callback) => {
        callback({
          TmpSecretId: stsData.TmpSecretId,
          TmpSecretKey: stsData.TmpSecretKey,
          SecurityToken: stsData.Token,
          ExpiredTime: stsData.ExpiredTime
        })
      }
    })

    return new Promise((resolve, reject) => {
      const fileType = file.name.split(".").pop()
      const fileNameNoExt = file.name.replace(/\.[^/.]+$/, "")

      cos.putObject(
        {
          Bucket: stsData.Bucket,
          Region: stsData.Region || CREDENTIALS.REGION, // 使用配置文件中的 REGION 兜底
          Key: stsData.UploadPath,
          Body: file
        },
        async (err, data) => {
          if (err) return reject(err)

          const eTag = data.ETag
          const cosHash = data.headers["x-cos-hash-crc64ecma"]

          try {
            const parseBody = {
              session_id: currentSessionId.value,
              request_id: uuidv4(),
              cos_bucket: stsData.Bucket,
              file_type: fileType,
              file_name: file.name,
              cos_url: stsData.UploadPath,
              e_tag: eTag,
              cos_hash: cosHash,
              size: String(file.size),
              bot_app_key: CREDENTIALS.APP_KEY // 【修改点 4】：使用 CREDENTIALS.APP_KEY
            }

            // 【修改点 5】：使用配置文件中的 DOC_PARSE_API
            const parseRes = await fetch(CREDENTIALS.DOC_PARSE_API, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(parseBody)
            })

            const reader = parseRes.body.getReader()
            const decoder = new TextDecoder()
            let finalDocId = null

            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              const chunk = decoder.decode(value, { stream: true })
              const lines = chunk.split("\n").filter(line => line.trim() !== "")

              for (const line of lines) {
                try {
                  const json = JSON.parse(line)
                  if (json.payload) {
                    const { status, doc_id, error_message } = json.payload
                    if (status === "SUCCESS" && json.payload.is_final) {
                      finalDocId = doc_id
                    } else if (status === "FAILED") {
                      throw new Error(error_message || "文档解析失败")
                    }
                  }
                } catch (e) {}
              }
            }

            if (finalDocId) {
              const fileUrl = `https://${stsData.Bucket}.${stsData.Type}.${stsData.Region || CREDENTIALS.REGION}.myqcloud.com${stsData.UploadPath}`
              resolve({
                doc_id: finalDocId,
                file_name: fileNameNoExt,
                file_type: fileType,
                file_size: String(file.size),
                file_url: fileUrl
              })
            } else {
              reject(new Error("未获取到有效的 doc_id"))
            }
          } catch (parseErr) {
            reject(parseErr)
          }
        }
      )
    })
  } catch (error) {
    console.error("文档解析阶段错误:", error)
    throw error
  }
}

// 修复后的 sendMessage 函数
const sendMessage = async () => {
  // 1. 基本校验
  if (!userInput.value.trim() && !currentFile.value) return

  const text = userInput.value
  const fileName = currentFile.value?.name || null

  // 2. UI 更新：添加用户消息
  messages.push({ role: "user", content: text, fileName: fileName })
  userInput.value = ""

  // 3. UI 更新：添加 AI 占位消息
  const aiMsg = reactive({ role: "assistant", content: "", loading: true })
  messages.push(aiMsg)

  await nextTick()
  scrollToBottom()

  try {
    let fileInfos = []

    // 4. 处理文件上传逻辑 (只有在有文件时才触发)
    if (currentFile.value) {
      aiMsg.content = "正在上传并解析文档..."
      try {
        const docInfo = await uploadAndParseDocument(currentFile.value)
        if (docInfo) {
          fileInfos.push(docInfo)
          aiMsg.content = "文档解析完毕，正在思考回答..."
        }
      } catch (fileErr) {
        console.error("文件处理失败，转为纯文本对话:", fileErr)
        // 如果文件处理失败，给个提示但继续尝试发送文字
        ElMessage.warning("文档解析失败，已转为纯文本模式回答")
      }
      currentFile.value = null // 清理文件状态
    }

    // 5. 组装请求参数
    const chatPayload = {
      RequestId: uuidv4(),
      ConversationId: currentSessionId.value,
      AppKey: CREDENTIALS.APP_KEY,
      VisitorId: CREDENTIALS.VISITOR_ID,
      Contents: [{ Type: "text", Text: text }],
      Stream: "disable",
      // 非流式模式下关闭增量，避免连接长时间不结束导致界面卡住
      Incremental: false,
      WorkflowStatus: "enable"
    }

    // 如果有解析成功的文档 id，则加入 file_infos
    if (fileInfos.length > 0) {
      chatPayload.file_infos = fileInfos
    }

    // 6. 发起请求
    const response = await axios.post(CREDENTIALS.CHAT_API, chatPayload, {
      headers: { "Content-Type": "application/json" },
      timeout: 30000
    })

    // 7. 处理响应数据 (保留您原有的 SSE 和 JSON 提取逻辑)
    let aiAnswer = ""
    if (typeof response.data === "string" && response.data.includes("data:")) {
      // ... 原有的数据提取逻辑 ...
      const lines = response.data.split("\n")
      const contentParts = []
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith("data:") && !trimmed.includes("[DONE]")) {
          try {
            const json = JSON.parse(trimmed.substring(5).trim())
            let part =
              json.Message?.Contents?.[0]?.Text || json.Payload?.WorkflowResults?.[0]?.Value || json.Contents?.[0]?.Text
            if (!part && json.Error?.Message) {
              part = `接口返回错误: ${json.Error.Message}`
            }
            if (part) contentParts.push(part)
          } catch (e) {}
        }
      }
      aiAnswer = contentParts.join("")
    } else {
      aiAnswer =
        response.data?.Contents?.[0]?.Text ||
        response.data?.Payload?.WorkflowResults?.[0]?.Value ||
        response.data?.Error?.Message ||
        "抱歉，我未能生成有效回复。"
    }

    // JSON 提取与格式化
    let extractedContent = aiAnswer
    try {
      const parsed = JSON.parse(aiAnswer)
      extractedContent = parsed.output || (parsed.msg !== "ok" ? parsed.msg : parsed.output) || aiAnswer
    } catch (e) {}

    aiMsg.content = formatContent(extractedContent)
    aiMsg.loading = false
  } catch (error) {
    aiMsg.loading = false
    aiMsg.content = `<span style="color: #ef4444;">对话请求失败: ${error.message}</span>`
  }
}

const scrollToBottom = () => {
  if (scrollbarRef.value) {
    nextTick(() => {
      const scrollEl = scrollbarRef.value.$el.querySelector(".el-scrollbar__wrap")
      scrollEl.scrollTop = scrollEl.scrollHeight
    })
  }
}

const quickCommand = cmd => {
  userInput.value = cmd
}

const handleEnter = e => {
  if (!e.shiftKey) sendMessage()
}
</script>

<style scoped>
.app-wrapper {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f8fafc;
  overflow: hidden;
}
.glass-header {
  height: 56px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}
.title {
  font-weight: 600;
  font-size: 16px;
  color: #1e293b;
}
.title small {
  font-weight: 400;
  color: #64748b;
  margin-left: 10px;
}
.user-status {
  display: flex;
  align-items: center;
  gap: 12px;
}
.user-name {
  font-size: 13px;
  color: #475569;
}

.main-layout {
  flex: 1;
  overflow: hidden;
}
.chat-main {
  display: flex;
  flex-direction: column;
  padding: 0;
  height: 100%;
}
.chat-viewport {
  flex: 1;
  overflow: hidden;
}
.message-wrapper {
  max-width: 860px;
  margin: 0 auto;
  padding: 40px 20px 120px;
}

.message-row {
  display: flex;
  gap: 14px;
  margin-bottom: 30px;
}
.message-row.user {
  flex-direction: row-reverse;
}
.bubble {
  padding: 12px 18px;
  border-radius: 12px;
  line-height: 1.6;
  font-size: 14px;
}
.assistant .bubble {
  background: #fff;
  border: 1px solid #e2e8f0;
  color: #1e293b;
  border-top-left-radius: 2px;
}
.user .bubble {
  background: #2563eb;
  color: #fff;
  border-top-right-radius: 2px;
}

.file-attachment {
  margin-top: 8px;
  font-size: 12px;
  color: #64748b;
  background: rgba(0, 0, 0, 0.05);
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.upload-area {
  display: flex;
  align-items: center;
  gap: 8px;
}
.file-tag {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.input-wrapper {
  padding: 20px;
  background: linear-gradient(to top, #f8fafc 70%, rgba(248, 250, 252, 0));
  flex-shrink: 0;
}
.input-card {
  max-width: 860px;
  margin: 0 auto;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 12px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
}
.action-bar {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}
.bottom-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}
.hint {
  font-size: 11px;
  color: #94a3b8;
}
.footer-notice {
  text-align: center;
  font-size: 11px;
  color: #cbd5e0;
  margin-top: 12px;
}

.typing-loader span {
  width: 6px;
  height: 6px;
  background: #cbd5e0;
  display: inline-block;
  border-radius: 50%;
  margin: 0 2px;
  animation: typing 1s infinite;
}
@keyframes typing {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}

.text-inner {
  font-size: 14px;
  line-height: 1.7;
  color: #334155;
}
.md-paragraph {
  margin: 0 0 12px 0;
  line-height: 1.7;
}
.md-paragraph:last-child {
  margin-bottom: 0;
}
.md-heading {
  color: #1e293b;
  margin: 16px 0 8px 0;
  font-weight: 600;
}
.md-heading:first-child {
  margin-top: 0;
}
h2.md-heading {
  font-size: 16px;
}
h3.md-heading {
  font-size: 15px;
}
h4.md-heading {
  font-size: 14px;
}
.inline-code {
  background: #f1f5f9;
  color: #dc2626;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: "Consolas", "Monaco", monospace;
  font-size: 13px;
}
.code-block {
  background: #1e293b;
  color: #e2e8f0;
  padding: 12px 16px;
  border-radius: 8px;
  margin: 12px 0;
  overflow-x: auto;
  font-family: "Consolas", "Monaco", monospace;
  font-size: 13px;
  line-height: 1.5;
}
.code-block code {
  white-space: pre;
}
.md-ul {
  margin: 8px 0;
  padding-left: 20px;
}
.md-list {
  margin: 4px 0;
  color: #475569;
  line-height: 1.6;
}
.md-list::marker {
  color: #64748b;
}
.md-link {
  color: #2563eb;
  text-decoration: none;
  border-bottom: 1px solid transparent;
}
.md-link:hover {
  border-bottom-color: #2563eb;
}
strong {
  font-weight: 600;
  color: #1e293b;
}
em {
  font-style: italic;
  color: #475569;
}
</style>
