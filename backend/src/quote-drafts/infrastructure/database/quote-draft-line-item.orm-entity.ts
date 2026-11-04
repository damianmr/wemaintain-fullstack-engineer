import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm'
import type { QuoteDraftLineOrmEntity } from './quote-draft-line.orm-entity'

/** A repair item a line covers, and how many of it. */
@Entity({ schema: 'workorders', name: 'quote_draft_line_item' })
export class QuoteDraftLineItemOrmEntity {
  @PrimaryColumn('uuid') lineId: string
  @PrimaryColumn('uuid') itemId: string
  @Column('uuid') workOrderId: string
  @Column('int') quantity: number
  @ManyToOne('QuoteDraftLineOrmEntity', 'coverage', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lineId' })
  line?: QuoteDraftLineOrmEntity
}
