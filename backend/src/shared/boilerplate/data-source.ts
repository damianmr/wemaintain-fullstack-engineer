import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { BuildingOrmEntity } from '../../contracts/infrastructure/database/building.orm-entity'
import { ContractDeviceOrmEntity } from '../../contracts/infrastructure/database/contract-device.orm-entity'
import { ContractOrmEntity } from '../../contracts/infrastructure/database/contract.orm-entity'
import { CustomerOrmEntity } from '../../contracts/infrastructure/database/customer.orm-entity'
import { DeviceOrmEntity } from '../../contracts/infrastructure/database/device.orm-entity'
import { PartOrmEntity } from '../../parts/infrastructure/database/part.orm-entity'
import { ContractPriceListOrmEntity } from '../../price-lists/infrastructure/database/contract-price-list.orm-entity'
import { PriceListBandOrmEntity } from '../../price-lists/infrastructure/database/price-list-band.orm-entity'
import { PriceListEntryOrmEntity } from '../../price-lists/infrastructure/database/price-list-entry.orm-entity'
import { PriceListRateOrmEntity } from '../../price-lists/infrastructure/database/price-list-rate.orm-entity'
import { PriceListRuleOrmEntity } from '../../price-lists/infrastructure/database/price-list-rule.orm-entity'
import { PriceListOrmEntity } from '../../price-lists/infrastructure/database/price-list.orm-entity'
import { QuoteDraftLineItemOrmEntity } from '../../quote-drafts/infrastructure/database/quote-draft-line-item.orm-entity'
import { QuoteDraftLineOrmEntity } from '../../quote-drafts/infrastructure/database/quote-draft-line.orm-entity'
import { QuoteDraftWorkOrderOrmEntity } from '../../quote-drafts/infrastructure/database/quote-draft-work-order.orm-entity'
import { QuoteDraftOrmEntity } from '../../quote-drafts/infrastructure/database/quote-draft.orm-entity'
import { QuoteEventOrmEntity } from '../../quotes/infrastructure/database/quote-event.orm-entity'
import { QuoteOrmEntity } from '../../quotes/infrastructure/database/quote.orm-entity'
import { WorkOrderEventOrmEntity } from '../../work-orders/infrastructure/database/work-order-event.orm-entity'
import { WorkOrderItemOrmEntity } from '../../work-orders/infrastructure/database/work-order-item.orm-entity'
import { WorkOrderOrmEntity } from '../../work-orders/infrastructure/database/work-order.orm-entity'

export const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? 'postgres://wemaintain:wemaintain@127.0.0.1:5432/wemaintain',
  entities: [
    QuoteEventOrmEntity,
    QuoteOrmEntity,
    WorkOrderOrmEntity,
    WorkOrderItemOrmEntity,
    WorkOrderEventOrmEntity,
    PartOrmEntity,
    CustomerOrmEntity,
    BuildingOrmEntity,
    DeviceOrmEntity,
    ContractOrmEntity,
    ContractDeviceOrmEntity,
    PriceListOrmEntity,
    PriceListBandOrmEntity,
    PriceListEntryOrmEntity,
    PriceListRateOrmEntity,
    PriceListRuleOrmEntity,
    ContractPriceListOrmEntity,
    QuoteDraftOrmEntity,
    QuoteDraftWorkOrderOrmEntity,
    QuoteDraftLineOrmEntity,
    QuoteDraftLineItemOrmEntity,
  ],
  synchronize: true,
})

export async function connect(): Promise<DataSource> {
  const admin = new DataSource({ ...dataSource.options, entities: [], synchronize: false } as typeof dataSource.options)
  await admin.initialize()
  for (const schema of ['workorders', 'contracts', 'users', 'buildings', 'devices', 'pricing']) {
    await admin.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`)
  }
  await admin.destroy()
  return dataSource.initialize()
}
