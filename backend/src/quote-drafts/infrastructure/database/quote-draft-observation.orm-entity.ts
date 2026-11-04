import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import type { SentLine } from '../../domain/sent-lines'

/** What a draft's quote held when it was presented to the customer. A quote presented twice is observed twice. */
@Entity({ schema: 'workorders', name: 'quote_draft_observation' })
export class QuoteDraftObservationOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column('uuid') @Index() draftId: string
  @Column() sfQuoteId: string
  @CreateDateColumn({ type: 'timestamptz' }) observedAt: Date
  @Column('int') contractLines: number
  @Column('int') atListPrice: number
  @Column('int') changedInSalesforce: number
  @Column('int') removedInSalesforce: number
  @Column('int') manualLines: number
  @Column('int') addedInSalesforce: number
  /** The Salesforce lines as read, to check the counts later. */
  @Column('jsonb') sentLines: SentLine[]
}
