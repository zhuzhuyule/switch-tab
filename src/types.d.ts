
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
