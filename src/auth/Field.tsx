import { createContext, useContext, useId, type InputHTMLAttributes, type ReactNode } from 'react'

const ErrorCtx = createContext<{ id: string; active: boolean } | null>(null)

/** Groups a form's fields and its FormAlert so inputs point at the error text (aria-describedby / aria-invalid). */
export function ErrorScope({ error, children }: { error: string | null; children: ReactNode }) {
  const id = useId()
  return <ErrorCtx.Provider value={{ id, active: error !== null && error !== '' }}>{children}</ErrorCtx.Provider>
}

/** Labelled input. */
export function Field({ label, ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  const err = useContext(ErrorCtx)
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={err?.active || undefined} aria-describedby={err?.active ? err.id : undefined} {...input} />
    </div>
  )
}

/** Error text for a form; always mounted so screen readers announce it when it appears. */
export function FormAlert({ message }: { message: string | null }) {
  const err = useContext(ErrorCtx)
  return <div role="alert" id={err?.id} className="form-alert">{message}</div>
}
