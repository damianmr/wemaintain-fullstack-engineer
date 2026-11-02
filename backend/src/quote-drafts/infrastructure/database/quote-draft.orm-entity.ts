import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm'
import { DraftStatus } from '../../domain/quote-draft'
import type { QuoteDraftLineOrmEntity } from './quote-draft-line.orm-entity'
import type { QuoteDraftWorkOrderOrmEntity } from './quote-draft-work-order.orm-entity'

@Entity({ schema: 'workorders', name: 'quote_draft' })
export class QuoteDraftOrmEntity {
  @PrimaryColumn('uuid') id: string
  @Column('uuid') contractId: string
  @Column('uuid') priceListId: string
  @Column() currency: string
  /** The date that chose the list version. */
  @Column('timestamptz') pricingDate: Date
  @Column('enum', { enum: DraftStatus }) status: DraftStatus
  @Column('varchar', { nullable: true }) @Index() sfQuoteId: string | null
  @OneToMany('QuoteDraftWorkOrderOrmEntity', 'draft', { cascade: true, eager: true }) workOrders: QuoteDraftWorkOrderOrmEntity[]
  @OneToMany('QuoteDraftLineOrmEntity', 'draft', { cascade: true, eager: true }) lines: QuoteDraftLineOrmEntity[]
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date
}
