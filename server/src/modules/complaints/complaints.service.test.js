import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { Complaint } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { createComplaint, getCustomerComplaint, getGuestComplaint } from './complaints.service.js';
import { createComplaintSchema } from './complaints.schemas.js';

const reference = 'CS-20261121-12345';

test('createComplaintSchema normalizes guest contact email and message fields', () => {
  const result = createComplaintSchema.safeParse({
    category: 'order',
    subject: '  Order question  ',
    message: '  Please help me with this order.  ',
    contactName: '  Shoe Customer ',
    contactEmail: ' CUSTOMER@EXAMPLE.COM ',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.subject, 'Order question');
  assert.equal(result.data.message, 'Please help me with this order.');
  assert.equal(result.data.contactEmail, 'customer@example.com');
});

test('createComplaintSchema rejects unsupported categories and short messages', () => {
  const result = createComplaintSchema.safeParse({
    category: 'refund',
    subject: 'Help',
    message: 'Short',
  });

  assert.equal(result.success, false);
});

test('createComplaint creates a guest complaint with a hash-only access token', async (t) => {
  let saved;
  t.mock.method(Complaint, 'exists', async () => false);
  t.mock.method(Complaint, 'create', async (input) => {
    saved = input;
    return { toObject: () => ({ ...input, id: 'complaint-1' }) };
  });
  t.mock.method(console, 'info', () => {});

  const result = await createComplaint({}, {
    category: 'delivery',
    subject: 'Delivery question',
    message: 'Please help me understand the delivery update.',
    contactName: 'Customer',
    contactEmail: 'customer@example.com',
  });

  assert.equal(result.complaint.reference, saved.reference);
  assert.equal(result.complaint.messages.length, 1);
  assert.equal(result.accessToken.length, 64);
  assert.equal(saved.guestAccessTokenHash, createHash('sha256').update(result.accessToken).digest('hex'));
  assert.equal(saved.guestAccessTokenHash.includes(result.accessToken), false);
});

test('getCustomerComplaint scopes lookup to the authenticated customer and hides internal notes', async (t) => {
  let filter;
  const complaint = {
    toObject: () => ({
      reference,
      messages: [
        { id: 'public-1', content: 'Customer message', isInternal: false },
        { id: 'private-1', content: 'Staff note', isInternal: true },
      ],
    }),
  };
  t.mock.method(Complaint, 'findOne', async (query) => {
    filter = query;
    return complaint;
  });

  const result = await getCustomerComplaint('customer-1', reference);

  assert.deepEqual(filter, { reference, customerId: 'customer-1' });
  assert.deepEqual(result.messages.map(({ content }) => content), ['Customer message']);
});

test('getGuestComplaint requires the matching unexpired access token and hides internal notes', async (t) => {
  const accessToken = 'guest-access-token';
  const complaint = {
    guestAccessTokenHash: createHash('sha256').update(accessToken).digest('hex'),
    guestAccessTokenExpiresAt: new Date(Date.now() + 60_000),
    toObject: () => ({
      reference,
      messages: [
        { id: 'public-1', content: 'Customer message', isInternal: false },
        { id: 'private-1', content: 'Staff note', isInternal: true },
      ],
    }),
  };
  t.mock.method(Complaint, 'findOne', () => ({
    select: async () => complaint,
  }));

  const result = await getGuestComplaint(reference, accessToken);
  assert.deepEqual(result.messages.map(({ content }) => content), ['Customer message']);
  await assert.rejects(getGuestComplaint(reference, 'wrong-token'), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 404);
    return true;
  });
});
