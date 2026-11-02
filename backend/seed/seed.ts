import { createReadStream, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'
import type { PoolClient } from 'pg'
import { from as copyFrom } from 'pg-copy-streams'
import { connect } from '../src/shared/boilerplate/data-source'
import { seedPriceLists } from './price-lists'

const DATA = join(__dirname, '..', 'data')
const SALESFORCE_SCHEMA = join(__dirname, '..', '..', 'salesforce', 'schema.sql')

/** Creates the tables, empties them, loads data/*.csv.gz (one file per table) and the contract price lists, then resets the toy Salesforce. */
async function seed() {
  const db = await connect()
  await db.query(readFileSync(SALESFORCE_SCHEMA, 'utf8'))

  const files = readdirSync(DATA).filter((file) => file.endsWith('.csv.gz')).sort()
  const tables = files.map((file) => file.replace(/\.csv\.gz$/, ''))
  // Every table the backend owns starts empty, including tables no CSV file fills.
  const owned = db.entityMetadatas.map((entity) => `"${entity.schema}"."${entity.tableName}"`)
  await db.query(`TRUNCATE ${owned.join(', ')} CASCADE`)

  const client = (await (db.driver as unknown as { master: { connect(): Promise<PoolClient> } }).master.connect()) as PoolClient
  try {
    for (const [i, file] of files.entries()) {
      const path = join(DATA, file)
      const columns = (await header(path)).map((c) => (tables[i].startsWith('salesforce.') ? c : `"${c}"`))
      await pipeline(
        createReadStream(path),
        createGunzip(),
        client.query(copyFrom(`COPY ${qualified(tables[i])} (${columns.join(', ')}) FROM STDIN WITH (FORMAT csv, HEADER true)`)),
      )
      const [{ count }] = (await client.query(`SELECT count(*)::int AS count FROM ${qualified(tables[i])}`)).rows
      console.log(`${tables[i].padEnd(42)} ${String(count).padStart(8)}`)
    }
  } finally {
    client.release()
  }
  await seedPriceLists(db)
  await db.destroy()
  await resetSalesforce()
}

/** workorders.work_order -> "workorders"."work_order"; Salesforce names stay unquoted, as schema.sql creates them. */
function qualified(table: string): string {
  const [schema, name] = table.split('.')
  return schema === 'salesforce' ? table : `"${schema}"."${name}"`
}

async function header(path: string): Promise<string[]> {
  let line = ''
  for await (const chunk of createReadStream(path).pipe(createGunzip())) {
    line += chunk.toString()
    const end = line.indexOf('\n')
    if (end >= 0) return JSON.parse(`[${line.slice(0, end)}]`)
  }
  throw new Error(`${path} is empty`)
}

/** The toy Salesforce reloads its org from the salesforce schema. */
async function resetSalesforce() {
  const url = process.env.SALESFORCE_URL ?? 'http://localhost:4001'
  await fetch(`${url}/toy/reset`, { method: 'POST' })
    .then(() => console.log('Reset the toy Salesforce'))
    .catch(() => console.log(`Toy Salesforce not running at ${url}; it loads the org when it starts`))
}

seed().catch((error) => {
  console.error(error)
  process.exit(1)
})
