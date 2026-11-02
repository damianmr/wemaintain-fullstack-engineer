import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DataSource } from 'typeorm'
import { importPriceList } from '../src/price-lists/commands/import-price-list'
import { PriceListContent } from '../src/price-lists/domain/price-list'
import { readLindenhomeList } from '../src/price-lists/infrastructure/csv/lindenhome'
import { readMeridianList } from '../src/price-lists/infrastructure/csv/meridian'

const PRICE_LISTS = join(__dirname, '..', '..', 'exploration', 'price-lists')

const SOURCES: { file: string; read: (text: string, file: string) => PriceListContent }[] = [
  { file: 'lindenhome-price-list.csv', read: readLindenhomeList },
  { file: 'meridian-sor-table-a.csv', read: readMeridianList },
]

/** Imports the two contract price lists of C1, one version per file content. */
export async function seedPriceLists(db: DataSource) {
  for (const { file, read } of SOURCES) {
    const text = readFileSync(join(PRICE_LISTS, file), 'utf8')
    const version = createHash('sha256').update(text).digest('hex').slice(0, 12)
    const list = await importPriceList({ content: read(text, file), version }, { db })
    console.log(`${`pricing: ${list.name}`.padEnd(42)} version ${list.version}`)
  }
}
