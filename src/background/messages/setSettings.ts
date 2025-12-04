import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

const storage = new Storage({ area: "local" })

const MIN_LIMIT = 6
const MAX_LIMIT = 20

type LayoutMode = "vertical" | "horizontal"

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  try {
    const { displayLimit, layoutMode } = req.body as {
      displayLimit?: number
      layoutMode?: LayoutMode
    }

    const saved =
      ((await storage.get<{
        displayLimit?: number
        layoutMode?: LayoutMode
      }>("settings")) as { displayLimit?: number; layoutMode?: LayoutMode }) || {}

    const nextDisplayLimit =
      typeof displayLimit === "number" && !Number.isNaN(displayLimit)
        ? displayLimit
        : saved.displayLimit

    if (
      typeof nextDisplayLimit !== "number" ||
      Number.isNaN(nextDisplayLimit) ||
      nextDisplayLimit < MIN_LIMIT ||
      nextDisplayLimit > MAX_LIMIT
    ) {
      throw new Error(`显示数量需在 ${MIN_LIMIT}-${MAX_LIMIT} 之间`)
    }

    const normalizedLayout: LayoutMode =
      layoutMode === "horizontal" || layoutMode === "vertical"
        ? layoutMode
        : saved.layoutMode === "horizontal"
          ? "horizontal"
          : "vertical"

    const payload = {
      displayLimit: Math.round(nextDisplayLimit),
      layoutMode: normalizedLayout
    }

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
