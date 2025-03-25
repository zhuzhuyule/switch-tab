import { useEffect, useState } from "react"
import { sendToBackground } from '@plasmohq/messaging'

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
  handleTabClick: (index: number, e: React.MouseEvent<HTMLLIElement>) => void
  selectedIndex: number
}

export const TabItem = ({
  tab,
  index,
  isRecent,
  handleTabClick,
  selectedIndex
}: TabItemProps) => {
  const [loadImageFailed, setLoadImageFailed] = useState(false)
  const [iconData, setIconData] = useState<string | null>(null)
  useEffect(() => {
    sendToBackground({
      name: "getTabIcon",
      body: { url: tab.favIconUrl }
    }).then(({ success, icon }) => {
      if (success) {
        setLoadImageFailed(false)
        setIconData(icon?.data)
      }
    })
  }, [tab.favIconUrl])

  return (
    <li
      key={tab.id}
      className={`plasmo-flex plasmo-items-center plasmo-p-3 plasmo-border-b plasmo-border-gray-100 plasmo-cursor-pointer hover:plasmo-bg-gray-50 ${
        selectedIndex === index ? "plasmo-bg-blue-100" : ""
      } ${isRecent && selectedIndex !== index ? "plasmo-bg-blue-50 plasmo-bg-opacity-30" : ""}`}
      onClick={(e) => handleTabClick(index, e)}>
      <div className="plasmo-flex plasmo-items-center plasmo-w-8 plasmo-h-8 plasmo-mr-3 plasmo-justify-center">
        <span
          className={`plasmo-inline-block plasmo-w-6 plasmo-h-6 plasmo-text-center plasmo-font-bold plasmo-rounded-full plasmo-leading-6 ${
            isRecent
              ? "plasmo-text-white plasmo-bg-blue-500"
              : "plasmo-text-gray-500 plasmo-bg-gray-200"
          }`}>
          {index + 1}
        </span>
      </div>

      {iconData && !loadImageFailed ? (
        <img
          src={iconData}
          alt="标签图标"
          className="plasmo-w-8 plasmo-h-8 plasmo-mr-3 plasmo-rounded"
          onError={() => setLoadImageFailed(true)}
        />
      ) : (
        <div
          className="plasmo-w-8 plasmo-h-8 plasmo-mr-3 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-bg-gray-200 plasmo-rounded plasmo-text-lg plasmo-font-medium plasmo-text-gray-700"
          style={{ backgroundColor: getDomainColor(tab.url) }}>
          {tab.title.trim().charAt(0)}
        </div>
      )}

      <div className="plasmo-flex-1 plasmo-min-w-0">
        <div className="plasmo-truncate plasmo-font-medium plasmo-text-gray-800">
          {tab.title}
        </div>
        <div className="plasmo-truncate plasmo-text-xs plasmo-text-gray-500">
          {tab.url}
        </div>
      </div>

      {tab.accessCount !== undefined && (
        <div className="plasmo-ml-2 plasmo-text-xs plasmo-text-gray-500 plasmo-bg-gray-100 plasmo-px-2 plasmo-py-1 plasmo-rounded"
          style={{ backgroundColor: getTagColor(tab.accessCount) }}>
          {tab.accessCount}
        </div>
      )}
    </li>
  )
}
