import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { formatDateTime } from '../../shared/lib/format';
import type { Complaint, ComplaintCategory, ComplaintStatus } from '../../shared/types';
import { useToast } from '../../shared/ui';
import { EmptyState, Section } from '../components/ui';

const statuses: ComplaintStatus[] = ['submitted', 'in_review', 'awaiting_customer', 'resolved', 'closed'];
const categories: ComplaintCategory[] = ['order', 'delivery', 'payment', 'product', 'account', 'other'];
const allowedTransitions: Record<ComplaintStatus, ComplaintStatus[]> = {
  submitted: ['in_review', 'closed'],
  in_review: ['awaiting_customer', 'resolved', 'closed'],
  awaiting_customer: ['in_review', 'resolved', 'closed'],
  resolved: ['in_review', 'awaiting_customer', 'closed'],
  closed: [],
};

function statusLabel(status: ComplaintStatus) {
  return status.replace(/_/g, ' ');
}

export function ComplaintsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedReference, setSelectedReference] = useState('');
  const [reply, setReply] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [nextStatus, setNextStatus] = useState<ComplaintStatus>('in_review');
  const params = {
    page,
    limit: 20,
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(search.trim() ? { q: search.trim() } : {}),
  };
  const complaints = useQuery({
    queryKey: ['admin-complaints', params],
    queryFn: () => api.get<Complaint[]>('/admin/complaints', { params }),
  });
  const selected = useQuery({
    queryKey: ['admin-complaint', selectedReference],
    queryFn: () => api.get<Complaint>(`/admin/complaints/${encodeURIComponent(selectedReference)}`),
    enabled: Boolean(selectedReference),
  });

  useEffect(() => {
    if (selected.data) setNextStatus(selected.data.data.status);
  }, [selected.data]);

  const updateStatus = useMutation({
    mutationFn: () => api.patch<Complaint>(
      `/admin/complaints/${encodeURIComponent(selectedReference)}/status`,
      { status: nextStatus },
    ),
    onSuccess: async (result) => {
      queryClient.setQueryData(['admin-complaint', selectedReference], result);
      await queryClient.invalidateQueries({ queryKey: ['admin-complaints'] });
      toast.success('Complaint status updated.');
    },
    onError: (error: Error) => toast.error(error.message || 'Unable to update complaint status.'),
  });
  const sendReply = useMutation({
    mutationFn: () => api.post<Complaint>(
      `/admin/complaints/${encodeURIComponent(selectedReference)}/messages`,
      { content: reply, isInternal },
    ),
    onSuccess: async (result) => {
      queryClient.setQueryData(['admin-complaint', selectedReference], result);
      setReply('');
      await queryClient.invalidateQueries({ queryKey: ['admin-complaints'] });
      toast.success(isInternal ? 'Internal note added.' : 'Reply sent to the customer.');
    },
    onError: (error: Error) => toast.error(error.message || 'Unable to send complaint update.'),
  });

  const selectedComplaint = selected.data?.data;
  const currentStatus = selectedComplaint?.status;
  const availableStatuses = currentStatus
    ? [currentStatus, ...allowedTransitions[currentStatus]]
    : [];

  return (
    <Section title="Complaints">
      <div className="admin-toolbar complaint-admin-toolbar">
        <input aria-label="Search complaints" placeholder="Search reference, subject, customer, or order" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <select aria-label="Filter complaints by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
        </select>
        <select aria-label="Filter complaints by category" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
          <option value="">All categories</option>
          {categories.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>
      {complaints.isError && <p className="admin-error" role="alert">Complaints could not be loaded. Refresh and try again.</p>}
      {complaints.isLoading ? <p role="status">Loading complaints…</p> : (
        <div className="complaint-admin-layout">
          <div className="complaint-admin-queue">
            {complaints.data?.data.length ? complaints.data.data.map((item) => (
              <button
                className={`complaint-admin-queue__item${selectedReference === item.reference ? ' is-selected' : ''}`}
                key={item.id}
                type="button"
                onClick={() => setSelectedReference(item.reference)}
              >
                <span className="complaint-admin-queue__top">
                  <strong>{item.reference}</strong>
                  <span className={`complaint-status complaint-status--${item.status}`}>{statusLabel(item.status)}</span>
                </span>
                <span className="complaint-admin-queue__subject">{item.subject}</span>
                <span className="complaint-admin-queue__meta">{item.contactName} · {item.category} · {formatDateTime(item.updatedAt)}</span>
              </button>
            )) : <EmptyState title="No complaints found" description="New customer messages will appear here." />}
            {complaints.data && complaints.data.meta && complaints.data.meta.totalPages > 1 && (
              <div className="complaint-admin-pagination">
                <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
                <span>Page {page} of {complaints.data.meta.totalPages}</span>
                <button type="button" disabled={page >= complaints.data.meta.totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
              </div>
            )}
          </div>
          <div className="complaint-admin-detail">
            {!selectedReference && <EmptyState title="Select a complaint" description="Choose a message from the inbox to review and respond." />}
            {selected.isLoading && <p role="status">Loading complaint details…</p>}
            {selected.isError && <p className="admin-error" role="alert">Complaint details could not be loaded.</p>}
            {selectedComplaint && (
              <>
                <header className="complaint-admin-detail__header">
                  <div>
                    <span>{selectedComplaint.reference} · {selectedComplaint.category}</span>
                    <h2>{selectedComplaint.subject}</h2>
                  </div>
                  <span className={`complaint-status complaint-status--${selectedComplaint.status}`}>{statusLabel(selectedComplaint.status)}</span>
                </header>
                <dl className="complaint-admin-contact">
                  <div><dt>Customer</dt><dd>{selectedComplaint.contactName}</dd></div>
                  <div><dt>Email</dt><dd><a href={`mailto:${encodeURIComponent(selectedComplaint.contactEmail)}`}>{selectedComplaint.contactEmail}</a></dd></div>
                  {selectedComplaint.contactPhone && <div><dt>Phone</dt><dd>{selectedComplaint.contactPhone}</dd></div>}
                  {selectedComplaint.orderNumber && <div><dt>Order</dt><dd>{selectedComplaint.orderNumber}</dd></div>}
                </dl>
                <ol className="complaint-admin-thread">
                  {selectedComplaint.messages.map((message) => (
                    <li className={message.isInternal ? 'is-internal' : ''} key={message.id}>
                      <div><strong>{message.isInternal ? 'Internal note' : message.senderName}</strong><time>{formatDateTime(message.createdAt)}</time></div>
                      <p>{message.content}</p>
                    </li>
                  ))}
                </ol>
                {currentStatus !== 'closed' && (
                  <>
                    <form className="complaint-admin-status" onSubmit={(event) => { event.preventDefault(); updateStatus.mutate(); }}>
                      <label>Status
                        <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as ComplaintStatus)}>
                          {availableStatuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
                        </select>
                      </label>
                      <button className="button" type="submit" disabled={updateStatus.isPending || nextStatus === currentStatus}>
                        {updateStatus.isPending ? 'Saving…' : 'Save status'}
                      </button>
                    </form>
                    <form className="complaint-admin-reply" onSubmit={(event) => { event.preventDefault(); sendReply.mutate(); }}>
                      <label htmlFor="complaint-admin-reply">{isInternal ? 'Private note' : 'Reply to customer'}</label>
                      <textarea id="complaint-admin-reply" required minLength={1} maxLength={5000} rows={4} value={reply} onChange={(event) => setReply(event.target.value)} />
                      <label className="complaint-admin-reply__internal">
                        <input type="checkbox" checked={isInternal} onChange={(event) => setIsInternal(event.target.checked)} />
                        Add as an internal note (not visible to customer)
                      </label>
                      <button className="button" type="submit" disabled={sendReply.isPending || !reply.trim()}>
                        {sendReply.isPending ? 'Sending…' : isInternal ? 'Add note' : 'Send reply'}
                      </button>
                    </form>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}
