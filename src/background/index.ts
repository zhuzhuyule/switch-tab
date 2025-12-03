import { Storage } from "@plasmohq/storage"
import "@plasmohq/messaging/background"
import { cleanupIconCache } from "./services/iconService"
import status from "./status"

// 设置最大记录的标签数量
const MAX_RECENT_TABS = 8

// 初始化存储实例，使用 local 存储区域
const storage = new Storage({ area: "local" })

// 获取最近访问的标签
async function getRecentTabs(): Promise<TabInfo[]> {
  const tabs = await storage.get<TabInfo[]>("recentTabs")
  return tabs || []
}

// 初始化或更新标签访问计数
async function updateTabAccessCount(tabUrl: string) {
  try {
    const url = new URL(tabUrl)
    const hostWithPath = `${url.host}${url.pathname}`
    // 获取当前的访问计数
    let tabAccessCounts =
      (await storage.get<Record<number, number>>("tabAccessCounts")) || {}

    // 更新当前标签的访问计数
    tabAccessCounts[hostWithPath] = (tabAccessCounts[hostWithPath] || 0) + 1

    // 存储更新后的访问计数
    await storage.set("tabAccessCounts", tabAccessCounts)

    console.log(
      `Tab ${tabUrl} access count updated to ${tabAccessCounts[hostWithPath]}`
    )
  } catch (error) {
    console.error("更新标签访问计数时出错:", error)
  }
}

// 更新最近访问的标签
async function updateRecentTabs(tabInfo: TabInfo) {
  // 获取当前的标签历史
  let recentTabs = await getRecentTabs()

  // 过滤掉当前标签（如果已存在）
  recentTabs = recentTabs.filter((tab) => tab.id !== tabInfo.id)

  // 将当前标签添加到列表开头
  recentTabs.unshift(tabInfo)

  // 始终按最后访问时间排序，避免事件顺序异常导致的记录错误
  recentTabs = recentTabs.sort(
    (a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0)
  )

  // 如果超过最大数量，删除最后一个
  if (recentTabs.length > MAX_RECENT_TABS) {
    recentTabs = recentTabs.slice(0, MAX_RECENT_TABS)
  }

  // 存储更新后的标签列表
  await storage.set("recentTabs", recentTabs)

  // 更新标签访问计数
  await updateTabAccessCount(tabInfo.url)

  console.log("Recent tabs updated:", recentTabs)
}

// 处理标签激活事件
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    // 获取激活的标签详细信息
    const tab = await chrome.tabs.get(activeInfo.tabId)

    // 忽略开发者工具和空白标签
    if (
      tab.url?.startsWith("chrome-devtools://") ||
      tab.url === "about:blank" ||
      tab.url === "edge://newtab/"
    ) {
      return
    }

    // 创建标签信息对象
    const tabInfo: TabInfo = {
      id: tab.id,
      title: tab.title || "无标题",
      url: tab.url || "",
      favIconUrl: tab.favIconUrl || "",
      lastAccessed: tab.lastAccessed || Date.now()
    }

    // 更新最近标签列表
    await updateRecentTabs(tabInfo)
  } catch (error) {
    console.error("标签监听错误:", error)
  }
})

// 处理标签更新事件（标题或URL变化时）
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // 仅在标题或图标更新时处理
  if (changeInfo.title || changeInfo.favIconUrl) {
    // 检查这个标签是否是当前激活的标签
    const currentTab = await chrome.tabs.query({
      active: true,
      currentWindow: true
    })

    if (currentTab.length > 0 && currentTab[0].id === tabId) {
      // 创建标签信息对象
      const tabInfo: TabInfo = {
        id: tab.id,
        title: tab.title || "无标题",
        url: tab.url || "",
        favIconUrl: tab.favIconUrl || "",
        lastAccessed: tab.lastAccessed || Date.now()
      }

      // 更新最近标签列表
      await updateRecentTabs(tabInfo)
    }
  }
})

// 处理标签关闭事件
chrome.tabs.onRemoved.addListener(async (tabId) => {
  // 获取当前的标签历史
  let recentTabs = await getRecentTabs()

  // 过滤掉关闭的标签
  recentTabs = recentTabs.filter((tab) => tab.id !== tabId)

  // 存储更新后的标签列表
  await storage.set("recentTabs", recentTabs)

  console.log("标签已从历史中移除:", tabId)
})

