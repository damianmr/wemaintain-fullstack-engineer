import { InvalidPriceListError } from './errors'
import { checkPriceList, customerText, PriceListContent } from './price-list'

const list = (entries: PriceListContent['entries'], bands: PriceListContent['bands'] = []): PriceListContent => ({
  client: 'TEST',
  name: 'Test list',
  currency: 'EUR',
  sourceFile: 'test.csv',
  bands,
  entries,
  rules: [],
})

describe('a price list', () => {
  it('writes contract lines as the contract prints them', () => {
    expect(customerText({ code: '0435AS', wording: 'Remote alarm replacement', unit: 'each' })).toBe('0435AS Remote alarm replacement, each')
    expect(customerText({ code: '65', wording: 'Standby technician', unit: 'Per Man-hr' }, { label: 'After office hours' })).toBe(
      '65 Standby technician, Per Man-hr, after office hours',
    )
  })

  it('needs one rate per band, or a single rate when the list has no bands', () => {
    const bands = [{ code: 'OFFICE', label: 'Office hours', timeWindow: '' }, { code: 'AFTER_HOURS', label: 'After office hours', timeWindow: '' }]
    expect(() => checkPriceList(list([{ code: '1', section: 'A', wording: 'x', rates: [{ amount: 1 }] }]))).not.toThrow()
    expect(() => checkPriceList(list([{ code: '1', section: 'A', wording: 'x', rates: [{ bandCode: 'OFFICE', amount: 1 }] }], bands))).toThrow(InvalidPriceListError)
    expect(() => checkPriceList(list([{ code: '1', section: 'A', wording: 'x', rates: [{ amount: 1 }, { amount: 2 }] }]))).toThrow(InvalidPriceListError)
  })

  it('refuses the same code twice', () => {
    const entry = { code: '1', section: 'A', wording: 'x', rates: [{ amount: 1 }] }
    expect(() => checkPriceList(list([entry, entry]))).toThrow('appears twice')
  })
})
