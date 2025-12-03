import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

const storage = new Storage({ area: "local" })

const MIN_LIMIT = 6
const MAX_LIMIT = 20

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  try {
    const { displayLimit } = req.body as { displayLimit: number }

    if (
      typeof displayLimit !== "number" ||
      Number.isNaN(displayLimit) ||
      displayLimit < MIN_LIMIT ||
      displayLimit > MAX_LIMIT
    ) {
      throw new Error(`显示数量需在 ${MIN_LIMIT}-${MAX_LIMIT} 之间`)
    }

    const payload = { displayLimit: Math.round(displayLimit) }
    await storage.set("settings", payload)

    res.send({
      success: true,
      settings: payload
    })
  } catch (error) {
    console.error("更新设置失败:", error)
    res.send({
      success: false,
      error: error.message
    })
  }
}

export default handler
