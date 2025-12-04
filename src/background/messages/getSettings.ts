import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

const MIN_LIMIT = 1
const MAX_LIMIT = 8
const DEFAULT_SETTINGS = {
  displayLimit: 6,
  layoutMode: "vertical" as "vertical" | "horizontal"
}

const storage = new Storage({ area: "local" })

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  try {
    const saved =
      (await storage.get<typeof DEFAULT_SETTINGS>("settings")) || DEFAULT_SETTINGS

    // 如果没有存储，补一份默认值，方便后续读取
    if (!saved) {
      await storage.set("settings", DEFAULT_SETTINGS)
    }

    const displayLimitRaw = saved.displayLimit || DEFAULT_SETTINGS.displayLimit
    const normalized = {
      displayLimit: Math.max(
        MIN_LIMIT,
        Math.min(displayLimitRaw, MAX_LIMIT)
      ),
      layoutMode: saved.layoutMode === "horizontal" ? "horizontal" : "vertical"
    }

    // 持久化修正后的值
    await storage.set("settings", normalized)

    res.send({
      success: true,
      settings: normalized
    })
  } catch (error) {
    console.error("获取设置失败:", error)
    res.send({
      success: false,
      error: error.message
    })
  }
}

export default handler
