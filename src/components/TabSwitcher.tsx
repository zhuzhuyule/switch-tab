import { useCallback, useEffect, useRef, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"

import { log } from "~debug-tool"

// import { BookmarkIcon, TabIcon } from "./Icons"
import { TabItem } from "./TabItem"

const iconCache = new Map<string, string>()
const pendingIcon = new Map<string, Promise<string | null>>()

const fetchIcon = async (url: string): Promise<string | null> => {
  if (!url) return null
  if (iconCache.has(url)) return iconCache.get(url)
  if (pendingIcon.has(url)) return pendingIcon.get(url)

  const promise = sendToBackground({
    name: "getTabIcon",
    body: { url }
  })
    .then((res) => {
      if (res?.success && res.icon?.data) {
        iconCache.set(url, res.icon.data)
        return res.icon.data as string
      }
      return null
    })
    .finally(() => {
      pendingIcon.delete(url)
    })

  pendingIcon.set(url, promise)
  return promise
}

// 组件属性接口
interface TabSwitcherProps {
  onClose: () => void
  isPopup?: boolean // 标识是否在popup中使用
  activeIndex?: number
  autoSelectSignal?: number
}

interface BookmarkInfo {
  id: string
  title: string
  url: string
  dateAdded?: number
  type: "bookmark"
}

export const TabSwitcher = ({
  onClose,
  isPopup = false,
  activeIndex = 0,
  autoSelectSignal = 0
}: TabSwitcherProps) => {
  // 状态管理
  const [tabs, setTabs] = useState<TabInfo[]>([])
  const [filteredItems, setFilteredItems] = useState<
    (TabInfo | BookmarkInfo)[]
  >([])
  const [previews, setPreviews] = useState<Record<string, string | null>>({})
  const [layoutMode, setLayoutMode] = useState<"vertical" | "horizontal">("vertical")
  const [iconMap, setIconMap] = useState<Record<string, string>>({})
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentTabIds, setRecentTabIds] = useState<number[]>([])
  const [displayLimit, setDisplayLimit] = useState(6)
  const [autoSelectPending, setAutoSelectPending] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const itemRefs = useRef<{ [key: number]: React.RefObject<HTMLDivElement> }>(
    {}
  )
  const selectedItem = filteredItems[selectedIndex]
  const selectedTabId =
    selectedItem && ("tabId" in selectedItem ? selectedItem.tabId : selectedItem.id)
  const selectedPreview =
    typeof selectedTabId === "number" ? previews[String(selectedTabId)] || null : null

  const decodeUrl = (url: string) => {
    if (!url) return ""
    try {
      return decodeURIComponent(url)
    } catch {
      return url
    }
  }

  // 获取所有标签和书签
  const fetchAllItems = async () => {
    try {
      const [tabResponse, settingResponse] = await Promise.all([
        sendToBackground({ name: "searchAllTabs" }),
        sendToBackground({ name: "getSettings" }).catch(() => null)
      ])

      if (tabResponse.success && tabResponse.tabs.length > 0) {
        setTabs(tabResponse.tabs)
        setRecentTabIds(tabResponse.recentTabs || [])

        try {
          const previewResponse = await sendToBackground({
            name: "getTabPreviews",
            body: { tabIds: tabResponse.tabs.map((tab) => tab.id) }
          })
          if (previewResponse?.success && previewResponse.previews) {
            setPreviews(previewResponse.previews)
          } else {
            setPreviews({})
          }
        } catch (previewError) {
          console.error("获取预览图失败:", previewError)
          setPreviews({})
        }

        // 预取横版需要的图标，减少重复请求
        const urls = tabResponse.tabs
          .map((t) => t.favIconUrl)
          .filter((u) => typeof u === "string" && u.length > 0)
        const unique = Array.from(new Set(urls))
        Promise.all(
          unique.map(async (url) => {
            const data = await fetchIcon(url)
            return { url, data }
          })
        ).then((results) => {
          const next: Record<string, string> = {}
          results.forEach(({ url, data }) => {
            if (data) next[url] = data
          })
          setIconMap((prev) => ({ ...prev, ...next }))
        })
      }

      if (settingResponse?.success && settingResponse.settings?.displayLimit) {
        setDisplayLimit(settingResponse.settings.displayLimit)
        setLayoutMode(
          settingResponse.settings.layoutMode === "horizontal"
            ? "horizontal"
            : "vertical"
        )
      }
    } catch (error) {
      console.error("获取数据时出错:", error)
    }
  }

  // 根据搜索词过滤标签和书签
  useEffect(() => {
    // 如果没有搜索词，只显示最近的标签
    (async () => {
      // 合并结果，标签优先显示
      const allItems = [...tabs]

      // 排序：先最近标签，再其他标签，最后书签
      allItems.sort((a, b) => {
        // 区分标签和书签
        const aIsTab = "tabId" in a || ("id" in a && typeof a.id === "number")
        const bIsTab = "tabId" in b || ("id" in b && typeof b.id === "number")

        // 标签优先于书签
        if (aIsTab && !bIsTab) return -1
        if (!aIsTab && bIsTab) return 1

        // 如果两者都是标签，按照最近访问排序
        if (aIsTab && bIsTab) {
          const aId = ("tabId" in a ? a.tabId : a.id) as number
          const bId = ("tabId" in b ? b.tabId : b.id) as number

          const aIsRecent = recentTabIds.includes(aId)
          const bIsRecent = recentTabIds.includes(bId)

          if (aIsRecent && !bIsRecent) return -1
          if (!aIsRecent && bIsRecent) return 1

          if (aIsRecent && bIsRecent) {
            return recentTabIds.indexOf(aId) - recentTabIds.indexOf(bId)
          }
        }

        // 默认按标题排序
        return a.title.localeCompare(b.title)
      })

      const limit = Math.max(1, Math.min(displayLimit, 8))
      setFilteredItems(allItems.slice(0, limit))
      setSelectedIndex(0)
    })()
  }, [tabs, recentTabIds, displayLimit])

  // 处理选中项的切换
  const handleItemSelect = async (index: number) => {
    const item = filteredItems[index]

    try {
      if ("type" in item && item.type === "bookmark") {
        // 处理书签：打开新标签
        await sendToBackground({
          name: "openBookmark",
          body: { url: item.url }
        })
      } else {
        // 处理标签：切换到现有标签
        const tabId = "tabId" in item ? item.tabId : item.id
        await sendToBackground({
          name: "switchToTab",
          body: { tabId }
        })
      }
      onClose()
    } catch (error) {
      console.error("处理选择时出错:", error)
    }
  }

  // 组件加载时获取数据
  useEffect(() => {
    fetchAllItems()
    searchInputRef.current?.focus()
  }, [])

  // 使用useCallback确保事件处理函数能访问最新状态
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // 数字键 1-9 直接选择对应索引的标签
    // 如果不在搜索框中，或在搜索框但没有文本
    if (document.activeElement !== searchInputRef.current || /^[1-9]$/.test(e.key)) {
      const num = parseInt(e.key)
      if (num >= 1 && num <= Math.min(9, filteredItems.length)) {
        setSelectedIndex(num - 1)
        handleItemSelect(num - 1)
        return
      }
    }

    // 如果焦点在搜索框中且不是导航键，不处理
    if (
      document.activeElement === searchInputRef.current &&
      !["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(e.key)
    ) {
      return
    }

    if (filteredItems.length === 0) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault() // 防止页面滚动
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length)
        break
      case "ArrowUp":
        e.preventDefault() // 防止页面滚动
        setSelectedIndex(
          (prev) => (prev - 1 + filteredItems.length) % filteredItems.length
        )
        break
      case "Enter":
        handleItemSelect(selectedIndex)
        break
      case "Escape":
        onClose()
        break
      case "/":
        // 快速聚焦到搜索框
        if (document.activeElement !== searchInputRef.current) {
          e.preventDefault()
          searchInputRef.current?.focus()
        }
        break
    }
  }, [filteredItems, selectedIndex, handleItemSelect, onClose])

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    log(activeIndex)
    // 支持Mac的Cmd键(Meta) 和 Windows的Ctrl键(Control)
    if (e.key === "Meta" || e.key === "Control") {
      if (filteredItems.length > 0) {
        handleItemSelect(selectedIndex)
      } else {
        setAutoSelectPending(true)
      }
    }
  }, [activeIndex, selectedIndex, filteredItems.length, handleItemSelect])

  useEffect(() => {
    if (activeIndex > 0 && filteredItems.length > 0) {
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length)
    }
  }, [activeIndex])

  // 当捕获到修饰键松开信号时，若数据已就绪则立刻选择，否则等待数据就绪
  useEffect(() => {
    if (autoSelectSignal === 0) return

    if (filteredItems.length > 0) {
      handleItemSelect(selectedIndex)
      setAutoSelectPending(false)
    } else {
      setAutoSelectPending(true)
    }
  }, [autoSelectSignal, filteredItems.length, selectedIndex, handleItemSelect])

  // 等待中的自动选择在数据到达后执行
  useEffect(() => {
    if (autoSelectPending && filteredItems.length > 0) {
      handleItemSelect(selectedIndex)
      setAutoSelectPending(false)
    }
  }, [autoSelectPending, filteredItems, selectedIndex, handleItemSelect])

  // 设置和清理事件监听器
  useEffect(() => {
    // 处理键盘事件
    log("bind")
    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("keyup", handleKeyUp)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("keyup", handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp])

  // 定义容器样式类名
  const containerClassName = isPopup
    ? "plasmo-flex plasmo-flex-col plasmo-w-[1000px] plasmo-max-w-[1500px] plasmo-overflow-hidden"
    : "plasmo-fixed plasmo-inset-0 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-bg-black plasmo-bg-opacity-50 plasmo-z-50"

  const [isVisible, setIsVisible] = useState(false)
  useEffect(() => {
    setIsVisible(true)
    setTimeout(() => {
      setIsVisible(true)
    }, 500)
  }, [])

  // 定义列表容器样式类名
  const listContainerClassName = isPopup
    ? "plasmo-w-full plasmo-h-full plasmo-flex plasmo-flex-col plasmo-bg-white plasmo-overflow-hidden plasmo-rounded-lg custom-base"
    : "plasmo-w-full plasmo-max-w-[1500px] plasmo-bg-white plasmo-rounded-lg plasmo-shadow-xl plasmo-overflow-hidden"

  // 定义列表样式类名
  const listClassName = isPopup
    ? "plasmo-flex-1 plasmo-overflow-y-auto plasmo-overflow-x-hidden plasmo-pt-2 plasmo-pb-2"
    : "plasmo-max-h-[70vh] plasmo-overflow-y-auto plasmo-overflow-x-hidden plasmo-pt-2 plasmo-pb-2"

  // 渲染列表项
  const renderItem = (item, index) => {
    const tabId = "tabId" in item ? item.tabId : item.id
    const isRecent =
      typeof tabId === "number" && recentTabIds.includes(tabId as number)
    const previewUrl =
      typeof tabId === "number" ? previews[String(tabId)] || null : null
    return (
      <TabItem
        key={item.id}
        tab={item}
        index={index}
        selectedIndex={selectedIndex}
        isRecent={isRecent}
        previewUrl={previewUrl}
        handleTabClick={handleItemSelect}
      />
    )
  }

  const renderHorizontal = () => (
    <div className="plasmo-w-full plasmo-max-w-[1500px] plasmo-mx-auto plasmo-p-4">
      <div className="plasmo-flex plasmo-flex-wrap plasmo-gap-4 plasmo-justify-center plasmo-hide-scrollbar">
        {filteredItems.map((item, index) => {
          const tabId = "tabId" in item ? item.tabId : item.id
          const previewUrl =
            typeof tabId === "number" ? previews[String(tabId)] || null : null
          const isActive = index === selectedIndex
          return (
            <button
              key={item.id}
              className={`plasmo-relative plasmo-flex plasmo-flex-col plasmo-rounded-xl plasmo-border plasmo-overflow-hidden plasmo-transition-all plasmo-duration-200 plasmo-basis-[200px] plasmo-flex-grow plasmo-max-w-[240px] ${isActive
                ? "plasmo-bg-white plasmo-border-slate-200 plasmo-shadow-lg plasmo-scale-[1.03]"
                : "plasmo-bg-gray-100 plasmo-border-gray-200 hover:plasmo-shadow-sm"
                }`}
              onClick={() => handleItemSelect(index)}>
              <span
                className="plasmo-absolute plasmo-top-1 plasmo-left-1 plasmo-inline-flex plasmo-items-center plasmo-justify-center plasmo-text-[10px] plasmo-font-semibold plasmo-text-white plasmo-px-1.5 plasmo-h-5 plasmo-leading-none plasmo-shadow-sm plasmo-pointer-events-none"
                style={{
                  backgroundColor: recentTabIds.includes(tabId as number)
                    ? "#2563EB"
                    : "#111827",
                  borderTopRightRadius: "8px",
                  borderBottomRightRadius: "8px"
                }}>
                {index + 1}
              </span>
              <div className="plasmo-w-full plasmo-aspect-video plasmo-bg-gray-200 plasmo-flex plasmo-items-center plasmo-justify-center">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="tab preview"
                    className="plasmo-w-full plasmo-h-full plasmo-object-cover"
                  />
                ) : (
                  <div className="plasmo-text-xs plasmo-text-gray-500">无预览</div>
                )}
              </div>
              <div className="plasmo-p-3 plasmo-text-left plasmo-space-y-1">
                <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
                  {("favIconUrl" in item || "url" in item) && (item as any).favIconUrl ? (
                    <img
                      src={iconMap[(item as any).favIconUrl] || (item as any).favIconUrl}
                      alt="icon"
                      className="plasmo-w-4 plasmo-h-4 plasmo-rounded-sm"
                    />
                  ) : (
                    <div className="plasmo-w-4 plasmo-h-4 plasmo-rounded-sm plasmo-bg-gray-300" />
                  )}
                  <div className="plasmo-truncate plasmo-text-sm plasmo-font-semibold plasmo-text-gray-900">
                    {item.title || "无标题"}
                  </div>
                </div>
                <div className="plasmo-truncate plasmo-text-[11px] plasmo-text-gray-500">
                  {decodeUrl(item.url || "")}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )

  const renderVertical = () => (
    <div className="plasmo-flex plasmo-h-full plasmo-overflow-hidden">
      <div className={`${listClassName} plasmo-flex-1`}>
        {filteredItems.map((item, index) => renderItem(item, index))}
      </div>
      <div className="plasmo-flex-1 plasmo-bg-white plasmo-relative plasmo-p-4 plasmo-flex plasmo-flex-col plasmo-gap-3 plasmo-min-h-[320px] plasmo-max-w-[50vw]">
        <div className="plasmo-flex-1 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-overflow-visible">
          <div className="plasmo-w-full plasmo-relative plasmo-overflow-visible">
            <div
              key={selectedTabId ?? "none"}
              className="plasmo-w-full plasmo-aspect-video plasmo-rounded-xl plasmo-overflow-hidden plasmo-bg-gradient-to-br plasmo-from-slate-100 plasmo-to-slate-200 plasmo-shadow-md plasmo-border plasmo-border-slate-200 slide-in">
              {selectedPreview ? (
                <img
                  src={selectedPreview}
                  alt="当前标签预览"
                  className="plasmo-w-full plasmo-h-full plasmo-object-cover"
                />
              ) : (
                <div className="plasmo-w-full plasmo-h-full plasmo-flex plasmo-items-center plasmo-justify-center plasmo-text-sm plasmo-text-gray-400">
                  暂无预览
                </div>
              )}
            </div>
            {selectedItem && (
              <div className="plasmo-absolute plasmo-top-full plasmo-left-0 plasmo-right-0 plasmo-pt-2 plasmo-h-0 plasmo-leading-[0] plasmo-overflow-visible plasmo-text-left">
                <div className="plasmo-text-sm plasmo-font-semibold plasmo-text-gray-900 plasmo-break-words plasmo-leading-[1.35]">
                  {selectedItem.title || "无标题"}
                </div>
                <div className="plasmo-text-[11px] plasmo-text-gray-500 plasmo-break-words plasmo-leading-[1.3]">
                  {decodeUrl(selectedItem.url || "")}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div
      className={containerClassName}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}>
      <div
        className={
          listContainerClassName +
          ` custom-base ${isVisible ? "custom-show" : ""}`
        }>

        {filteredItems.length === 0 ? (
          <div className="plasmo-p-8 plasmo-text-center plasmo-text-gray-500">
            {tabs.length === 0 ? "没有标签记录" : "输入关键词搜索标签"}
          </div>
        ) : layoutMode === "horizontal" ? (
          renderHorizontal()
        ) : (
          renderVertical()
        )}
      </div>
    </div>
  )
}
