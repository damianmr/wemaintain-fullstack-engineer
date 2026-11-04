import { InvalidPriceListError } from './errors'
import { checkPriceList, customerText, PriceListContent, RuleKind, ruleText } from './price-list'

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

  it('writes a rule as the contract prints it, to start the manual lines that follow it', () => {
    expect(ruleText({ code: '0097AS', kind: RuleKind.MULTIPLIER, value: 1.41, description: 'Coefficient on a part not on the price list' })).toBe(
      '0097AS Coefficient on a part not on the price list, x 1.41',
    )
    expect(ruleText({ code: '5600AS', kind: RuleKind.PERCENTAGE, value: 6, description: 'Unit discount for an order of 11 to 50 units' })).toBe(
      '5600AS Unit discount for an order of 11 to 50 units, 6%',
    )
    expect(ruleText({ code: null, kind: RuleKind.PERCENTAGE, value: 10, description: 'Star Rates: percentage adjustment to Star Rate items' })).toBe(
      'Star Rates: percentage adjustment to Star Rate items, 10%',
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
