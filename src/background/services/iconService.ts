import { Storage } from "@plasmohq/storage"

// 定义图标缓存结构
interface IconCacheItem {
  data: string;       // Base64编码图标数据
  timestamp: number;  // 缓存时间
}

// 初始化存储
const storage = new Storage({ area: "local" })

// 生成缓存键
function generateCacheKey(url: string): string {
  try {
    const { hostname, port } = new URL(url);
    return port ? `${hostname}:${port}` : hostname;
  } catch {
    return 'unknown';
  }
}

// 获取图标（先查缓存，没有则抓取）
export async function getIconForUrl(url: string): Promise<IconCacheItem> {
  const cacheKey = generateCacheKey(url);
  
  // 先尝试从缓存获取
  try {
    const cached = await storage.get<IconCacheItem>(`icon_${cacheKey}`);
    if (cached && Date.now() - cached.timestamp < 7 * 24 * 60 * 60 * 1000) { // 7天有效期
      return cached;
    }
  } catch (e) {
    console.log("读取图标缓存失败:", e);
  }
  
  // 创建默认图标数据（字母+颜色）
  const iconData: IconCacheItem = {
    data: "", // 此处留空，将由 fetchFavicon 填充
    timestamp: Date.now(),
  };
  
  // 尝试获取实际图标
  try {
    const favicon = await fetchFavicon(url);
    if (favicon) {
      iconData.data = favicon;
    }
  } catch (e) {
    console.error("获取图标失败:", e);
  }
  
  // 存入缓存
  await storage.set(`icon_${cacheKey}`, iconData);
  
  return iconData;
}

// 获取网站图标并转为Base64
async function fetchFavicon(iconUrl: string): Promise<string> {
  try {
    // 使用后台脚本特权获取图标，避免跨域问题
    const iconResponse = await fetch(iconUrl);
    const blob = await iconResponse.blob();
    return await blobToBase64(blob);
  } catch (e) {
    console.error("获取favicon失败:", e);
    return "";
  }
}

// Blob转Base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

// 定期清理过期缓存
export async function cleanupIconCache(): Promise<void> {
  try {
    const allItems = await storage.getAll();
    const now = Date.now();
    const expireTime = 30 * 24 * 60 * 60 * 1000; // 30天过期
    
    for (const [key, value] of Object.entries(allItems)) {
      const item = value as unknown as IconCacheItem;
      if (key.startsWith('icon_') && item.timestamp && now - item.timestamp > expireTime) {
        await storage.remove(key);
      }
    }
  } catch (e) {
    console.error("清理图标缓存失败:", e);
  }
} 
