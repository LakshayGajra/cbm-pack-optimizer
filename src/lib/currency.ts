import { useSettingsStore, CURRENCIES, type CurrencyDef } from '../store/settingsStore'

export function formatCurrency(amount: number, currencyCode: string): string {
  const def = CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0]
  try {
    return new Intl.NumberFormat(def.locale, {
      style: 'currency',
      currency: def.code,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${def.symbol}${Math.round(amount).toLocaleString()}`
  }
}

/** React hook — returns a formatter bound to the current currency setting. */
export function useCurrencyFormatter(): (amount: number) => string {
  const currency = useSettingsStore((s) => s.currency)
  return (amount: number) => formatCurrency(amount, currency)
}

/** React hook — returns the symbol for the current currency (e.g. "₹", "$"). */
export function useCurrencySymbol(): string {
  const currency = useSettingsStore((s) => s.currency)
  return (CURRENCIES.find((c: CurrencyDef) => c.code === currency) ?? CURRENCIES[0]).symbol
}
