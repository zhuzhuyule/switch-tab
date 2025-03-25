import { type PlasmoMessaging } from "@plasmohq/messaging"

let bookmarks: BookmarkInfo[] = []

// 处理消息请求
export default async function handler(
  req: PlasmoMessaging.Request<{ text: string }>,
  res: PlasmoMessaging.Response
) {
  let filteredBookmarks: BookmarkInfo[] = []
  try {
    const { text } = req.body
    if (!bookmarks.length) {
      // 获取所有书签
      const bookmarkNodes = await chrome.bookmarks.getTree()

      // 递归遍历书签树
      const processNode = (node) => {
        if (node.url) {
          bookmarks.push({
            id: node.id,
            title: node.title || new URL(node.url).hostname,
            url: node.url,
            dateAdded: node.dateAdded,
            type: "bookmark"
          })
        }

        if (node.children) {
          for (const child of node.children) {
            processNode(child)
          }
        }
      }

      // 处理每个根节点
      bookmarkNodes.forEach((node) => {
        if (node.children) {
          node.children.forEach(processNode)
        }
      })
    }

    filteredBookmarks = bookmarks.filter((bookmark) =>
      bookmark.title.toLowerCase().includes(text.toLowerCase())
    ).sort((a, b) => a.dateAdded - b.dateAdded).slice(0, 10)
  } catch (error) {
    console.error("获取书签时出错:", error)
  }

  console.log("----filteredBookmarks------", filteredBookmarks)

  res.send({
    success: true,
    bookmarks: filteredBookmarks
  })
}
