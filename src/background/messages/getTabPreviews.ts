import type { PlasmoMessaging } from "@plasmohq/messaging"

import { getPreviewsByIds } from "../services/previewService"

interface RequestBody {
  tabIds: number[]
}

const handler: PlasmoMessaging.MessageHandler<RequestBody> = async (req, res) => {
  try {
    const tabIds = req.body?.tabIds || []
    const previews = await getPreviewsByIds(tabIds)

    res.send({
      success: true,
      previews
    })
  } catch (error) {
    console.error("获取标签预览失败:", error)
    res.send({
      success: false,
      error: (error as Error).message,
      previews: {}
    })
  }
}

export default handler
