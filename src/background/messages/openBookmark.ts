import { type PlasmoMessaging } from "@plasmohq/messaging"

export default async function handler(
  req: PlasmoMessaging.Request<{ url: string }>
) {
  try {
    const { url } = req.body
    
    // 创建新标签打开书签
    await chrome.tabs.create({ url })
    
    return {
      success: true
    }
  } catch (error) {
    console.error("打开书签时出错:", error)
    return {
      success: false,
      error: error.message
    }
  }
} 
