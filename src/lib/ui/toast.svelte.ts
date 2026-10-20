export interface ToastItem {
  id: number
  message: string
  action?: { label: string; run: () => void }
}

class Toasts {
  items = $state<ToastItem[]>([])
  private seq = 0

  show(message: string, action?: ToastItem['action'], ms = 5000): number {
    const id = ++this.seq
    this.items = [...this.items.slice(-2), { id, message, action }]
    setTimeout(() => this.dismiss(id), ms)
    return id
  }

  dismiss(id: number): void {
    this.items = this.items.filter(t => t.id !== id)
  }
}

export const toasts = new Toasts()
