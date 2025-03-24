import cssText from "data-text:~style.css"
import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"

import { TabSwitcher } from "~components/TabSwitcher"

// 内容脚本配置，匹配所有URL
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false
}

/**
 * 生成调整后的样式元素，以在 Shadow DOM 中正确工作。
 *
 * Tailwind CSS 依赖于 `rem` 单位，它基于根字体大小（通常在 <html> 或 <body> 元素上定义）。
 * 但在 Shadow DOM 中（如 Plasmo 使用的），没有本地根元素，因此 rem 值会引用实际页面的根字体大小，
 * 这通常会导致尺寸不一致。
 *
 * 为了解决这个问题，我们：
 * 1. 将 `:root` 选择器替换为 `:host(plasmo-csui)`，以在 Shadow DOM 内正确地限定样式范围。
 * 2. 将所有 `rem` 单位转换为像素值，使用固定的基本字体大小，确保样式一致，不受主页面字体大小的影响。
 */
export const getStyle = (): HTMLStyleElement => {
  const baseFontSize = 16

  let updatedCssText = cssText.replaceAll(":root", ":host(plasmo-csui)")
  const remRegex = /([\d.]+)rem/g
  updatedCssText = updatedCssText.replace(remRegex, (match, remValue) => {
    const pixelsValue = parseFloat(remValue) * baseFontSize
    return `${pixelsValue}px`
  })

  const styleElement = document.createElement("style")
  styleElement.textContent = updatedCssText

  return styleElement
}

// 内容脚本主组件
const TabSwitcherOverlay = () => {
  const [isVisible, setIsVisible] = useState(false)

  // 处理关闭事件
  const handleClose = () => {
    setIsVisible(false)
  }

  // 监听来自背景脚本的消息
  useEffect(() => {
    const messageListener = (message, sender, sendResponse) => {
      if (message.action === "showRecentTabs") {
        setIsVisible(true)
        sendResponse({ success: true })
        return true
      }
    }

    // 添加消息监听器
    chrome.runtime.onMessage.addListener(messageListener)

    // 清理函数
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener)
    }
  }, [])

  // 只有在显示状态下才渲染切换界面
  return isVisible ? <TabSwitcher onClose={handleClose} /> : null
}

export default TabSwitcherOverlay 
