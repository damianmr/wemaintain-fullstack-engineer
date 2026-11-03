// A contract price list (Schedule of Rates) as printed in a client's contract.
// Each import is a version that never changes: a new price means a new version.
import { InvalidPriceListError } from './errors'

/** A rule printed in the list. It is not a price: C1 shows it, C4 will calculate with it. */
export enum RuleKind {
  // Lindenhome 0097AS: the supplier's invoice x 1.41 for a part not on the list.
  INVOICE_MULTIPLIER = 'INVOICE_MULTIPLIER',
  // Lindenhome 5600AS: 6% off per unit for 11 to 50 units of the same part.
  QUANTITY_DISCOUNT = 'QUANTITY_DISCOUNT',
  // Meridian clause 1: 10% adjustment on agreed rates for work Table A does not list.
  STAR_RATES_ADJUSTMENT = 'STAR_RATES_ADJUSTMENT',
}

export interface Band {
  code: string
  label: string
  timeWindow: string
}

export interface Entry {
  code: string
  section: string
  wording: string
  /** Missing when the list does not print one: the entry cannot be picked until someone confirms it. */
  unit?: string
  notes?: string
  /** One price per band, or a single price with no band when the list has no bands. */
  rates: { bandCode?: string; amount: number }[]
}

export interface Rule {
  code?: string
  kind: RuleKind
  value: number
  description: string
  appliesTo: string
  minQuantity?: number
  maxQuantity?: number
  /** Where the rule comes from: the CSV row, or the contract clause for rules typed in by hand. */
  source: string
}

/** One client's list, as read from its contract. */
export interface PriceListContent {
  client: string
  name: string
  currency: string
  sourceFile: string
  bands: Band[]
  entries: Entry[]
  rules: Rule[]
}

export const isPickable = (entry: { unit?: string | null }) => !!entry.unit

/** What the customer reads for a contract line: the row as the contract prints it, and the band when the line has one. */
export function customerText(entry: { code: string; wording: string; unit?: string | null }, band?: { label: string } | null): string {
  return [`${entry.code} ${entry.wording}`, entry.unit, band?.label.toLowerCase()].filter(Boolean).join(', ')
}

/** How a manual line that follows a rule starts on the customer's quote: the rule as the contract prints it, with its value. */
export function ruleText(rule: { code?: string | null; kind: RuleKind; value: number; description: string }): string {
  const value = rule.kind === RuleKind.INVOICE_MULTIPLIER ? `x ${Number(rule.value)}` : `${Number(rule.value)}%`
  return [rule.code, `${rule.description}, ${value}`].filter(Boolean).join(' ')
}

/** Refuses a list whose rates do not match its bands, so a band can never be missing from an entry. */
export function checkPriceList(list: PriceListContent): void {
  const bandCodes = list.bands.map((band) => band.code)
  const codes = new Set<string>()
  for (const entry of list.entries) {
    if (codes.has(entry.code)) throw new InvalidPriceListError(`${list.name}: entry ${entry.code} appears twice`)
    codes.add(entry.code)
    const rateBands = entry.rates.map((rate) => rate.bandCode ?? null)
    const expected = bandCodes.length ? bandCodes : [null]
    if (rateBands.length !== expected.length || expected.some((code) => !rateBands.includes(code))) {
      throw new InvalidPriceListError(`${list.name}: entry ${entry.code} must have one rate for each band (${expected.join(', ') || 'no band'})`)
    }
    if (entry.rates.some((rate) => !Number.isFinite(rate.amount) || rate.amount < 0)) {
      throw new InvalidPriceListError(`${list.name}: entry ${entry.code} has an invalid amount`)
    }
  }
}
