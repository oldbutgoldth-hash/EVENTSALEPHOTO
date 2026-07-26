type BrandLogoProps = {
  className?: string
  priority?: boolean
  admin?: boolean
}

export function BrandLogo({ className = '', priority = false, admin = false }: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <img
        src="/brand/koake-event-photo-logo.png"
        alt={admin ? "KO’AKE Event Photo Admin" : "KO’AKE Event Photo"}
        className="h-full w-auto select-none object-contain mix-blend-multiply"
        draggable={false}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
      />
      {admin && <span className="sr-only">Admin</span>}
    </span>
  )
}
