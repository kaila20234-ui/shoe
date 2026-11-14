import { useState, type FormEvent } from 'react';
import type { User } from '../../shared/types';
import { api } from '../../shared/api/client';
import { useToast } from '../../shared/ui';
import { Section } from '../components/ui';

export function AdminUsersPage() {
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function createAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const { data: admin } = await api.post<User>('/admin/admins', { name, email, password });
      toast.success(`Admin account created for ${admin.email}.`);
      setName('');
      setEmail('');
      setPassword('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create the admin account.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Section title="Team accounts">
      <div className="admin-team-intro">
        <span className="admin-team-intro__icon" aria-hidden="true">+</span>
        <div><h2>Invite a store administrator</h2><p>Create a secure team account for someone who needs access to store operations.</p></div>
      </div>
      <form className="admin-form admin-team-form" onSubmit={createAdmin}>
        <fieldset className="admin-form-section">
          <legend><span>01</span> Account details</legend>
          <div className="admin-form-section__grid">
            <label>Full name<input required maxLength={120} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter their full name" /></label>
            <label>Work email address<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" /></label>
            <label className="is-wide">Temporary password <span className="admin-field-suffix">At least 8 characters · share securely</span><input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Create a temporary password" /></label>
          </div>
        </fieldset>
        <div className="admin-team-notice"><strong>Administrator permissions</strong><span>This account will have access to orders, products, customers, and store settings.</span></div>
        <div className="admin-form-footer">
          <span>Only create accounts for trusted team members.</span>
          <button className="button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account…' : 'Create admin account'}
          </button>
        </div>
      </form>
    </Section>
  );
}
