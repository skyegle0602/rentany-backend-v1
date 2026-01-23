import { Document, Model } from 'mongoose';
/**
 * Dispute interface
 */
export interface IDispute extends Document {
    rental_request_id: string;
    filed_by_email: string;
    against_email: string;
    reason: string;
    description: string;
    status: 'open' | 'under_review' | 'resolved' | 'closed';
    evidence_urls?: string[];
    resolution?: string;
    decision?: string;
    refund_to_renter?: number;
    charge_to_owner?: number;
    admin_notes?: string;
    created_date: Date;
    resolved_date?: Date;
}
/**
 * Dispute model
 */
declare const Dispute: Model<IDispute>;
export default Dispute;
//# sourceMappingURL=disputes.d.ts.map