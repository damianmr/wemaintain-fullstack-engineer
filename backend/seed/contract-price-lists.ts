import type { DataSource } from 'typeorm'
import { linkContractToPriceList } from '../src/price-lists/commands/link-contract-to-price-list'

// The pilot contracts, each with evidence that the list applies (shaping/analysis/03-which-contract-uses-which-list.sql).
// Left out on purpose: Kembang's second contract 00017624 (no price evidence), North Gem 00016251 and Ardmoor's
// contracts (item 38 at other prices than Table A), and Lindenhome PM (its earlier list is not supplied).
const PILOT = [
  { contractNo: '00019814', client: 'LINDENHOME_AL', why: 'main AL contract: 89 past lines cite a list code at the list price' },
  { contractNo: '00016840', client: 'LINDENHOME_AL', why: 'R26-17700 was quoted 0435AS at the list price' },
  { contractNo: '00018461', client: 'MERIDIAN_TABLE_A', why: 'Kembang: 12 of 16 past lines at Table A prices' },
  { contractNo: '00016613', client: 'MERIDIAN_TABLE_A', why: 'MR Retail Trustee: contract read, 20 of 22 lines at Table A prices' },
  { contractNo: '00014296', client: 'MERIDIAN_TABLE_A', why: 'Lumière: contract read by the exploration' },
  { contractNo: '00016179', client: 'MERIDIAN_TABLE_A', why: 'Serava Mall: contract read, 9 of 11 lines at Table A prices' },
]

/** Switches the pilot contracts to quote drafts by linking them to their list. */
export async function seedContractPriceLists(db: DataSource) {
  for (const { contractNo, client } of PILOT) await linkContractToPriceList({ contractNo, client }, { db })
  console.log(`${'pricing: linked contracts'.padEnd(42)} ${String(PILOT.length).padStart(8)}`)
}
