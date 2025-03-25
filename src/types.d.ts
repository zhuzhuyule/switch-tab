
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

// 定义标签信息接口
interface TabInfo {
  id: number
  title: string
  url: string
  favIconUrl: string
  lastAccessed: number
}

interface BookmarkInfo {
  id: string
  title: string
  url: string
  dateAdded?: number
  type: 'bookmark'
}
