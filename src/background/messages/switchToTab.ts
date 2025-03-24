import type { PlasmoMessaging } from "@plasmohq/messaging"

// 请求体接口
interface RequestBody {
  tabId: number
}

// 消息处理函数
const handler: PlasmoMessaging.MessageHandler<RequestBody> = async (req, res) => {
  try {
    const { tabId } = req.body
    
    // 验证参数
    if (typeof tabId !== 'number') {
      throw new Error("无效的标签ID")
    }

    // 尝试更新标签状态（激活指定标签）
    await chrome.tabs.update(tabId, { active: true })
    
    // 尝试聚焦包含此标签的窗口
    const tab = await chrome.tabs.get(tabId)
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true })
    }
    
    // 发送成功响应
    res.send({
      success: true,
      message: "成功切换到指定标签"
    })
  } catch (error) {
    console.error("切换标签时出错:", error)
    
    // 发送错误响应
    res.send({
      success: false,
      error: error.message
    })
  }
}

export default handler 
