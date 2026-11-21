import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../shared/auth/AuthContext';
import { formatDateTime } from '../shared/lib/format';
import type { Complaint, ComplaintCategory, ComplaintMessage, ComplaintStatus } from '../shared/types';
import { customerApi } from './api';

const categoryOptions: { value: ComplaintCategory; label: string }[] = [
  { value: 'order', label: 'Order' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'payment', label: 'Payment' },
  { value: 'product', label: 'Product' },
  { value: 'account', label: 'Account' },
  { value: 'other', label: 'Other' },
];

const statusLabels: Record<ComplaintStatus, string> = {
  submitted: 'Submitted',
  in_review: 'In review',
  awaiting_customer: 'Awaiting your reply',
  resolved: 'Resolved',
  closed: 'Closed',
};

function ComplaintStatusBadge({ status }: { status: ComplaintStatus }) {
  return <span className={`complaint-status complaint-status--${status}`}>{statusLabels[status]}</span>;
}

function ComplaintThread({ messages }: { messages: ComplaintMessage[] }) {
  return (
    <ol className="complaint-thread">
      {messages.map((message) => (
        <li className={`complaint-message${message.senderRole === 'admin' ? ' is-support' : ''}`} key={message.id}>
          <div className="complaint-message__heading">
            <strong>{message.senderRole === 'admin' ? 'Shoe Store support' : message.senderName}</strong>
            <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
          </div>
          <p>{message.content}</p>
        </li>
      ))}
    </ol>
  );
}

export function ComplaintForm() {
  const { user } = useAuth('customer');
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<ComplaintCategory>('other');
  const [subject, setSubject] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [message, setMessage] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [submitted, setSubmitted] = useState<Complaint | null>(null);
  const [guestReference, setGuestReference] = useState('');
  const [guestAccessToken, setGuestAccessToken] = useState('');

  const submit = useMutation({
    mutationFn: () => customerApi.createComplaint({
      category,
      subject,
      message,
      ...(orderNumber.trim() ? { orderNumber: orderNumber.trim() } : {}),
      ...(!user ? {
        contactName,
        contactEmail,
        ...(contactPhone.trim() ? { contactPhone: contactPhone.trim() } : {}),
      } : {}),
    }),
    onSuccess: async (result) => {
      setSubmitted(result.complaint);
      if (result.accessToken) {
        const key = `shoe-store-complaint:${result.complaint.reference}`;
        window.sessionStorage.setItem(key, result.accessToken);
        setGuestReference(result.complaint.reference);
        setGuestAccessToken(result.accessToken);
      }
      await queryClient.invalidateQueries({ queryKey: ['customer-complaints'] });
    },
  });

  if (submitted) {
    const complaintLink = guestReference
      ? `/complaints/guest/${encodeURIComponent(guestReference)}`
      : `/account/complaints/${encodeURIComponent(submitted.reference)}`;
    return (
      <section className="complaint-form-success" role="status">
        <span className="complaint-form-success__icon" aria-hidden="true">✓</span>
        <h2>We’ve received your message</h2>
        <p>Your reference number is <strong>{submitted.reference}</strong>. Keep it for follow-up.</p>
        {guestAccessToken && (
          <p className="complaint-form-success__token">
            Save this private access token for guest follow-up: <code>{guestAccessToken}</code>
          </p>
        )}
        <Link to={complaintLink}>View complaint and replies <span aria-hidden="true">→</span></Link>
      </section>
    );
  }

  return (
    <form
      className="complaint-form"
      onSubmit={(event) => {
        event.preventDefault();
        submit.mutate();
      }}
    >
      <div className="complaint-form__intro">
        <span className="info-card__label">Customer care</span>
        <h2>Send us a message</h2>
        <p>Tell us what happened and our team will review your complaint.</p>
      </div>
      {!user && (
        <div className="complaint-form__grid">
          <label>
            Your name
            <input autoComplete="name" required minLength={2} maxLength={120} value={contactName} onChange={(event) => setContactName(event.target.value)} />
          </label>
          <label>
            Email address
            <input autoComplete="email" required type="email" maxLength={254} value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
          </label>
          <label className="complaint-form__wide">
            Phone number <span>(optional)</span>
            <input autoComplete="tel" maxLength={40} value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
          </label>
        </div>
      )}
      <div className="complaint-form__grid">
        <label>
          What is this about?
          <select required value={category} onChange={(event) => setCategory(event.target.value as ComplaintCategory)}>
            {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          Order number <span>(optional)</span>
          <input maxLength={40} value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} />
        </label>
        <label className="complaint-form__wide">
          Subject
          <input required minLength={3} maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} />
        </label>
        <label className="complaint-form__wide">
          How can we help?
          <textarea required minLength={10} maxLength={5000} rows={6} value={message} onChange={(event) => setMessage(event.target.value)} />
        </label>
      </div>
      <p className="complaint-form__privacy">Please don’t include passwords or full payment-card details.</p>
      {submit.isError && <p className="complaint-error" role="alert">{submit.error.message || 'Your message could not be submitted. Please try again.'}</p>}
      <button className="complaint-submit" type="submit" disabled={submit.isPending}>
        {submit.isPending ? 'Sending…' : 'Submit complaint'}
      </button>
    </form>
  );
}

