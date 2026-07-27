import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { radii } from '../lib/designTokens'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'quiet'
}

export function SketchButton({ children, variant = 'primary', className = '', ...props }: Props) {
  const variants = {
    primary: 'bg-white hover:bg-marker hover:text-white border-pencil shadow-hard',
    secondary: 'bg-muted hover:bg-pen hover:text-white border-pencil shadow-hard',
    quiet: 'bg-transparent hover:bg-sticky border-transparent hover:border-pencil',
  }

  return (
    <button
      {...props}
      style={{ borderRadius: radii.wobbly }}
      className={`min-h-12 border-[3px] px-5 py-2 font-body text-xl font-bold transition-all duration-150 ease-out active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
