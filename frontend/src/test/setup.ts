import '@testing-library/jest-dom/vitest'

class NotificationStub {
  static permission: NotificationPermission = 'granted'

  static async requestPermission(): Promise<NotificationPermission> {
    NotificationStub.permission = 'granted'
    return 'granted'
  }
}

Object.defineProperty(window, 'Notification', {
  configurable: true,
  writable: true,
  value: NotificationStub,
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
})
