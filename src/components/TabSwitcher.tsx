import { useEffect, useRef, useState } from "react"

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
  const [bookmarks, setBookmarks] = useState<BookmarkInfo[]>([])
  const [filteredItems, setFilteredItems] = useState<
    (TabInfo | BookmarkInfo)[]
  >([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentTabIds, setRecentTabIds] = useState<number[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)
  const eventRef = useRef<{
    handleKeyDown: (e: KeyboardEvent) => void
    handleKeyUp: (e: KeyboardEvent) => void
  }>({
    handleKeyDown: () => {},
    handleKeyUp: () => {}
  })
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
      if (!searchTerm.trim()) {
        const recentTabs = tabs
          .filter((tab) => recentTabIds.includes(tab.id))
          .sort((a, b) => recentTabIds.indexOf(a.id) - recentTabIds.indexOf(b.id))
        setFilteredItems(recentTabs)
        return
      }
  
      // 否则，搜索标签和书签
      const term = searchTerm.toLowerCase()
  
      // 过滤并排序标签
      const filteredTabs = tabs.filter(
        (tab) =>
          tab.title.toLowerCase().includes(term) ||
          new URL(tab.url).hostname.toLowerCase().includes(term)
      )
  
      // 合并结果，标签优先显示
      const allItems = [...filteredTabs]
  
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

      // const bookmarkResponse = await sendToBackground({
      //   name: "getBookmarks",
      //   body: { text: term }
      // })
      // if (bookmarkResponse.success) {
      //   allItems.push(...bookmarkResponse.bookmarks)
      // }
  
      setFilteredItems(allItems)
      setSelectedIndex(0)
    })()
  }, [searchTerm, tabs, bookmarks, recentTabIds])

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

  eventRef.current = {
    handleKeyDown: (e: KeyboardEvent) => {
      // 数字键 1-9 直接选择对应索引的标签
      // 如果不在搜索框中，或在搜索框但没有文本
      if (
        (document.activeElement !== searchInputRef.current ||
          (document.activeElement === searchInputRef.current && !searchTerm)) &&
        /^[1-9]$/.test(e.key)
      ) {
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
          if (searchTerm) {
            // 如果有搜索内容，先清空搜索
            setSearchTerm("")
            searchInputRef.current?.focus()
          } else {
            onClose()
          }
          break
        case "/":
          // 快速聚焦到搜索框
          if (document.activeElement !== searchInputRef.current) {
            e.preventDefault()
            searchInputRef.current?.focus()
          }
          break
      }
    },
    handleKeyUp: (e: KeyboardEvent) => {
      log(activeIndex)
      if (e.key === "Meta" && activeIndex > 1) {
        handleItemSelect(selectedIndex)
      }
    }
  }

  useEffect(() => {
    if (activeIndex > 0 && filteredItems.length > 0) {
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length)
    }
  }, [activeIndex])

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
    const isBookmark = "type" in item && item.type === "bookmark"

    const isRecent = recentTabIds.includes(item.id)
    const tab = !isBookmark ? item : {
      id: item.id,
      title: item.title,
      url: item.url,
      favIconUrl: item.favIconUrl,
      lastAccessed: ""
    }
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
        <div className="plasmo-p-4 plasmo-bg-gray-100 plasmo-border-b plasmo-border-gray-200">
          <div className="plasmo-relative">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索标签和书签..."
              className="plasmo-w-full plasmo-p-2 plasmo-pl-8 plasmo-border plasmo-border-gray-300 plasmo-rounded plasmo-text-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500"
            />
            <svg
              className="plasmo-absolute plasmo-left-2.5 plasmo-top-2.5 plasmo-h-4 plasmo-w-4 plasmo-text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="plasmo-p-8 plasmo-text-center plasmo-text-gray-500">
            {tabs.length === 0
              ? "没有标签记录"
              : searchTerm
                ? "没有匹配的标签"
                : "输入关键词搜索标签"}
          </div>
        ) : (
          <div className={listClassName}>
            {filteredItems.map((item, index) => renderItem(item, index))}
          </div>
        )}

        <div className="plasmo-p-3 plasmo-bg-gray-50 plasmo-text-center plasmo-text-xs plasmo-text-gray-500">
          方向键↑↓导航 • / 聚焦搜索 • 数字键(1-
          {Math.min(9, filteredItems.length)})直接选择 • ESC 取消
        </div>
      </div>
    </div>
  )
}
