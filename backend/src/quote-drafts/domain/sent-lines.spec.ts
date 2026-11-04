import { observeSentLines } from './sent-lines'
import { LineKind, SentDraftLine } from './quote-draft'

const line = (id: string, kind: LineKind, unitPrice: number, quantity = 1): SentDraftLine => ({ id, kind, unitPrice, quantity })

describe('observing a quote presented to the customer', () => {
  it('counts a contract line only when it reached Salesforce unchanged', () => {
    const lines = [line('a', LineKind.CONTRACT, 1360), line('b', LineKind.CONTRACT, 533.43), line('c', LineKind.CONTRACT, 167, 8), line('d', LineKind.MANUAL, 437.1)]
    const sent = [
      { lineId: 'a', quantity: 1, unitPrice: 1360, discount: null },
      // Re-typed in Salesforce, as past quotes show (0430AS at EUR 330 instead of 533.43).
      { lineId: 'b', quantity: 1, unitPrice: 330, discount: null },
      { lineId: 'd', quantity: 1, unitPrice: 437.1, discount: null },
      { lineId: null, quantity: 1, unitPrice: 50, discount: null },
    ]
    expect(observeSentLines(lines, sent)).toEqual({
      contractLines: 3,
      atListPrice: 1,
      changedInSalesforce: 1,
      removedInSalesforce: 1,
      manualLines: 1,
      addedInSalesforce: 1,
    })
  })

  it('does not count a contract line given a discount in Salesforce', () => {
    expect(observeSentLines([line('a', LineKind.CONTRACT, 1360)], [{ lineId: 'a', quantity: 1, unitPrice: 1360, discount: 10 }]).atListPrice).toBe(0)
  })
})
