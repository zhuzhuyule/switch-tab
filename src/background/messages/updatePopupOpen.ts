import type { PlasmoMessaging } from "@plasmohq/messaging"
import status from "../status"

// 请求体接口
interface RequestBody {
  isOpen: boolean
}

// 消息处理函数
const handler: PlasmoMessaging.MessageHandler<RequestBody> = async (req, res) => {
  try {
    const { isOpen } = req.body
    status.setPopupStatus(!!isOpen)
    
    // 发送成功响应
    res.send({
      success: true,
      message: "已更新"
    })
  } catch (error) {
    console.error("更新弹窗状态时出错:", error)
    
    // 发送错误响应
    res.send({
      success: false,
      error: error.message
    })
  }
}

export default handler 
