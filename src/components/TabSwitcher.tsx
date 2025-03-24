import { useEffect, useRef, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"

import { log } from "~debug-tool"

// 定义标签信息接口
interface TabInfo {
  id: number
  title: string
  url: string
  favIconUrl: string
  lastAccessed?: number
  accessCount?: number
  windowId?: number
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
  const [filteredTabs, setFilteredTabs] = useState<TabInfo[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentTabIds, setRecentTabIds] = useState<number[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const eventRef = useRef<{
    handleKeyDown: (e: KeyboardEvent) => void
    handleKeyUp: (e: KeyboardEvent) => void
  }>({
    handleKeyDown: () => {},
    handleKeyUp: () => {}
  })

  // 根据搜索词过滤标签
  useEffect(() => {
    if (!tabs.length) return;
    
    // 如果没有搜索词，只显示最近的标签（或不显示任何标签）
    if (!searchTerm.trim()) {
      // 只显示最近访问的标签
      const recentOnly = tabs.filter(tab => recentTabIds.includes(tab.id))
        .sort((a, b) => {
          return recentTabIds.indexOf(a.id) - recentTabIds.indexOf(b.id);
        });
      setFilteredTabs(recentOnly);
      return;
    }
    
    // 否则，搜索所有标签
    let filtered = [...tabs];
    const term = searchTerm.toLowerCase();
    
    filtered = filtered.filter(
      tab => 
        tab.title.toLowerCase().includes(term) || 
        new URL(tab.url).hostname.toLowerCase().includes(term)
    );
    
    // 对过滤后的标签进行排序
    filtered.sort((a, b) => {
      // 先按照是否在最近访问的6个标签中排序
      const aIsRecent = recentTabIds.includes(a.id);
      const bIsRecent = recentTabIds.includes(b.id);
      
      if (aIsRecent && !bIsRecent) return -1;
      if (!aIsRecent && bIsRecent) return 1;
      
      // 如果两者都是/都不是最近的标签，则按照最近访问的标签中的顺序排序
      if (aIsRecent && bIsRecent) {
        return recentTabIds.indexOf(a.id) - recentTabIds.indexOf(b.id);
      }
      
      // 如果两者都不是最近的标签，则按照访问次数排序
      return (b.accessCount || 0) - (a.accessCount || 0);
    });
    
    setFilteredTabs(filtered);
    setSelectedIndex(0); // 重置选中项
  }, [searchTerm, tabs, recentTabIds]);

  eventRef.current = {
    handleKeyDown: (e: KeyboardEvent) => {
      // 数字键 1-9 直接选择对应索引的标签
      // 如果不在搜索框中，或在搜索框但没有文本
      if (
        (document.activeElement !== searchInputRef.current || 
         (document.activeElement === searchInputRef.current && !searchTerm)) && 
        /^[1-9]$/.test(e.key)
      ) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= Math.min(9, filteredTabs.length)) {
          setSelectedIndex(num - 1);
          switchToSelectedTab(num - 1);
          return;
        }
      }
      
      // 如果焦点在搜索框中且不是导航键，不处理
      if (
        document.activeElement === searchInputRef.current &&
        !["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(e.key)
      ) {
        return;
      }

      if (!filteredTabs.length) return;
      
      switch (e.key) {
        case "ArrowDown":
        case "j":
          e.preventDefault(); // 防止页面滚动
          setSelectedIndex((prev) => (prev + 1) % filteredTabs.length);
          break;
        case "ArrowUp":
        case "k":
          e.preventDefault(); // 防止页面滚动
          setSelectedIndex((prev) => (prev - 1 + filteredTabs.length) % filteredTabs.length);
          break;
        case "Enter":
          switchToSelectedTab(selectedIndex);
          break;
        case "Escape":
          if (searchTerm) {
            // 如果有搜索内容，先清空搜索
            setSearchTerm("");
            searchInputRef.current?.focus();
          } else {
            onClose();
          }
          break;
        case "/":
          // 快速聚焦到搜索框
          if (document.activeElement !== searchInputRef.current) {
            e.preventDefault();
            searchInputRef.current?.focus();
          }
          break;
      }
    },
    handleKeyUp: (e: KeyboardEvent) => {
      log(activeIndex);
      if (e.key === "Meta" && activeIndex > 1) {
        switchToSelectedTab(selectedIndex);
      }
    }
  };

  useEffect(() => {
    if (activeIndex > 0 && filteredTabs.length > 0) {
      setSelectedIndex((prev) => (prev + 1) % filteredTabs.length);
    }
  }, [activeIndex]);

  // 获取所有标签并搜索
  const fetchAllTabs = async () => {
    try {
      const response = await sendToBackground({ name: "searchAllTabs" });

      if (response.success && response.tabs.length > 0) {
        setTabs(response.tabs);
        setRecentTabIds(response.recentTabs || []);
      } else {
        console.log("没有找到标签");
      }
    } catch (error) {
      console.error("获取标签时出错:", error);
    }
  };

  // 切换到选中的标签
  const switchToSelectedTab = async (selectedIndex: number) => {
    if (filteredTabs.length === 0 || selectedIndex >= filteredTabs.length) {
      return;
    }

    try {
      const selectedTab = filteredTabs[selectedIndex];
      await sendToBackground({
        name: "switchToTab",
        body: { tabId: selectedTab.id }
      });
      onClose();
    } catch (error) {
      console.error("切换标签时出错:", error);
    }
  };

  // 处理点击事件
  const handleTabClick = (
    index: number,
    e: React.MouseEvent<HTMLLIElement>
  ) => {
    e.stopPropagation();
    e.preventDefault();

    setSelectedIndex(index);
    switchToSelectedTab(index);
  };

  // 组件加载时获取标签列表
  useEffect(() => {
    fetchAllTabs();
    // 自动聚焦搜索框
    searchInputRef.current?.focus();
  }, []);

  // 设置和清理事件监听器
  useEffect(() => {
    // 处理键盘事件
    log("bind");
    const handleKeyDown = (e: KeyboardEvent) =>
      eventRef.current.handleKeyDown(e);
    const handleKeyUp = (e: KeyboardEvent) => eventRef.current.handleKeyUp(e);

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // 定义容器样式类名
  const containerClassName = isPopup
    ? "plasmo-flex plasmo-flex-col plasmo-w-[600px] plasmo-max-w-full plasmo-max-h-full plasmo-overflow-hidden"
    : "plasmo-fixed plasmo-inset-0 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-bg-black plasmo-bg-opacity-50 plasmo-z-50";

  // 定义列表容器样式类名
  const listContainerClassName = isPopup
    ? "plasmo-w-full plasmo-h-full plasmo-flex plasmo-flex-col plasmo-bg-white plasmo-overflow-hidden plasmo-rounded-lg"
    : "plasmo-w-[600px] plasmo-max-w-[80vw] plasmo-bg-white plasmo-rounded-lg plasmo-shadow-xl plasmo-overflow-hidden";

  // 定义列表样式类名
  const listClassName = isPopup
    ? "plasmo-flex-1 plasmo-overflow-y-auto"
    : "plasmo-max-h-[60vh] plasmo-overflow-y-auto";

  return (
    <div
      className={containerClassName}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}>
      <div ref={containerRef} className={listContainerClassName}>
        <div className="plasmo-p-4 plasmo-bg-gray-100 plasmo-border-b plasmo-border-gray-200">
          <div className="plasmo-relative">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索打开的标签页..."
              className="plasmo-w-full plasmo-p-2 plasmo-pl-8 plasmo-border plasmo-border-gray-300 plasmo-rounded plasmo-text-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500"
            />
            <svg 
              className="plasmo-absolute plasmo-left-2.5 plasmo-top-2.5 plasmo-h-4 plasmo-w-4 plasmo-text-gray-400" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {filteredTabs.length === 0 ? (
          <div className="plasmo-p-8 plasmo-text-center plasmo-text-gray-500">
            {tabs.length === 0 ? "没有标签记录" : searchTerm ? "没有匹配的标签" : "输入关键词搜索标签"}
          </div>
        ) : (
          <ul className={listClassName}>
            {filteredTabs.map((tab, index) => {
              const isRecent = recentTabIds.includes(tab.id);
              return (
                <li
                  key={tab.id}
                  className={`plasmo-flex plasmo-items-center plasmo-p-3 plasmo-border-b plasmo-border-gray-100 plasmo-cursor-pointer hover:plasmo-bg-gray-50 ${
                    selectedIndex === index ? "plasmo-bg-blue-100" : ""
                  } ${isRecent && selectedIndex !== index ? "plasmo-bg-blue-50 plasmo-bg-opacity-30" : ""}`}
                  onClick={(e) => handleTabClick(index, e)}>
                  <div className="plasmo-flex plasmo-items-center plasmo-w-8 plasmo-h-8 plasmo-mr-3 plasmo-justify-center">
                    <span className={`plasmo-inline-block plasmo-w-6 plasmo-h-6 plasmo-text-center plasmo-font-bold plasmo-rounded-full plasmo-leading-6 ${
                      isRecent ? "plasmo-text-white plasmo-bg-blue-500" : "plasmo-text-gray-500 plasmo-bg-gray-200"
                    }`}>
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
                  
                  {tab.accessCount !== undefined && (
                    <div className="plasmo-ml-2 plasmo-text-xs plasmo-text-gray-500 plasmo-bg-gray-100 plasmo-px-2 plasmo-py-1 plasmo-rounded">
                      访问: {tab.accessCount}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="plasmo-p-3 plasmo-bg-gray-50 plasmo-text-center plasmo-text-xs plasmo-text-gray-500">
          方向键↑↓导航 • / 聚焦搜索 • 数字键(1-{Math.min(9, filteredTabs.length)})直接选择 • ESC 取消
        </div>
      </div>
    </div>
  )
}
