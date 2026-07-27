import type { HTMLAttributes, ReactNode } from 'react'
import { radii } from '../lib/designTokens'

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  decoration?: 'tape' | 'tack' | 'none'
}

export function SketchCard({ children, decoration = 'none', className = '', ...props }: Props) {
  return (
    <div
      {...props}
      style={{ borderRadius: radii.wobblyMd, ...props.style }}
      className={`relative border-2 border-pencil bg-white shadow-hard-soft ${className}`}
    >
      {decoration === 'tape' && <span className="tape" aria-hidden="true" />}
      {decoration === 'tack' && <span className="tack" aria-hidden="true" />}
      {children}
    </div>
  )
}
