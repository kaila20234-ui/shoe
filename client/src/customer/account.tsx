import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../shared/auth/AuthContext';
import { formatDate } from '../shared/lib/format';
import { resolveAssetUrl } from '../shared/lib/assetUrl';
import { Button, Input, Spinner } from '../shared/ui';
import type { Address, User } from '../shared/types';
import { customerApi } from './api';

function PageError({ message }: { message: string }) {
  return <p role="alert" className="storefront-error">{message}</p>;
}

function Loading() {
  return <div className="flex justify-center py-16"><Spinner /></div>;
}

function useProfile() {
  return useQuery({ queryKey: ['profile'], queryFn: customerApi.profile });
}

export function AccountLayout() {
  const profile = useProfile();
  const addresses = useQuery({ queryKey: ['addresses'], queryFn: customerApi.addresses });

  if (profile.isLoading || addresses.isLoading) return <Loading />;
  if (profile.isError || addresses.isError || !profile.data) {
    return <div className="storefront-page account-page"><PageError message="Could not load your account." /></div>;
  }

  const firstName = profile.data.name.trim().split(/\s+/)[0] || 'there';
  const savedAddresses = addresses.data ?? [];
  return (
    <div className="storefront-page account-page">
      <header className="account-heading">
        <div>
          <span className="section-eyebrow">Your space</span>
          <h1>Your account</h1>
          <p>Manage your personal information, delivery addresses, and security.</p>
        </div>
        <Link className="account-heading__shop" to="/shop">Continue shopping <span aria-hidden="true">→</span></Link>
      </header>

      <section className="account-welcome" aria-label="Profile summary">
        <ProfileAvatar user={profile.data} />
        <div className="account-welcome__identity">
          <span className="account-welcome__eyebrow">Welcome back</span>
          <h2>{firstName}</h2>
          <p>{profile.data.email}</p>
        </div>
        <div className="account-welcome__since">
          <span>Member since</span>
          <strong>{formatDate(profile.data.createdAt)}</strong>
        </div>
      </section>

      <div className="account-layout">
        <nav className="account-menu" aria-label="Account sections">
          <span className="account-menu__title">Your account</span>
          <NavLink to="/account/profile">Personal details</NavLink>
          <NavLink to="/account/addresses">Address book <span>{savedAddresses.length}</span></NavLink>
          <NavLink to="/account/security">Password &amp; security</NavLink>
          <span className="account-menu__divider" />
          <Link to="/orders">Your orders <span aria-hidden="true">↗</span></Link>
          <Link to="/wishlist">Saved items <span aria-hidden="true">↗</span></Link>
        </nav>
        <div className="account-content"><Outlet /></div>
      </div>
    </div>
  );
}

function ProfileAvatar({ user }: { user: User }) {
  return (
    <div className="account-avatar">
      {user.avatarUrl ? <img src={resolveAssetUrl(user.avatarUrl)} alt="" /> : user.name.trim().charAt(0).toUpperCase()}
    </div>
  );
}

