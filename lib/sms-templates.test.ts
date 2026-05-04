import {
  noCardCardLink,
  cardSavedOrderRecap,
  cardSavedNoOrder,
  paymentFailedT0,
  paymentFailedNudge,
  paymentFailedCancelled,
  unparseableFallback,
} from './sms-templates'

// Worst-case variable values per spec
const WINE = 'A'.repeat(30)     // 30-char wine name
const N = 24                    // up to 24 bottles
const TOTAL = '999.99'
const LAST4 = '1234'
const APP_URL = 'https://thecellar.club'
const TOKEN = 'AbCdEfGh'        // 8-char short token

describe('SMS templates ≤160 GSM-7 chars at worst-case variable lengths', () => {
  test('noCardCardLink', () => {
    expect(noCardCardLink(N, WINE, TOTAL, APP_URL, TOKEN).length).toBeLessThanOrEqual(160)
  })

  test('cardSavedOrderRecap', () => {
    expect(cardSavedOrderRecap(N, WINE, TOTAL, LAST4).length).toBeLessThanOrEqual(160)
  })

  test('cardSavedNoOrder', () => {
    expect(cardSavedNoOrder().length).toBeLessThanOrEqual(160)
  })

  test('paymentFailedT0', () => {
    expect(paymentFailedT0(N, APP_URL, TOKEN).length).toBeLessThanOrEqual(160)
  })

  test('paymentFailedNudge', () => {
    expect(paymentFailedNudge(N, APP_URL, TOKEN).length).toBeLessThanOrEqual(160)
  })

  test('paymentFailedCancelled', () => {
    expect(paymentFailedCancelled().length).toBeLessThanOrEqual(160)
  })

  test('unparseableFallback', () => {
    expect(unparseableFallback().length).toBeLessThanOrEqual(160)
  })
})
