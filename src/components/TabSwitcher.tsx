import { useEffect, useRef, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"

import { log } from "~debug-tool"

// 定义标签信息接口
interface TabInfo {
  id: number
  title: string
  url: string
  favIconUrl: string
  lastAccessed: number
}

// 组件属性接口
interface TabSwitcherProps {
  onClose: () => void
  isPopup?: boolean // 标识是否在popup中使用
  activeIndex?: number
}

export const TabSwitcher = ({
  onClose,
  isPopup = false,
  activeIndex = 0
}: TabSwitcherProps) => {
  // 状态管理
  const [tabs, setTabs] = useState<TabInfo[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const eventRef = useRef<{
    handleKeyDown: (e: KeyboardEvent) => void
    handleKeyUp: (e: KeyboardEvent) => void
  }>({
    handleKeyDown: () => {},
    handleKeyUp: () => {}
  })

  eventRef.current = {
    handleKeyDown: (e: KeyboardEvent) => {
      if (!tabs.length) return
      switch (e.key) {
        case "ArrowDown":
        case "j":
          setSelectedIndex((prev) => (prev + 1) % tabs.length)
          break
        case "ArrowUp":
        case "k":
          setSelectedIndex((prev) => (prev - 1 + tabs.length) % tabs.length)
          break
        case "Enter":
          switchToSelectedTab(selectedIndex)
          break
        case "Escape":
          onClose()
          break
        default:
          // 数字键 1-9 直接选择对应索引的标签
          const num = parseInt(e.key)
          if (!isNaN(num) && num >= 1 && num <= Math.min(9, tabs.length)) {
            setSelectedIndex(num - 1)
            switchToSelectedTab(num - 1)
          }
          break
      }
    },
    handleKeyUp: (e: KeyboardEvent) => {
      log(activeIndex)
      if (e.key === "Meta" && activeIndex > 1) {
        switchToSelectedTab(selectedIndex)
      }
    }
  }

  useEffect(() => {
    if (activeIndex > 0 && tabs.length > 0) {
      setSelectedIndex((prev) => (prev + 1) % tabs.length)
    }
  }, [activeIndex])

  // 获取最近标签列表
  const fetchRecentTabs = async () => {
    try {
      const response = await sendToBackground({ name: "getRecentTabs" })

      if (response.success && response.tabs.length > 0) {
        setTabs(response.tabs)
      } else {
        console.log("没有找到最近的标签或获取失败")
      }
    } catch (error) {
      console.error("获取最近标签时出错:", error)
    }
  }

  // 切换到选中的标签
  const switchToSelectedTab = async (selectedIndex: number) => {
    if (tabs.length === 0 || selectedIndex >= tabs.length) {
      return
    }

    try {
      const selectedTab = tabs[selectedIndex]
      await sendToBackground({
        name: "switchToTab",
        body: { tabId: selectedTab.id }
      })
      onClose()
    } catch (error) {
      console.error("切换标签时出错:", error)
    }
  }

  // 处理点击事件
  const handleTabClick = (
    index: number,
    e: React.MouseEvent<HTMLLIElement>
  ) => {
    e.stopPropagation()
    e.preventDefault()

    setSelectedIndex(index)
    switchToSelectedTab(index)
  }

  // 组件加载时获取标签列表
  useEffect(() => {
    fetchRecentTabs()
  }, [])

  // 设置和清理事件监听器
  useEffect(() => {
    // 处理键盘事件
    log("bind")
    const handleKeyDown = (e: KeyboardEvent) =>
      eventRef.current.handleKeyDown(e)
    const handleKeyUp = (e: KeyboardEvent) => eventRef.current.handleKeyUp(e)

    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("keyup", handleKeyUp)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  // 定义容器样式类名
  const containerClassName = isPopup
    ? "plasmo-flex plasmo-flex-col plasmo-w-[600px] plasmo-max-w-full plasmo-max-h-full plasmo-overflow-hidden"
    : "plasmo-fixed plasmo-inset-0 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-bg-black plasmo-bg-opacity-50 plasmo-z-50"

  // 定义列表容器样式类名
  const listContainerClassName = isPopup
    ? "plasmo-w-full plasmo-h-full plasmo-flex plasmo-flex-col plasmo-bg-white plasmo-overflow-hidden plasmo-rounded-lg"
    : "plasmo-w-[600px] plasmo-max-w-[80vw] plasmo-bg-white plasmo-rounded-lg plasmo-shadow-xl plasmo-overflow-hidden"

  // 定义列表样式类名
  const listClassName = isPopup
    ? "plasmo-flex-1 plasmo-overflow-y-auto"
    : "plasmo-max-h-[60vh] plasmo-overflow-y-auto"

  return (
    <div
      className={containerClassName}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}>
      <div ref={containerRef} className={listContainerClassName}>
        <div className="plasmo-p-4 plasmo-bg-gray-100 plasmo-border-b plasmo-border-gray-200">
          <h2 className="plasmo-text-lg plasmo-font-medium plasmo-text-gray-800">
            最近访问的标签
          </h2>
          <p className="plasmo-text-sm plasmo-text-gray-500">
            使用方向键导航或数字键(1-{Math.min(9, tabs.length)})直接选择
          </p>
        </div>

        {tabs.length === 0 ? (
          <div className="plasmo-p-8 plasmo-text-center plasmo-text-gray-500">
            没有最近访问的标签记录
          </div>
        ) : (
          <ul className={listClassName}>
            {tabs.map((tab, index) => (
              <li
                key={tab.id}
                className={`plasmo-flex plasmo-items-center plasmo-p-3 plasmo-border-b plasmo-border-gray-100 plasmo-cursor-pointer hover:plasmo-bg-gray-50 ${
                  selectedIndex === index ? "plasmo-bg-blue-50" : ""
                }`}
                onClick={(e) => handleTabClick(index, e)}>
                <div className="plasmo-flex plasmo-items-center plasmo-w-8 plasmo-h-8 plasmo-mr-3 plasmo-justify-center">
                  <span className="plasmo-inline-block plasmo-w-6 plasmo-h-6 plasmo-text-center plasmo-font-bold plasmo-text-gray-500 plasmo-bg-gray-200 plasmo-rounded-full plasmo-leading-6">
                    {index + 1}
                  </span>
                </div>

                {tab.favIconUrl ? (
                  <img
                    src={tab.favIconUrl}
                    alt="标签图标"
                    className="plasmo-w-6 plasmo-h-6 plasmo-mr-3 plasmo-rounded"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = "none"
                    }}
                  />
                ) : (
                  <div className="plasmo-w-6 plasmo-h-6 plasmo-mr-3 plasmo-bg-gray-200 plasmo-rounded" />
                )}

                <div className="plasmo-flex-1 plasmo-min-w-0">
                  <div className="plasmo-truncate plasmo-font-medium plasmo-text-gray-800">
                    {tab.title}
                  </div>
                  <div className="plasmo-truncate plasmo-text-xs plasmo-text-gray-500">
                    {tab.url}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!isPopup && (
          <div className="plasmo-p-3 plasmo-bg-gray-50 plasmo-text-right">
            <button
              onClick={onClose}
              className="plasmo-px-4 plasmo-py-2 plasmo-text-sm plasmo-text-gray-600 plasmo-rounded hover:plasmo-bg-gray-200">
              取消 (ESC)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
