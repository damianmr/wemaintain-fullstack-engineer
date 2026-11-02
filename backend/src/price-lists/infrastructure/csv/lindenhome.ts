import { Entry, PriceListContent, Rule, RuleKind } from '../../domain/price-list'
import { readCsv } from './read-csv'

// The volume discounts print their range in words only ("11 to 50 units"); the parser tests check the wording.
const DISCOUNT_RANGES: Record<string, [number, number | undefined]> = { '5600AS': [11, 50], '5610AS': [51, undefined] }

/** Lindenhome AL's list (annex 2 of the lot 4 works contract): one price per row, no time bands, EUR excluding VAT. */
export function readLindenhomeList(text: string, sourceFile: string): PriceListContent {
  const entries: Entry[] = []
  const rules: Rule[] = []
  for (const row of readCsv(text)) {
    const source = `${sourceFile}, row ${row.code}`
    if (row.section === 'COEFFICIENT') {
      rules.push({ code: row.code, kind: RuleKind.INVOICE_MULTIPLIER, value: amount(row), description: row.designation, appliesTo: row.comment, source })
    } else if (row.section === 'DEDUCTIONS') {
      const [minQuantity, maxQuantity] = DISCOUNT_RANGES[row.code]
      rules.push({ code: row.code, kind: RuleKind.QUANTITY_DISCOUNT, value: amount(row), description: row.designation, appliesTo: row.comment, minQuantity, maxQuantity, source })
    } else {
      entries.push({
        code: row.code,
        section: row.section,
        wording: row.designation,
        unit: row.unit || undefined,
        notes: row.comment || undefined,
        rates: [{ amount: amount(row) }],
      })
    }
  }
  return { client: 'LINDENHOME_AL', name: 'Lindenhome AL', currency: 'EUR', sourceFile, bands: [], entries, rules }
}

function amount(row: Record<string, string>): number {
  const value = Number(row.unit_price_eur_excl_vat.replace('%', ''))
  if (!Number.isFinite(value)) throw new Error(`Lindenhome row ${row.code} has no readable price: ${row.unit_price_eur_excl_vat}`)
  return value
}
