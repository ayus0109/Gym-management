import { useLayoutEffect, useRef, type ReactNode } from 'react'

export default function ModalBackdrop({ children, label, onClose, dismissOutside = false }: {
  children: ReactNode
  label: string
  onClose: () => void
  dismissOutside?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return (
    <dialog ref={ref} aria-label={label} className="modal-backdrop"
      onCancel={event => { event.preventDefault(); onClose() }}
      onMouseDown={event => { if (dismissOutside && event.target === event.currentTarget) onClose() }}>
      {children}
    </dialog>
  )
}
