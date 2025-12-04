import { useEffect, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"

import "~style.css"

const MIN_LIMIT = 4
const MAX_LIMIT = 8

function IndexOptions() {
  const [displayLimit, setDisplayLimit] = useState(6)
  const [layoutMode, setLayoutMode] = useState<"vertical" | "horizontal">("vertical")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadSettings = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await sendToBackground({ name: "getSettings" })
      if (res?.success && res.settings?.displayLimit) {
        setDisplayLimit(res.settings.displayLimit)
        setLayoutMode(
          res.settings.layoutMode === "horizontal" ? "horizontal" : "vertical"
        )
      } else {
        setError("无法获取设置")
      }
    } catch (err) {
      console.error(err)
      setError("获取设置失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const res = await sendToBackground({
        name: "setSettings",
        body: { displayLimit, layoutMode }
      })
      if (res?.success) {
        setMessage("设置已保存")
      } else {
        setError(res?.error || "保存失败")
      }
    } catch (err) {
      console.error(err)
      setError("保存失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="plasmo-min-h-screen plasmo-bg-slate-50 plasmo-text-slate-800 plasmo-p-6">
      <div className="plasmo-max-w-3xl plasmo-mx-auto plasmo-bg-white plasmo-rounded-xl plasmo-shadow-sm plasmo-border plasmo-border-slate-100 plasmo-p-6">
        <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-mb-6">
          <div>
            <h1 className="plasmo-text-2xl plasmo-font-semibold">Recent Switch 设置</h1>
            <p className="plasmo-text-sm plasmo-text-slate-500">
              配置在切换界面中显示的最近标签数量（至少支持 4 个）。
            </p>
          </div>
          <button
            onClick={loadSettings}
            className="plasmo-inline-flex plasmo-items-center plasmo-gap-2 plasmo-bg-blue-600 plasmo-text-white plasmo-px-4 plasmo-py-2 plasmo-rounded-lg hover:plasmo-bg-blue-700 plasmo-transition">
            {loading ? "刷新中..." : "重新载入"}
          </button>
        </div>

        {error && (
          <div className="plasmo-mb-4 plasmo-p-3 plasmo-rounded-lg plasmo-bg-red-50 plasmo-text-red-700 plasmo-border plasmo-border-red-100">
            {error}
          </div>
        )}

        {loading && (
          <div className="plasmo-text-slate-500 plasmo-text-sm">正在加载设置...</div>
        )}

        {!loading && (
          <div className="plasmo-space-y-4">
            <label className="plasmo-block">
              <span className="plasmo-text-sm plasmo-text-slate-600">显示数量</span>
              <div className="plasmo-flex plasmo-items-center plasmo-gap-3 plasmo-mt-2">
                <input
                  type="range"
                  min={MIN_LIMIT}
                  max={MAX_LIMIT}
                  value={displayLimit}
                  onChange={(e) => setDisplayLimit(Number(e.target.value))}
                  className="plasmo-flex-1"
                />
                <input
                  type="number"
                  min={MIN_LIMIT}
                  max={MAX_LIMIT}
                  value={displayLimit}
                  onChange={(e) => setDisplayLimit(Number(e.target.value))}
                  className="plasmo-w-20 plasmo-border plasmo-border-slate-200 plasmo-rounded plasmo-px-2 plasmo-py-1 plasmo-text-sm"
                />
              </div>
              <p className="plasmo-text-xs plasmo-text-slate-500 plasmo-mt-1">
                设定在切换面板中显示的最近标签数量，至少为 6，建议保持较小以便快速识别。
              </p>
            </label>

            <div className="plasmo-grid plasmo-grid-cols-1 sm:plasmo-grid-cols-2 plasmo-gap-3 plasmo-items-start">
              <div className="plasmo-space-y-2">
                <span className="plasmo-text-sm plasmo-text-slate-600">布局方向</span>
                <div className="plasmo-flex plasmo-gap-2">
                  <button
                    type="button"
                    onClick={() => setLayoutMode("vertical")}
                    className={`plasmo-flex-1 plasmo-rounded-lg plasmo-border plasmo-py-2 plasmo-text-sm plasmo-font-medium plasmo-transition ${layoutMode === "vertical"
                        ? "plasmo-bg-blue-50 plasmo-border-blue-200 plasmo-text-blue-700"
                        : "plasmo-bg-white plasmo-border-slate-200 hover:plasmo-border-slate-300"
                      }`}>
                    竖版
                  </button>
                  <button
                    type="button"
                    onClick={() => setLayoutMode("horizontal")}
                    className={`plasmo-flex-1 plasmo-rounded-lg plasmo-border plasmo-py-2 plasmo-text-sm plasmo-font-medium plasmo-transition ${layoutMode === "horizontal"
                        ? "plasmo-bg-blue-50 plasmo-border-blue-200 plasmo-text-blue-700"
                        : "plasmo-bg-white plasmo-border-slate-200 hover:plasmo-border-slate-300"
                      }`}>
                    横版
                  </button>
                </div>
                <p className="plasmo-text-xs plasmo-text-slate-500">
                  竖版以列表形式展示，横版以卡片预览方式展示。
                </p>
              </div>
            </div>

            <div className="plasmo-flex plasmo-items-center plasmo-gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="plasmo-inline-flex plasmo-items-center plasmo-gap-2 plasmo-bg-blue-600 plasmo-text-white plasmo-px-4 plasmo-py-2 plasmo-rounded-lg hover:plasmo-bg-blue-700 plasmo-transition disabled:plasmo-opacity-60">
                {saving ? "保存中..." : "保存设置"}
              </button>
              {message && (
                <span className="plasmo-text-sm plasmo-text-green-600">{message}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default IndexOptions
