import { useEffect, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"

const ICON_CACHE_LIMIT = 10
const iconCache = new Map<string, string>()

const getCachedIcon = (url: string) => iconCache.get(url) || null
const setCachedIcon = (url: string, data: string) => {
  if (!url || !data) return
  if (iconCache.has(url)) {
    iconCache.delete(url)
  } else if (iconCache.size >= ICON_CACHE_LIMIT) {
    const firstKey = iconCache.keys().next().value
    if (firstKey) {
      iconCache.delete(firstKey)
    }
  }
  iconCache.set(url, data)
}

// 生成基于域名的颜色
const getDomainColor = (url: string) => {
  try {
    const hostname = new URL(url).hostname
    let hash = 0
    for (let i = 0; i < hostname.length; i++) {
      hash = hostname.charCodeAt(i) + ((hash << 5) - hash)
    }
    const hue = hash % 360
    return `hsl(${hue}, 65%, 85%)`
  } catch {
    return "#e5e7eb" // 默认灰色
  }
}

// 根据访问次数生成标签颜色
// 颜色有浅（浅灰）到亮色（绿色）
const getTagColor = (times: number) => {
  if (times < 10) {
    return "#f0f0f0"
  }
  if (times < 20) {
    return "#e5e7eb"
  }
  if (times < 30) {
    return "#e5e7eb"
  }
  return "#e5e7eb"
}

interface TabItemProps {
  tab: TabInfo
  index: number
  isRecent: boolean
  handleTabClick: (index: number) => void
  previewUrl?: string | null
  selectedIndex: number
}

export const TabItem = ({
  tab,
  index,
  isRecent,
  handleTabClick,
  selectedIndex,
  previewUrl = null
}: TabItemProps) => {
  const [loadImageFailed, setLoadImageFailed] = useState(false)
  const [iconData, setIconData] = useState<string | null>(null)
  const [previewLoaded, setPreviewLoaded] = useState(false)
  const isSelected = selectedIndex === index
  useEffect(() => {
    if (tab.favIconUrl) {
      const cached = getCachedIcon(tab.favIconUrl)
      if (cached) {
        setLoadImageFailed(false)
        setIconData(cached)
        return
      }
      sendToBackground({
        name: "getTabIcon",
        body: { url: tab.favIconUrl }
      }).then(({ success, icon }) => {
        if (success && icon?.data) {
          setLoadImageFailed(false)
          setIconData(icon.data)
          setCachedIcon(tab.favIconUrl, icon.data)
        }
      })
    }
  }, [tab.favIconUrl])

  return (
    <li
      key={tab.id}
      className={`plasmo-relative plasmo-flex plasmo-gap-3 plasmo-items-center plasmo-py-3 plasmo-px-3 plasmo-border plasmo-border-slate-200 plasmo-border-b plasmo-border-gray-100 plasmo-cursor-pointer plasmo-h-20 plasmo-transition-all plasmo-duration-200 ${isSelected
        ? "plasmo-bg-white plasmo-border-r-transparent"
        : "plasmo-bg-gray-300 hover:plasmo-bg-gray-200 hover:plasmo-shadow-sm"
        } ${isRecent && !isSelected ? "plasmo-bg-blue-50 plasmo-bg-opacity-15" : ""}`}
      style={
        isSelected
          ? {
            boxShadow:
              "-8px 8px 16px -14px rgba(0,0,0,0.8), -8px -8px 16px -14px rgba(0,0,0,0.5)",
            transition: "box-shadow 0.25s ease, background-color 0.2s ease"
          }
          : {
            boxShadow: "0 3px 8px -8px rgba(0,0,0,0.45)",
            transition: "box-shadow 0.25s ease, background-color 0.2s ease"
          }
      }
      onClick={() => handleTabClick(index)}>
      <span
        className="plasmo-absolute plasmo-top-0 plasmo-left-0 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-text-[12px] plasmo-font-semibold plasmo-text-white plasmo-h-5 plasmo-w-5 plasmo-shadow-lg plasmo-bg-blue-400 plasmo-rounded"
      >
        {index + 1}
      </span>
      <div className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-w-12 plasmo-flex-shrink-0">
        {iconData && !loadImageFailed ? (
          <img
            src={iconData}
            alt="标签图标"
            className="plasmo-w-8 plasmo-h-8 plasmo-rounded"
            onError={() => setLoadImageFailed(true)}
          />
        ) : (
          <div
            className="plasmo-w-8 plasmo-h-8 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-rounded plasmo-text-sm plasmo-font-semibold plasmo-text-gray-700"
            style={{ backgroundColor: getDomainColor(tab.url) }}>
            {tab.title.trim().charAt(0)}
          </div>
        )}
      </div>

      <div className="plasmo-flex-1 plasmo-min-w-0">
        <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-mb-1">
          <div className="plasmo-truncate plasmo-font-semibold plasmo-text-gray-800">
            {tab.title}
          </div>
        </div>
        <div className="plasmo-truncate plasmo-text-[11px] plasmo-text-gray-500">
          {tab.url}
        </div>
      </div>

      {!isSelected && (
        <div className="plasmo-w-28 plasmo-aspect-video plasmo-rounded-md plasmo-overflow-hidden plasmo-bg-gray-100 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-relative plasmo-flex-shrink-0 plasmo-border plasmo-border-slate-200 plasmo-shadow-md">
          {previewUrl ? (
            <>
              {!previewLoaded && (
                <div className="plasmo-absolute plasmo-inset-0 plasmo-animate-pulse plasmo-bg-gradient-to-br plasmo-from-slate-100 plasmo-to-slate-200" />
              )}
              <img
                src={previewUrl}
                alt="页面预览"
                className="plasmo-w-full plasmo-h-full plasmo-object-cover plasmo-transition-opacity plasmo-duration-300"
                onLoad={() => setPreviewLoaded(true)}
              />
            </>
          ) : (
            <div className="plasmo-text-[11px] plasmo-text-gray-400">
              无预览
            </div>
          )}
        </div>
      )}
    </li>
  )
}
