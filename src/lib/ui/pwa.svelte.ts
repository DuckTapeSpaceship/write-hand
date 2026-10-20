// Service worker registration with an in-app update prompt, plus the
// install affordances: Chrome/Android's beforeinstallprompt and an iOS hint.
import { registerSW } from 'virtual:pwa-register'
import { toasts } from './toast.svelte'

export function startPwa(): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return
  const update = registerSW({
    onNeedRefresh() {
      toasts.show('A new version of Write-Hand is ready.', { label: 'Reload', run: () => void update(true) }, 60_000)
    },
    onOfflineReady() {
      toasts.show('Ready to work offline.')
    },
  })
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

class Install {
  /** Chrome/Edge/Android: a deferred install prompt. */
  deferred = $state<BeforeInstallPromptEvent | null>(null)
  standalone = $state(false)

  constructor() {
    if (typeof window === 'undefined') return
    this.standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
    addEventListener('beforeinstallprompt', e => {
      e.preventDefault()
      this.deferred = e as BeforeInstallPromptEvent
    })
    addEventListener('appinstalled', () => {
      this.deferred = null
      this.standalone = true
    })
  }

  /** iPhone/iPad Safari, not yet on the Home Screen. */
  get iosHint(): boolean {
    if (this.standalone || typeof navigator === 'undefined') return false
    const ua = navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    return ios
  }

  async prompt(): Promise<void> {
    const e = this.deferred
    if (!e) return
    await e.prompt()
    await e.userChoice
    this.deferred = null
  }
}

export const install = new Install()
