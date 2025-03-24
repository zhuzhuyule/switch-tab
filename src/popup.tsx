import { TabSwitcher } from "~components/TabSwitcher"
import "~style.css"

function IndexPopup() {
  const handleClose = () => {
    window.close()
  }

  return (
    <div className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-w-full plasmo-h-full plasmo-bg-white">
      <TabSwitcher onClose={handleClose} isPopup={true} />
    </div>
  )
}

export default IndexPopup
