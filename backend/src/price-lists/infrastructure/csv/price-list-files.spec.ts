import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkPriceList, isPickable, RuleKind } from '../../domain/price-list'
import { readLindenhomeList } from './lindenhome'
import { readMeridianList } from './meridian'
import { readCsv } from './read-csv'

const PRICE_LISTS = join(__dirname, '..', '..', '..', '..', '..', 'exploration', 'price-lists')
const file = (name: string) => readFileSync(join(PRICE_LISTS, name), 'utf8')

describe('readCsv', () => {
  it('keeps commas, quotes and line breaks inside quoted cells', () => {
    expect(readCsv('code,designation\r\n0001AS,"A, B and ""C""\nsecond line"\r\n')).toEqual([{ code: '0001AS', designation: 'A, B and "C"\nsecond line' }])
  })

  it('refuses a row with a missing cell', () => {
    expect(() => readCsv('a,b\none')).toThrow('1 cells instead of 2')
  })
})

describe('the Lindenhome list', () => {
  const list = readLindenhomeList(file('lindenhome-price-list.csv'), 'lindenhome-price-list.csv')
  const entry = (code: string) => list.entries.find((e) => e.code === code)!

  it('puts every one of the 394 rows in exactly one place: 389 priced entries and 5 rules', () => {
    expect(list.entries).toHaveLength(389)
    expect(list.rules.map((r) => r.code)).toEqual(['5050AS', '0097AS', '5510AS', '5600AS', '5610AS'])
    expect(list.entries.length + list.rules.length).toBe(readCsv(file('lindenhome-price-list.csv')).length)
    expect(() => checkPriceList(list)).not.toThrow()
  })

  it('has no time bands: labour time is chosen by code', () => {
    expect(list.bands).toEqual([])
    expect(entry('0001AS').rates).toEqual([{ amount: 103.72 }])
    expect(entry('0002AS')).toMatchObject({ rates: [{ amount: 108.97 }], notes: 'night (midnight - 6am), Sunday, public holiday' })
  })

  it('keeps multipliers and discounts as rules, never as prices', () => {
    expect(list.rules.find((r) => r.code === '0097AS')).toMatchObject({ kind: RuleKind.INVOICE_MULTIPLIER, value: 1.41 })
    const discount = list.rules.find((r) => r.code === '5600AS')!
    expect(discount).toMatchObject({ kind: RuleKind.QUANTITY_DISCOUNT, value: 6, minQuantity: 11, maxQuantity: 50 })
    expect(discount.description).toContain('11 to 50 units')
    expect(list.rules.find((r) => r.code === '5610AS')!.description).toContain('more than 50 units')
  })

  it('cannot pick an entry whose unit the list leaves blank', () => {
    expect(isPickable(entry('6056AS'))).toBe(false)
    expect(isPickable(entry('0435AS'))).toBe(true)
  })
})

describe('the Meridian list', () => {
  const list = readMeridianList(file('meridian-sor-table-a.csv'), 'meridian-sor-table-a.csv')

  it('prices every one of the 81 items in all three time bands', () => {
    expect(list.bands.map((b) => b.code)).toEqual(['OFFICE', 'AFTER_HOURS', 'WEEKEND_HOLIDAY'])
    expect(list.entries).toHaveLength(81)
    expect(list.entries.every((e) => e.rates.length === 3)).toBe(true)
    expect(() => checkPriceList(list)).not.toThrow()
  })

  it('keeps the standby technician at 111, 167 and 222 per man-hour', () => {
    expect(list.entries.find((e) => e.code === '65')).toMatchObject({ unit: 'Per Man-hr', rates: [{ amount: 111 }, { amount: 167 }, { amount: 222 }] })
  })

  it('records the Star Rates clause as a rule typed in from the contract text', () => {
    expect(list.rules).toEqual([expect.objectContaining({ kind: RuleKind.STAR_RATES_ADJUSTMENT, value: 10, source: 'Table A, clause 1' })])
  })
})