// 打开弹出窗口
async function openPopup() {
  await chrome.action.openPopup()
}

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "log") {
    console.log("---------", ...message.message)
  }
})

async function sendMessageToContentScript(tabId, message) {
  try {
    // 尝试发送消息
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    console.error("发送消息失败:", error);
    
    // 检查是否是因为内容脚本未加载
    if (error.message.includes("Could not establish connection") ||
        error.message.includes("No tab with id") ||
        error.message.includes("Receiving end does not exist")) {
      
      // 尝试注入内容脚本
      console.log("尝试动态注入内容脚本...");
      try {
        // 获取 mainfest.json 中配置了 content_scripts 的 js 文件
        const manifest = chrome.runtime.getManifest()
        const contentFile = manifest.content_scripts[0].js

        // 注入内容脚本
        await chrome.scripting.executeScript({
          target: { tabId },
          files: contentFile // 或者您内容脚本的实际路径
        });
        
        // 给脚本一点时间初始化
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 重新尝试发送消息
        return await chrome.tabs.sendMessage(tabId, message);
      } catch (injectionError) {
        console.error("注入内容脚本失败:", injectionError);
        throw injectionError;
      }
    }
    
    throw error;
  }
}

const retrySendMessage = async (
  id: number,
  message: any,
  timeout = 1000,
  retry = 5
) => {
  try {
    return await sendMessageToContentScript(id, message)
  } catch (error) {
    if (retry <= 1) {
      throw error
    }
    const t = Math.max(timeout / 10, 200)
    await new Promise((resolve) => setTimeout(resolve, t))
    return retrySendMessage(id, message, t, retry - 1)
  }
}

const trySendMessage = async (
  id: number,
  message: any,
  timeout = 1000,
  retry = 5
) => {
  return Promise.race([
    retrySendMessage(id, message, timeout, retry),
    new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error("发送消息超时"))
      }, timeout)
    })
  ])
}

let isSendingCommand = false

// 监听命令事件（快捷键）
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-recent-tabs" && !isSendingCommand) {
    isSendingCommand = true
    console.log("触发了快速标签切换命令")

    if (status.getPopupStatus()) {
      try {
        const res = await chrome.runtime.sendMessage({
          action: "changeSelectedIndex",
          message: "Change Popup Selected Index"
        })
        isSendingCommand = false
        return
      } catch (error) {
        status.setPopupStatus(false)
      }
    }

    try {
      // 获取当前激活的标签
      const [currentTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })

      if (!currentTab || !currentTab.id) {
        console.log("无法获取当前标签")
        isSendingCommand = false
        return
      }

      // 检查当前页面是否能使用内容脚本
      const regex = /^(http:\/\/|https:\/\/|ftp:\/\/|file:\/\/)/i

      const canUseContent = regex.test(currentTab.url)

      if (canUseContent) {
        // 向内容脚本发送消息，显示标签切换界面
        try {
          await trySendMessage(
            currentTab.id,
            {
              action: "showRecentTabs"
            },
            800
          )
          console.log("已向内容脚本发送显示命令")
        } catch (error) {
          console.error("发送消息失败，可能内容脚本未加载:", error)
          // 如果发送消息失败，则使用弹出窗口作为备选方案
          await openPopup()
        }
      } else {
        // 在特殊页面中，通过打开popup的方式显示
        console.log("当前页面不支持内容脚本，将使用popup模式")
        await openPopup()
      }
    } catch (error) {
      console.error("处理命令时出错:", error)
    }
    isSendingCommand = false
  }
})

// 初始化函数，用于设置初始状态
async function initialize() {
  // 确保存储区有一个有效的 recentTabs 数组
  const existingTabs = await storage.get<TabInfo[]>("recentTabs")
  if (!existingTabs) {
    await storage.set("recentTabs", [])
  }

  // 确保存储区有一个有效的 tabAccessCounts 对象
  const existingAccessCounts =
    await storage.get<Record<string, number>>("tabAccessCounts")
    
  if (!existingAccessCounts) {
    await storage.set("tabAccessCounts", {})
  }

  // 清理图标缓存
  await cleanupIconCache()

  // 设置每天清理一次缓存
  setInterval(cleanupIconCache, 24 * 60 * 60 * 1000)

  console.log("标签历史跟踪系统已初始化")
}

// 当扩展加载时初始化
initialize()

console.log("标签历史跟踪系统已启动")