export function AccountProfilePage() {
  const queryClient = useQueryClient();
  const profileQuery = useProfile();
  const { refreshUser } = useAuth('customer');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (profileQuery.data) {
      setName(profileQuery.data.name);
      setPhone(profileQuery.data.phone ?? '');
    }
  }, [profileQuery.data]);

  const profileMutation = useMutation({
    mutationFn: () => customerApi.updateProfile({ name, phone }),
    onSuccess: async (user) => {
      queryClient.setQueryData(['profile'], user);
      setName(user.name);
      setPhone(user.phone ?? '');
      await refreshUser();
    },
  });
  const avatarMutation = useMutation({
    mutationFn: customerApi.uploadAvatar,
    onSuccess: async (user) => {
      queryClient.setQueryData(['profile'], user);
      await refreshUser();
    },
    onError: (error: Error) => setUploadError(error.message || 'Could not upload your profile picture.'),
  });

  function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setUploadError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Choose an image smaller than 5 MB.');
      return;
    }
    avatarMutation.mutate(file);
  }

  if (profileQuery.isLoading) return <Loading />;
  if (profileQuery.isError || !profileQuery.data) return <PageError message="Could not load your account." />;
  return (
    <section className="customer-panel account-card" id="personal-details">
      <div className="account-card__heading">
        <div><span className="account-card__eyebrow">PROFILE</span><h2>Personal details</h2></div>
        <p>Your contact information for orders and delivery.</p>
      </div>
      <div className="account-photo">
        <ProfileAvatar user={profileQuery.data} />
        <div>
          <strong>Profile picture</strong>
          <span>JPG, PNG or WebP · up to 5 MB</span>
        </div>
        <label className="account-photo__button">
          {avatarMutation.isPending ? 'Uploading…' : 'Upload photo'}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={avatarMutation.isPending} onChange={uploadAvatar} />
        </label>
      </div>
      {uploadError && <PageError message={uploadError} />}
      {avatarMutation.isSuccess && <p role="status" className="account-success">Your profile picture has been updated.</p>}
      <form className="account-form" onSubmit={(event) => { event.preventDefault(); profileMutation.mutate(); }}>
        <label>Full name<Input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Email address<Input type="email" autoComplete="email" value={profileQuery.data.email} disabled /><small className="account-field-hint">Email address cannot be changed here.</small></label>
        <label>Phone number<Input type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Add a phone number" /></label>
        <div className="account-form__actions">
          {profileMutation.isSuccess && <p role="status" className="account-success">Your profile has been updated.</p>}
          {profileMutation.isError && <PageError message="Could not save your profile." />}
          <Button type="submit" disabled={profileMutation.isPending}>{profileMutation.isPending ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </form>
    </section>
  );
}

export function AccountAddressesPage() {
  const queryClient = useQueryClient();
  const addresses = useQuery({ queryKey: ['addresses'], queryFn: customerApi.addresses });
  const [newAddress, setNewAddress] = useState<Omit<Address, 'id'>>({ label: '', recipient: '', phone: '', street: '', city: '', state: '', landmark: '', isDefault: false });
  const [editingAddressId, setEditingAddressId] = useState('');
  const [editingAddress, setEditingAddress] = useState<Partial<Omit<Address, 'id'>>>({});

  const addressMutation = useMutation({
    mutationFn: () => customerApi.addAddress(newAddress),
    onSuccess: () => {
      setNewAddress({ label: '', recipient: '', phone: '', street: '', city: '', state: '', landmark: '', isDefault: false });
      void queryClient.invalidateQueries({ queryKey: ['addresses'] });
    },
  });
  const deleteAddress = useMutation({ mutationFn: customerApi.deleteAddress, onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['addresses'] }) });
  const updateAddress = useMutation({
    mutationFn: () => customerApi.updateAddress(editingAddressId, editingAddress),
    onSuccess: () => {
      setEditingAddressId('');
      setEditingAddress({});
      void queryClient.invalidateQueries({ queryKey: ['addresses'] });
    },
  });

  if (addresses.isLoading) return <Loading />;
  if (addresses.isError) return <PageError message="Could not load your addresses." />;
  return (
    <section className="customer-panel account-card" id="address-book">
      <div className="account-card__heading">
        <div><span className="account-card__eyebrow">DELIVERY</span><h2>Address book</h2></div>
        <p>Keep your delivery details ready for a quicker checkout.</p>
      </div>
      {(addresses.data ?? []).length ? (
        <div className="account-addresses">
          {(addresses.data ?? []).map((address) => (
            <article key={address.id} className="account-address">
              <div className="account-address__top">
                <div><h3>{address.label || 'Delivery address'}</h3>{address.isDefault && <span className="account-default-badge">Default</span>}</div>
                <div className="account-address__actions">
                  <Button type="button" variant="secondary" onClick={() => {
                    setEditingAddressId(address.id);
                    setEditingAddress({ label: address.label, recipient: address.recipient, phone: address.phone, street: address.street, city: address.city, state: address.state, landmark: address.landmark, isDefault: address.isDefault });
                  }}>Edit</Button>
                  <Button type="button" variant="secondary" disabled={deleteAddress.isPending} onClick={() => {
                    if (window.confirm('Delete this address?')) deleteAddress.mutate(address.id);
                  }}>Remove</Button>
                </div>
              </div>
              <p>{address.recipient}<br />{address.street}{address.landmark ? `, ${address.landmark}` : ''}<br />{address.city}, {address.state}<br />{address.phone}</p>
              {editingAddressId === address.id && <AddressForm
                address={editingAddress}
                onChange={setEditingAddress}
                onSubmit={(event) => { event.preventDefault(); updateAddress.mutate(); }}
                onCancel={() => setEditingAddressId('')}
                submitLabel={updateAddress.isPending ? 'Saving…' : 'Save address'}
                isPending={updateAddress.isPending}
                error={updateAddress.isError ? 'Could not update this address.' : undefined}
              />}
            </article>
          ))}
        </div>
      ) : <div className="account-address-empty"><strong>No saved addresses yet</strong><span>Add a delivery address below to speed up your next checkout.</span></div>}
      {deleteAddress.isError && <PageError message="Could not remove this address." />}
      <details className="account-add-address">
        <summary>Add a delivery address</summary>
        <AddressForm
          address={newAddress}
          onChange={(address) => setNewAddress((current) => ({ ...current, ...address }))}
          onSubmit={(event) => { event.preventDefault(); addressMutation.mutate(); }}
          submitLabel={addressMutation.isPending ? 'Adding…' : 'Add address'}
          isPending={addressMutation.isPending}
          error={addressMutation.isError ? 'Could not add this address.' : undefined}
        />
      </details>
    </section>
  );
}

