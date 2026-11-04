import { PriceListContent, RuleKind } from '../../domain/price-list'
import { readCsv } from './read-csv'

// As the table header prints them.
const BANDS = [
  { code: 'OFFICE', label: 'Office hours', timeWindow: 'Mon–Fri 08:30–18:00, Sat 08:30–13:30', column: 'office_hours_sgd' },
  { code: 'AFTER_HOURS', label: 'After office hours', timeWindow: 'Mon–Fri 18:01–08:29, Sat 00:01–08:29', column: 'after_office_hours_sgd' },
  { code: 'WEEKEND_HOLIDAY', label: 'Saturday afternoon, Sunday and public holidays', timeWindow: 'Sat 13:31–midnight, Sunday, public holidays', column: 'sat_pm_sun_ph_sgd' },
]

/** Meridian's Table A (Section V of the malls' maintenance agreements): every item priced in three time bands, SGD excluding GST. */
export function readMeridianList(text: string, sourceFile: string): PriceListContent {
  return {
    client: 'MERIDIAN_TABLE_A',
    name: 'Meridian Table A',
    currency: 'SGD',
    sourceFile,
    bands: BANDS.map(({ code, label, timeWindow }) => ({ code, label, timeWindow })),
    entries: readCsv(text).map((row) => ({
      code: row.no,
      section: 'Table A',
      wording: row.description,
      unit: row.uom || undefined,
      rates: BANDS.map((band) => ({ bandCode: band.code, amount: Number(row[band.column]) })),
    })),
    // Printed above the table, not as a row: typed in from the contract text.
    rules: [
      {
        kind: RuleKind.PERCENTAGE,
        value: 10,
        description: 'Star Rates: percentage adjustment to Star Rate items',
        appliesTo: 'agreed rates for work Table A does not list',
        source: 'Table A, clause 1',
      },
    ],
  }
}
