import { Storage } from "@plasmohq/storage"

const storage = new Storage({ area: "local" })
const STORAGE_KEY = "tabPreviews"

type PreviewMap = Record<string, string>

export const getPreviewMap = async (): Promise<PreviewMap> => {
  return (await storage.get<PreviewMap>(STORAGE_KEY)) || {}
}

export const savePreview = async (tabId: number, dataUrl: string | null) => {
  if (typeof tabId !== "number") {
    return
  }

  const previews = await getPreviewMap()

  if (dataUrl) {
    previews[String(tabId)] = dataUrl
  } else {
    delete previews[String(tabId)]
  }

  await storage.set(STORAGE_KEY, previews)
}

export const removePreview = async (tabId: number) => {
  const previews = await getPreviewMap()
  if (previews[String(tabId)]) {
    delete previews[String(tabId)]
    await storage.set(STORAGE_KEY, previews)
  }
}

export const getPreviewsByIds = async (tabIds: number[]) => {
  const previews = await getPreviewMap()
  const result: Record<string, string | null> = {}

  tabIds.forEach((id) => {
    result[id] = previews[String(id)] || null
  })

  return result
}
