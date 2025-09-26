import { useCallback, useEffect, useState } from "react"
import { sendToBackground } from "@plasmohq/messaging"
import { TabSwitcher } from "~components/TabSwitcher"
import "~style.css"


function IndexPopup() {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    window.focus()
    const closePopup = () => {
      sendToBackground({ name: "updatePopupOpen", body: { isOpen: false } })
    }
    sendToBackground({ name: "updatePopupOpen", body: { isOpen: true } })
    window.addEventListener("beforeunload", closePopup)

    // 监听来自背景脚本的消息
    const messageListener = (message, sender, sendResponse) => {
      if (message.action === "changeSelectedIndex") {
        setActiveIndex((pre) => pre + 1)
        sendResponse({ success: true, type: "popup" })
        return true
      }
    }
    // 添加消息监听器
    chrome.runtime.onMessage.addListener(messageListener)
    // 清理函数
    return () => {
      closePopup()
      chrome.runtime.onMessage.removeListener(messageListener)
      window.removeEventListener("beforeunload", closePopup)
    }
  }, [])

  const handleClose = useCallback(() => {
    setActiveIndex(0)
    window.close()
  }, [])

  return (
    <div className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-w-full plasmo-h-full plasmo-bg-white">
      <TabSwitcher
        onClose={handleClose}
        isPopup={true}
        activeIndex={activeIndex}
      />
    </div>
  )
}

export default IndexPopup
