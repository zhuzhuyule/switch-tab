
export const log = (...args: any[]) => {
  chrome.runtime.sendMessage({
    action: "log",
    message: args
  })
}
