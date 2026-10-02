import { observer } from 'mobx-react-lite'
import { useEffect, useRef } from 'react'
import { IssueModal } from './components/IssueModal'
import type { AppController } from './state/AppController'
import { shortcutForKeyEvent } from './state/shortcuts'

export const App = observer(function App({ app }: { app: AppController }) {
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const { titleFocusRequest } = app

  useEffect(() => {
    titleRef.current?.focus()
  }, [titleFocusRequest])

  useEffect(() => {
    // Capture phase, so ⌘-shortcuts win over the editor's own bindings (Tiptap maps ⌘↩ to a line break).
    const onShortcut = (event: KeyboardEvent) => {
      const shortcut = shortcutForKeyEvent(event)
      if (!shortcut) return
      event.preventDefault()
      event.stopPropagation()
      app.runShortcut(shortcut)
    }
    // Bubble phase: an open picker handles Escape first and marks it handled; only an unhandled Escape hides the panel.
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      app.hide()
    }
    window.addEventListener('keydown', onShortcut, true)
    window.addEventListener('keydown', onEscape)
    return () => {
      window.removeEventListener('keydown', onShortcut, true)
      window.removeEventListener('keydown', onEscape)
    }
  }, [app])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const observer = new ResizeObserver(() => app.reportHeight(frame.getBoundingClientRect().height))
    observer.observe(frame)
    return () => observer.disconnect()
  }, [app])

  const restoreFocus = () => {
    // Moving from one picker straight to another (the "…" menu does) must leave focus in the new one.
    if (app.openPicker) return
    if (app.lastFocusedField === 'description') app.editor.focus()
    else titleRef.current?.focus()
  }

  // While a picker is open the window grows by this much below the card, so the list can drop down
  // like Linear's instead of being squeezed into the card's height. 360px fits a full list and its search box.
  const pickerRoom = app.openPicker ? 360 : 0

  return (
    // The padding leaves room for the card's shadow inside the transparent native window.
    <div ref={frameRef} className="p-6" style={{ paddingBottom: 24 + pickerRoom }}>
      <IssueModal app={app} titleRef={titleRef} onPickerClosed={restoreFocus} />
    </div>
  )
})
