import type { PlasmoMessaging } from "@plasmohq/messaging"
import { getIconForUrl } from "../services/iconService"

interface RequestBody {
  url: string
}

const handler: PlasmoMessaging.MessageHandler<RequestBody> = async (req, res) => {
  try {
    const { url } = req.body

    if (!url) {
      throw new Error("未提供URL")
    }
    
    const iconData = await getIconForUrl(url)
    
    res.send({
      success: true,
      icon: iconData
    })
  } catch (error) {
    console.error("获取标签图标时出错:", error)
    res.send({
      success: false,
      error: error.message,
      icon: null
    })
  }
}

export default handler 
