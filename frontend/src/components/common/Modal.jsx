import { useEffect } from 'react'
import Button from './Button'

export default function Modal({ open, onClose, title, children, footer, size = 'md', onSubmit }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  const body = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-brand-100 px-5 py-4">
          {footer}
        </div>
      )}
    </>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close overlay"
        className="interactive-exempt absolute inset-0 cursor-pointer bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className={`relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${widths[size]}`}
      >
        <div className="flex items-center justify-between border-b border-brand-100 px-5 py-4">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <Button variant="ghost" size="sm" type="button" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>
        {onSubmit ? (
          <form
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onSubmit={(e) => {
              e.preventDefault()
              onSubmit(e)
            }}
          >
            {body}
          </form>
        ) : (
          body
        )}
      </div>
    </div>
  )
}
