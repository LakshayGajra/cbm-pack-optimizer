import { create } from 'zustand'

export interface CurrencyDef {
  code: string
  symbol: string
  label: string
  locale: string
}

export const CURRENCIES: CurrencyDef[] = [
  { code: 'INR', symbol: '₹', label: 'Indian Rupee', locale: 'en-IN' },
  { code: 'USD', symbol: '$', label: 'US Dollar', locale: 'en-US' },
  { code: 'EUR', symbol: '€', label: 'Euro', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', label: 'British Pound', locale: 'en-GB' },
  { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham', locale: 'ar-AE' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar', locale: 'en-SG' },
  { code: 'CNY', symbol: '¥', label: 'Chinese Yuan', locale: 'zh-CN' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen', locale: 'ja-JP' },
]

const STORAGE_KEY = 'cbm_settings'

function loadCurrency(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed.currency === 'string') return parsed.currency
    }
  } catch { /* ignore corrupt data */ }
  return 'INR'
}

interface SettingsStore {
  currency: string
  setCurrency: (currency: string) => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  currency: loadCurrency(),
  setCurrency: (currency) => {
    set({ currency })
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ currency }))
    } catch { /* quota exceeded — non-critical */ }
  },
}))
