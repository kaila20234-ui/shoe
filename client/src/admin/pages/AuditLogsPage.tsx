import { useMemo, useState } from 'react';
import { useAdminDataStore } from '../components/AdminDataStore';
import { EmptyState, Section } from '../components/ui';

export function AuditLogsPage() {
  const { auditLogs } = useAdminDataStore();
  const [actor, setActor] = useState('');
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const filtered = useMemo(() => auditLogs.filter((log) => {
    const date = log.createdAt.slice(0, 10);
    return log.actorName.toLowerCase().includes(actor.toLowerCase())
      && log.entity.toLowerCase().includes(entity.toLowerCase())
      && (!from || date >= from)
      && (!to || date <= to);
  }), [auditLogs, actor, entity, from, to]);

  return (
    <Section title="Audit logs">
      <div className="admin-toolbar admin-filter-bar">
        <label className="admin-filter-field"><span>Actor</span><input aria-label="Filter by actor" placeholder="Search administrator" value={actor} onChange={(event) => setActor(event.target.value)} /></label>
        <label className="admin-filter-field"><span>Entity</span><input aria-label="Filter by entity" placeholder="Search entity type" value={entity} onChange={(event) => setEntity(event.target.value)} /></label>
        <label className="admin-filter-field"><span>From</span><input aria-label="From date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="admin-filter-field"><span>To</span><input aria-label="To date" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      {filtered.length ? (
        <div className="admin-table-wrap"><table className="table">
          <thead><tr><th>Actor</th><th>Action</th><th>Entity</th><th>Entity ID</th><th>Details</th><th>Date</th></tr></thead>
          <tbody>{filtered.map((log) => (
            <tr key={log.id}>
              <td>{log.actorName}</td><td>{log.action}</td><td>{log.entity}</td><td>{log.entityId}</td>
              <td><code>{log.meta ? JSON.stringify(log.meta) : '—'}</code></td><td>{new Date(log.createdAt).toLocaleString()}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <EmptyState title="No audit events match the filters" />}
    </Section>
  );
}
