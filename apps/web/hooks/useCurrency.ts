import { useState, useEffect } from 'react'

const NUMBER_FMT = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function useCurrency(baseCurrency: 'PEN' | 'USD') {
  const [liveRate, setLiveRate] = useState<number | null>(null)

  useEffect(() => {
    if (baseCurrency !== 'USD') return
    const today = new Date().toISOString().slice(0, 10)
    fetch(`/api/exchange-rate?date=${today}`)
      .then(r => r.json())
      .then(({ rate }) => { if (rate) setLiveRate(rate) })
      .catch(() => {})
  }, [baseCurrency])

  const sym = baseCurrency === 'USD' && liveRate ? '$' : 'S/'

  // PEN → moneda base
  function fromPen(pen: number): number {
    return baseCurrency === 'USD' && liveRate ? pen / liveRate : pen
  }

  // cualquier moneda → moneda base (para campos con su propio currency)
  function toBase(amount: number, fromCurrency: 'PEN' | 'USD'): number {
    if (fromCurrency === baseCurrency) return amount
    const inPen = fromCurrency === 'USD' ? (liveRate ? amount * liveRate : amount) : amount
    return fromPen(inPen)
  }

  function fmt(n: number) { return NUMBER_FMT.format(n) }

  return { sym, fromPen, toBase, fmt, liveRate }
}