export function ComplaintPage() {
  return (
    <div className="storefront-page info-page">
      <nav className="info-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link><span aria-hidden="true">/</span><span>Complaints</span>
      </nav>
      <header className="info-page__header">
        <span className="section-eyebrow">Shoe Store · Customer service</span>
        <h1>Complaints</h1>
        <p>Tell us what happened and our team will review your complaint. You’ll receive a reference number to follow up.</p>
      </header>
      <ComplaintForm />
    </div>
  );
}

export function CustomerComplaintsPage() {
  const [page, setPage] = useState(1);
  const complaints = useQuery({
    queryKey: ['customer-complaints', page],
    queryFn: () => customerApi.complaints(page),
  });

  return (
    <section className="account-card complaint-account-page">
      <header className="account-card__heading">
        <div><h2>My complaints</h2><p>View your messages and support updates.</p></div>
      </header>
      {complaints.isLoading && <p role="status">Loading your complaints…</p>}
      {complaints.isError && <p className="complaint-error" role="alert">Your complaints could not be loaded. Please try again.</p>}
      {complaints.isSuccess && complaints.data.data.length === 0 && (
        <div className="complaint-empty">
          <strong>No complaints yet</strong>
          <p>If you need help, send us a message through <Link to="/contact-us">Contact Us</Link>.</p>
        </div>
      )}
      {complaints.isSuccess && complaints.data.data.length > 0 && (
        <div className="complaint-list">
          {complaints.data.data.map((complaint) => (
            <Link className="complaint-list__item" key={complaint.id} to={`/account/complaints/${encodeURIComponent(complaint.reference)}`}>
              <span className="complaint-list__main">
                <strong>{complaint.subject}</strong>
                <small>{complaint.reference} · {formatDateTime(complaint.updatedAt)}</small>
              </span>
              <ComplaintStatusBadge status={complaint.status} />
            </Link>
          ))}
          {complaints.data.meta && complaints.data.meta.totalPages > 1 && (
            <div className="complaint-pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
              <span>Page {page} of {complaints.data.meta.totalPages}</span>
              <button type="button" disabled={page >= complaints.data.meta.totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function CustomerComplaintDetailPage() {
  const { reference = '' } = useParams();
  const queryClient = useQueryClient();
  const complaint = useQuery({
    queryKey: ['customer-complaint', reference],
    queryFn: () => customerApi.complaint(reference),
    enabled: Boolean(reference),
  });
  const [content, setContent] = useState('');
  const reply = useMutation({
    mutationFn: () => customerApi.replyToComplaint(reference, content),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['customer-complaint', reference], updated);
      setContent('');
      await queryClient.invalidateQueries({ queryKey: ['customer-complaints'] });
    },
  });

  if (complaint.isLoading) return <p role="status">Loading complaint…</p>;
  if (complaint.isError || !complaint.data) return <p className="complaint-error" role="alert">This complaint could not be loaded.</p>;
  return (
    <ComplaintConversation
      complaint={complaint.data}
      backTo="/account/complaints"
      content={content}
      setContent={setContent}
      onReply={() => reply.mutate()}
      isReplying={reply.isPending}
      replyError={reply.isError ? 'Your reply could not be sent.' : ''}
    />
  );
}

export function GuestComplaintPage() {
  const { reference = '' } = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const storageKey = `shoe-store-complaint:${reference}`;
  const hashToken = new URLSearchParams(location.hash.slice(1)).get('token') ?? '';
  const [accessToken, setAccessToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (hashToken) {
      window.sessionStorage.setItem(storageKey, hashToken);
      setAccessToken(hashToken);
      window.history.replaceState(null, '', `${location.pathname}${location.search}`);
    } else {
      setAccessToken(window.sessionStorage.getItem(storageKey) ?? '');
    }
  }, [hashToken, location.pathname, location.search, storageKey]);

  const complaint = useQuery({
    queryKey: ['guest-complaint', reference, accessToken],
    queryFn: () => customerApi.guestComplaint(reference, accessToken),
    enabled: Boolean(reference && accessToken),
    retry: false,
  });
  const reply = useMutation({
    mutationFn: () => customerApi.replyToGuestComplaint(reference, accessToken, content),
    onSuccess: (updated) => {
      queryClient.setQueryData(['guest-complaint', reference, accessToken], updated);
      setContent('');
    },
  });

  if (!accessToken) {
    return (
      <div className="storefront-page complaint-guest-page">
        <h1>View your complaint</h1>
        <p>Open the secure link in your confirmation email to view or reply to a guest complaint.</p>
        <form className="complaint-token-form" onSubmit={(event) => {
          event.preventDefault();
          const nextToken = tokenInput.trim();
          if (!nextToken) return;
          window.sessionStorage.setItem(storageKey, nextToken);
          setAccessToken(nextToken);
        }}>
          <label>Access token<input required value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} /></label>
          <button type="submit">Continue</button>
        </form>
      </div>
    );
  }

  if (complaint.isLoading) return <div className="storefront-page complaint-guest-page"><p role="status">Loading complaint…</p></div>;
  if (complaint.isError || !complaint.data) {
    return (
      <div className="storefront-page complaint-guest-page">
        <p className="complaint-error" role="alert">This secure complaint link is invalid or has expired. Use the latest link from your email.</p>
        <button className="complaint-token-reset" type="button" onClick={() => {
          window.sessionStorage.removeItem(storageKey);
          setAccessToken('');
          setTokenInput('');
        }}>Enter another access token</button>
      </div>
    );
  }
  return (
    <div className="storefront-page complaint-guest-page">
      <ComplaintConversation
        complaint={complaint.data}
        backTo="/contact-us"
        content={content}
        setContent={setContent}
        onReply={() => reply.mutate()}
        isReplying={reply.isPending}
        replyError={reply.isError ? 'Your reply could not be sent.' : ''}
      />
    </div>
  );
}

function ComplaintConversation({
  complaint,
  backTo,
  content,
  setContent,
  onReply,
  isReplying,
  replyError,
}: {
  complaint: Complaint;
  backTo: string;
  content: string;
  setContent: (value: string) => void;
  onReply: () => void;
  isReplying: boolean;
  replyError: string;
}) {
  const canReply = complaint.status !== 'closed';
  return (
    <div className="complaint-conversation">
      <Link className="complaint-back-link" to={backTo}>← Back</Link>
      <header className="complaint-conversation__heading">
        <div>
          <span>{complaint.reference} · {complaint.category}</span>
          <h1>{complaint.subject}</h1>
        </div>
        <ComplaintStatusBadge status={complaint.status} />
      </header>
      {complaint.orderNumber && <p className="complaint-order-ref">Order {complaint.orderNumber}</p>}
      <ComplaintThread messages={complaint.messages} />
      {canReply ? (
        <form className="complaint-reply-form" onSubmit={(event) => { event.preventDefault(); onReply(); }}>
          <label htmlFor="complaint-reply">Your reply</label>
          <textarea id="complaint-reply" required minLength={1} maxLength={5000} rows={4} value={content} onChange={(event) => setContent(event.target.value)} />
          {replyError && <p className="complaint-error" role="alert">{replyError}</p>}
          <button className="complaint-submit" type="submit" disabled={isReplying}>{isReplying ? 'Sending…' : 'Send reply'}</button>
        </form>
      ) : (
        <p className="complaint-closed-note">This complaint is closed. Contact us if you need further assistance.</p>
      )}
    </div>
  );
}
