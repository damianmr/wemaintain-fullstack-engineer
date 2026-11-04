import { DataSource } from 'typeorm'
import { PartOrmEntity } from '../../parts/infrastructure/database/part.orm-entity'
import { QuoteNotification } from '../../quotes/domain/quote'
import { QuoteEventStore } from '../../quotes/infrastructure/database/quote-event.store'
import { QuoteDraftRepository } from '../../quote-drafts/infrastructure/database/quote-draft.repository'
import { QuoteRepository } from '../../quotes/infrastructure/quote.repository'
import { SalesforceClient } from '../salesforce'
import { WorkOrderRepository } from '../../work-orders/infrastructure/database/work-order.repository'

export function createDeps(db: DataSource) {
  const salesforce = new SalesforceClient(process.env.SALESFORCE_URL ?? 'http://localhost:4001')
  return {
    db,
    salesforce,
    workOrders: new WorkOrderRepository(db),
    quotes: new QuoteRepository(salesforce, new QuoteEventStore(db)),
    parts: db.getRepository(PartOrmEntity),
    quoteDrafts: new QuoteDraftRepository(db),
    notify: ({ channel, message }: QuoteNotification) => console.log(`[${channel}] ${message}`),
    log: (message: string) => console.log(message),
  }
}

export type Deps = ReturnType<typeof createDeps>
