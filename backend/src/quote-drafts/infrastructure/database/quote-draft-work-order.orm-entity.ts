import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm'
import type { QuoteDraftOrmEntity } from './quote-draft.orm-entity'

/** A work order of a draft. Keyed by the work order, so it can be in one draft at most. */
@Entity({ schema: 'workorders', name: 'quote_draft_work_order' })
export class QuoteDraftWorkOrderOrmEntity {
  @PrimaryColumn('uuid') workOrderId: string
  @Column('uuid') draftId: string
  @Column() position: number
  @ManyToOne('QuoteDraftOrmEntity', 'workOrders', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'draftId' })
  draft?: QuoteDraftOrmEntity
}
