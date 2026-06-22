import { parseOrderReply } from './parse-order-reply'

describe('parseOrderReply', () => {
  const cases: [string, { kind: 'quantity'; quantity: number; ambiguous?: true } | { kind: 'unparseable' }][] = [
    ['2', { kind: 'quantity', quantity: 2 }],
    ['two', { kind: 'quantity', quantity: 2 }],
    ['3 bottles', { kind: 'quantity', quantity: 3 }],
    ["I'll take one bottle please", { kind: 'quantity', quantity: 1 }],
    ['a couple', { kind: 'quantity', quantity: 2 }],
    ['a bottle', { kind: 'quantity', quantity: 1 }],
    ['none', { kind: 'unparseable' }],
    ['no thanks', { kind: 'unparseable' }],
    ['2 or 3', { kind: 'quantity', quantity: 2, ambiguous: true }],
    ['!!!', { kind: 'unparseable' }],
    ['twelve', { kind: 'quantity', quantity: 12 }],
    ['', { kind: 'unparseable' }],
    ['   ', { kind: 'unparseable' }],
    ['4 plz', { kind: 'quantity', quantity: 4 }],
    ['could we have 2 of those please', { kind: 'quantity', quantity: 2 }],
    ['can I add one to my case?', { kind: 'quantity', quantity: 1 }],
  ]

  test.each(cases)('parseOrderReply(%j)', (input, expected) => {
    const result = parseOrderReply(input)
    expect(result.kind).toBe(expected.kind)
    if (expected.kind === 'quantity' && result.kind === 'quantity') {
      expect(result.quantity).toBe(expected.quantity)
      if (expected.ambiguous) {
        expect(result.ambiguous).toBe(true)
      }
    }
  })
})
