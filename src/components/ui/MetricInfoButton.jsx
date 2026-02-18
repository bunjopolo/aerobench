import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export const MetricInfoButton = ({ title = 'Metric Info', items = [] }) => {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const buttonRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return

    const updatePos = () => {
      const btn = buttonRef.current
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      const width = 320
      const margin = 8
      const left = Math.min(
        Math.max(margin, rect.right - width),
        window.innerWidth - width - margin
      )
      const top = Math.min(
        rect.bottom + 6,
        window.innerHeight - 220
      )
      setPos({ top, left })
    }

    const onDocClick = (e) => {
      if (buttonRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
    }

    updatePos()
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    document.addEventListener('mousedown', onDocClick)
    return () => {
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
      document.removeEventListener('mousedown', onDocClick)
    }
  }, [open])

  return (
    <div className="inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-4 h-4 rounded-full border border-dark-border text-xxs text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
        title="Show metric definitions"
        aria-label="Show metric definitions"
      >
        i
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[9999] w-80 max-w-[90vw] rounded-lg border border-dark-border bg-dark-card/95 p-2 shadow-xl text-xxs"
          style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
        >
          <div className="font-medium text-gray-200 mb-1">{title}</div>
          <div className="space-y-1">
            {items.map((item) => (
              <div key={item.label} className="text-gray-400">
                <span className="text-gray-200">{item.label}:</span> {item.description}
              </div>
            ))}
          </div>
        </div>
      , document.body)}
    </div>
  )
}
