import { useCallback, useEffect, useRef, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"

import { log } from "~debug-tool"

// import { BookmarkIcon, TabIcon } from "./Icons"
import { TabItem } from "./TabItem"

// 组件属性接口
interface TabSwitcherProps {
  onClose: () => void
  isPopup?: boolean // 标识是否在popup中使用
  activeIndex?: number
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
  activeIndex = 0
}: TabSwitcherProps) => {
  // 状态管理
  const [tabs, setTabs] = useState<TabInfo[]>([])
  const [filteredItems, setFilteredItems] = useState<
    (TabInfo | BookmarkInfo)[]
  >([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentTabIds, setRecentTabIds] = useState<number[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)
  const itemRefs = useRef<{ [key: number]: React.RefObject<HTMLDivElement> }>(
    {}
  )

  // 获取所有标签和书签
  const fetchAllItems = async () => {
    try {
      // 获取标签
      const tabResponse = await sendToBackground({ name: "searchAllTabs" })
      if (tabResponse.success && tabResponse.tabs.length > 0) {
        setTabs(tabResponse.tabs)
        setRecentTabIds(tabResponse.recentTabs || [])
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

      setFilteredItems(allItems.slice(1, 7))
      setSelectedIndex(0)
    })()
  }, [tabs,  recentTabIds])

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
      handleItemSelect(selectedIndex)
    }
  }, [activeIndex, selectedIndex, handleItemSelect])

  useEffect(() => {
    if (activeIndex > 0 && filteredItems.length > 0) {
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length)
    }
  }, [activeIndex])

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
    ? "plasmo-flex plasmo-flex-col plasmo-w-[600px] plasmo-max-w-full plasmo-max-h-full plasmo-overflow-hidden"
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
    : "plasmo-w-[600px] plasmo-max-w-[80vw] plasmo-bg-white plasmo-rounded-lg plasmo-shadow-xl plasmo-overflow-hidden"

  // 定义列表样式类名
  const listClassName = isPopup
    ? "plasmo-flex-1 plasmo-overflow-y-auto"
    : "plasmo-max-h-[60vh] plasmo-overflow-y-auto"

  // 渲染列表项
  const renderItem = (item, index) => {
    const isRecent = recentTabIds.includes(item.id)
    return (
      <TabItem
        key={item.id}
        tab={item}
        index={index}
        selectedIndex={selectedIndex}
        isRecent={isRecent}
        handleTabClick={handleItemSelect}
      />
    )
  }

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
            {tabs.length === 0
              ? "没有标签记录"
              : "输入关键词搜索标签"}
          </div>
        ) : (
          <div className={listClassName}>
            {filteredItems.map((item, index) => renderItem(item, index))}
          </div>
        )}
      </div>
    </div>
  )
}
