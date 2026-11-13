import { useMemo, useState } from 'react';
import type { ReviewStatus } from '../../shared/types';
import { api } from '../../shared/api/client';
import { useToast } from '../../shared/ui';
import { useAdminDataStore } from '../components/AdminDataStore';
import { EmptyState, Section } from '../components/ui';

export function ReviewsPage() {
  const { reviews, setReviews, refreshAdminData } = useAdminDataStore();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const filtered = useMemo(() => reviews.filter((review) => !status || review.status === status), [reviews, status]);

  async function moderate(id: string, nextStatus: Extract<ReviewStatus, 'approved' | 'rejected'>) {
    try {
      const { data } = await api.patch<import('../../shared/types').Review>(`/admin/reviews/${encodeURIComponent(id)}`, { status: nextStatus });
      setReviews((current) => current.map((review) => review.id === id ? data : review));
      await refreshAdminData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to moderate review.');
    }
  }

  return (
    <Section title="Reviews moderation">
      <div className="admin-toolbar admin-filter-bar">
        <label className="admin-filter-field"><span>Review status</span><select aria-label="Filter reviews by status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
        </select></label>
        <span className="admin-filter-hint">Approve reviews to publish them on the storefront.</span>
      </div>
      {filtered.length ? (
        <div className="admin-table-wrap"><table className="table">
          <thead><tr><th>Customer</th><th>Rating</th><th>Comment</th><th>Date</th><th>Status</th><th>Moderation</th></tr></thead>
          <tbody>{filtered.map((review) => (
            <tr key={review.id}>
              <td>{review.userName}</td><td>{review.rating}/5</td><td>{review.comment}</td>
              <td>{new Date(review.createdAt).toLocaleDateString()}</td><td>{review.status}</td>
              <td className="admin-actions">
                <button className="button" type="button" disabled={review.status === 'approved'} onClick={() => moderate(review.id, 'approved')}>Approve</button>
                <button className="button danger" type="button" disabled={review.status === 'rejected'} onClick={() => moderate(review.id, 'rejected')}>Reject</button>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <EmptyState title="No reviews to show" />}
    </Section>
  );
}
