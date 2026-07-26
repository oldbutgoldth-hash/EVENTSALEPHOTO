const queryEvent = new URLSearchParams(window.location.search).get('event')

export const runtimeConfig = {
  dataMode: (import.meta.env.VITE_DATA_MODE || 'demo') as 'demo' | 'live',
  siteUrl: import.meta.env.VITE_SITE_URL || window.location.origin,
  eventShareToken: queryEvent || import.meta.env.VITE_EVENT_SHARE_TOKEN || 'demo-sport-day-2569',
  imageKitUrlEndpoint: import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT || '',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
}

export const isLiveMode = runtimeConfig.dataMode === 'live'
