import type { PlasmoMessaging } from "@plasmohq/messaging"

// 定义标签信息接口
interface TabInfo {
  id: number
  title: string
  url: string
  favIconUrl: string
  windowId: number
}

// 消息处理函数
const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  try {
    // 获取所有打开的标签
    const tabs = await chrome.tabs.query({})
    
    // 将标签信息转换为所需格式
    const tabInfoList: TabInfo[] = tabs.map(tab => ({
      id: tab.id,
      title: tab.title || "无标题",
      url: tab.url || "",
      favIconUrl: tab.favIconUrl || "",
      windowId: tab.windowId
    }))
    
    // 发送响应
    res.send({
      success: true,
      tabs: tabInfoList
    })
  } catch (error) {
    console.error("获取所有标签时出错:", error)
    res.send({
      success: false,
      error: error.message,
      tabs: []
    })
  }
}

export default handler 
