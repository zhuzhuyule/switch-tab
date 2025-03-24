import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

// 定义标签信息接口
interface TabInfo {
  id: number
  title: string
  url: string
  favIconUrl: string
  windowId: number
  lastAccessed?: number
  accessCount?: number
}

// 初始化存储实例
const storage = new Storage({ area: "local" })

// 消息处理函数
const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  try {
    // 获取所有打开的标签
    const tabs = await chrome.tabs.query({})
    
    // 获取最近访问的标签列表（用于获取访问时间和次数信息）
    const recentTabs = await storage.get<TabInfo[]>("recentTabs") || []
    const tabAccessCounts = await storage.get<Record<number, number>>("tabAccessCounts") || {}
    
    // 将标签信息转换为所需格式，并添加最近访问时间和访问次数
    const tabInfoList: TabInfo[] = tabs.map(tab => {
      // 查找对应的最近访问标签
      const recentTab = recentTabs.find(rt => rt.id === tab.id)
      
      return {
        id: tab.id,
        title: tab.title || "无标题",
        url: tab.url || "",
        favIconUrl: tab.favIconUrl || "",
        windowId: tab.windowId,
        lastAccessed: recentTab?.lastAccessed || 0,
        accessCount: tabAccessCounts[tab.id] || 0
      }
    })
    
    // 发送响应
    res.send({
      success: true,
      tabs: tabInfoList,
      recentTabs: recentTabs.slice(0, 6).map(tab => tab.id) // 最近的6个标签ID
    })
  } catch (error) {
    console.error("搜索标签时出错:", error)
    res.send({
      success: false,
      error: error.message,
      tabs: []
    })
  }
}

export default handler 
