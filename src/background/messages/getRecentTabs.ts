import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

// 定义标签信息接口
interface TabInfo {
  id: number
  title: string
  url: string
  favIconUrl: string
  lastAccessed: number
}

// 初始化存储实例
const storage = new Storage({ area: "local" })

// 消息处理函数
const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  try {
    // 获取存储的最近标签
    const recentTabs = await storage.get<TabInfo[]>("recentTabs") || []
    
    // 发送响应
    res.send({
      success: true,
      tabs: recentTabs
    })
  } catch (error) {
    console.error("获取最近标签时出错:", error)
    res.send({
      success: false,
      error: error.message,
      tabs: []
    })
  }
}

export default handler 