function AddressForm({
  address,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  isPending,
  error,
}: {
  address: Partial<Omit<Address, 'id'>>;
  onChange: (address: Partial<Omit<Address, 'id'>>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
  submitLabel: string;
  isPending: boolean;
  error?: string;
}) {
  return (
    <form className="account-form account-form--address" onSubmit={onSubmit}>
      {(['label', 'recipient', 'phone', 'street', 'city', 'state', 'landmark'] as const).map((field) => (
        <label key={field}>{field === 'label' ? 'Address label' : field.charAt(0).toUpperCase() + field.slice(1)}
          <Input required={field !== 'landmark'} value={address[field] ?? ''} onChange={(event) => onChange({ ...address, [field]: event.target.value })} />
        </label>
      ))}
      <label className="account-checkbox"><input type="checkbox" checked={address.isDefault ?? false} onChange={(event) => onChange({ ...address, isDefault: event.target.checked })} />Make this my default address</label>
      <div className="account-form__actions">
        {error && <PageError message={error} />}
        <Button type="submit" disabled={isPending}>{submitLabel}</Button>
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}

export function AccountSecurityPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const passwordMutation = useMutation({
    mutationFn: () => customerApi.changePassword({ currentPassword, newPassword }),
    onSuccess: () => { setCurrentPassword(''); setNewPassword(''); },
  });

  return (
    <section className="customer-panel account-card" id="account-security">
      <div className="account-card__heading">
        <div><span className="account-card__eyebrow">SECURITY</span><h2>Password &amp; security</h2></div>
        <p>Choose a strong password to help keep your account secure.</p>
      </div>
      <form className="account-form account-form--security" onSubmit={(event) => { event.preventDefault(); passwordMutation.mutate(); }}>
        <label>Current password<Input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
        <label>New password<Input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><small className="account-field-hint">Use at least 8 characters.</small></label>
        <div className="account-form__actions">
          {passwordMutation.isSuccess && <p role="status" className="account-success">Your password has been updated.</p>}
          {passwordMutation.isError && <PageError message="Could not change your password. Check your current password and try again." />}
          <Button type="submit" disabled={passwordMutation.isPending}>{passwordMutation.isPending ? 'Updating…' : 'Update password'}</Button>
        </div>
      </form>
    </section>
  );
}
