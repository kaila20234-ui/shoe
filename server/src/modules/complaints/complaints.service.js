import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Complaint, Order } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { buildMeta, parsePagination } from '../../utils/paginate.js';
import { sendMail } from '../../utils/mailer.js';
import { logAudit } from '../../utils/audit.js';

const statusTransitions = {
  submitted: ['in_review', 'closed'],
  in_review: ['awaiting_customer', 'resolved', 'closed'],
  awaiting_customer: ['in_review', 'resolved', 'closed'],
  resolved: ['in_review', 'awaiting_customer', 'closed'],
  closed: [],
};

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function toPlainComplaint(complaint) {
  return complaint.toObject ? complaint.toObject() : complaint;
}

function customerComplaint(complaint) {
  const result = toPlainComplaint(complaint);
  result.messages = (result.messages ?? []).filter((message) => !message.isInternal);
  return result;
}

async function createReference() {
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const reference = `CS-${day}-${String(randomInt(0, 100000)).padStart(5, '0')}`;
    if (!await Complaint.exists({ reference })) return reference;
  }
  throw new ApiError(409, 'CONFLICT', 'Could not create a complaint reference; please retry');
}

async function validateOrderOwnership(orderNumber, customerId, contactEmail) {
  if (!orderNumber) return;
  const filter = customerId
    ? { orderNumber, customerId: String(customerId) }
    : { orderNumber, customerEmail: contactEmail };
  const order = await Order.findOne(filter).select('_id');
  if (!order) throw new ApiError(400, 'VALIDATION_ERROR', 'The order number could not be matched to your contact details');
}

export async function createComplaint(req, input) {
  const user = req.user;
  if (user && user.role !== 'customer') {
    throw new ApiError(403, 'FORBIDDEN', 'Only customer accounts can submit a complaint');
  }
  const contactName = user?.name ?? input.contactName;
  const contactEmail = user?.email ?? input.contactEmail;
  if (!contactName || !contactEmail) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Name and email are required');
  }
  await validateOrderOwnership(input.orderNumber, user?.id, contactEmail);

  const reference = await createReference();
  const guestAccessToken = user ? undefined : randomBytes(32).toString('hex');
  const createdAt = new Date();
  const complaint = await Complaint.create({
    reference,
    ...(user ? { customerId: String(user.id) } : {
      guestAccessTokenHash: hashToken(guestAccessToken),
      guestAccessTokenExpiresAt: new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000),
    }),
    contactName,
    contactEmail,
    ...(user?.phone || input.contactPhone ? { contactPhone: user?.phone ?? input.contactPhone } : {}),
    category: input.category,
    subject: input.subject,
    ...(input.orderNumber ? { orderNumber: input.orderNumber } : {}),
    status: 'submitted',
    messages: [{
      senderRole: 'customer',
      ...(user ? { senderId: String(user.id) } : {}),
      senderName: contactName,
      content: input.message,
      isInternal: false,
      createdAt,
    }],
    statusHistory: [{ status: 'submitted', at: createdAt, ...(user ? { byUserId: String(user.id) } : {}) }],
  });

  const guestUrl = guestAccessToken
    ? `${process.env.CLIENT_URL || 'http://localhost:5173'}/complaints/guest/${reference}#token=${guestAccessToken}`
    : undefined;
  sendMail({
    to: contactEmail,
    subject: `We received complaint ${reference}`,
    html: `<p>Hello ${escapeHtml(contactName)},</p><p>We received your message about "${escapeHtml(input.subject)}". Your reference is <strong>${reference}</strong>.</p>${guestUrl ? `<p><a href="${guestUrl}">View or reply to your complaint</a></p>` : '<p>You can view and reply to this complaint from your account.</p>'}`,
  });

  await logAudit(req, {
    action: 'complaint.create',
    entity: 'complaint',
    entityId: reference,
    meta: { category: input.category, ...(input.orderNumber ? { orderNumber: input.orderNumber } : {}) },
  });

  return { complaint: customerComplaint(complaint), ...(guestAccessToken ? { accessToken: guestAccessToken } : {}) };
}

export async function listCustomerComplaints(userId, query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const filter = { customerId: String(userId) };
  const [complaints, total] = await Promise.all([
    Complaint.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    Complaint.countDocuments(filter),
  ]);
  return { items: complaints.map(customerComplaint), meta: buildMeta(page, limit, total) };
}

export async function getCustomerComplaint(userId, reference) {
  const complaint = await Complaint.findOne({ reference, customerId: String(userId) });
  if (!complaint) throw new ApiError(404, 'NOT_FOUND', 'Complaint not found');
  return customerComplaint(complaint);
}

async function getGuestComplaintDocument(reference, token) {
  const complaint = await Complaint.findOne({ reference })
    .select('+guestAccessTokenHash +guestAccessTokenExpiresAt');
  if (!complaint?.guestAccessTokenHash || !complaint.guestAccessTokenExpiresAt
    || complaint.guestAccessTokenExpiresAt <= new Date() || typeof token !== 'string') {
    throw new ApiError(404, 'NOT_FOUND', 'Complaint could not be found');
  }
  const expected = Buffer.from(complaint.guestAccessTokenHash, 'hex');
  const provided = Buffer.from(hashToken(token), 'hex');
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new ApiError(404, 'NOT_FOUND', 'Complaint could not be found');
  }
  return complaint;
}

export async function getGuestComplaint(reference, token) {
  return customerComplaint(await getGuestComplaintDocument(reference, token));
}

async function addCustomerMessage(complaint, sender, content) {
  if (complaint.status === 'closed') {
    throw new ApiError(409, 'CONFLICT', 'This complaint is closed and can no longer receive replies');
  }
  const nextStatus = ['resolved', 'awaiting_customer'].includes(complaint.status) ? 'in_review' : complaint.status;
  const now = new Date();
  const update = {
    $push: {
      messages: {
        senderRole: 'customer',
        ...(sender.id ? { senderId: String(sender.id) } : {}),
        senderName: sender.name,
        content,
        isInternal: false,
        createdAt: now,
      },
      ...(nextStatus !== complaint.status ? {
        statusHistory: { status: nextStatus, note: 'Customer replied', at: now, ...(sender.id ? { byUserId: String(sender.id) } : {}) },
      } : {}),
    },
    $set: { ...(nextStatus !== complaint.status ? { status: nextStatus } : {}) },
  };
  const updated = await Complaint.findOneAndUpdate(
    { _id: complaint.id, status: complaint.status },
    update,
    { new: true },
  );
  if (!updated) throw new ApiError(409, 'CONFLICT', 'Complaint changed; reload and retry');
  return updated;
}

export async function addCustomerComplaintMessage(userId, reference, content) {
  const complaint = await Complaint.findOne({ reference, customerId: String(userId) });
  if (!complaint) throw new ApiError(404, 'NOT_FOUND', 'Complaint not found');
  const updated = await addCustomerMessage(complaint, { id: userId, name: complaint.contactName }, content);
  return customerComplaint(updated);
}

export async function addGuestComplaintMessage(reference, token, content) {
  const complaint = await getGuestComplaintDocument(reference, token);
  return customerComplaint(await addCustomerMessage(complaint, { name: complaint.contactName }, content));
}

export async function listAdminComplaints(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.q) {
    const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = ['reference', 'subject', 'contactName', 'contactEmail', 'orderNumber']
      .map((field) => ({ [field]: new RegExp(escaped, 'i') }));
  }
  const [complaints, total] = await Promise.all([
    Complaint.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    Complaint.countDocuments(filter),
  ]);
  return { items: complaints.map(toPlainComplaint), meta: buildMeta(page, limit, total) };
}

export async function getAdminComplaint(reference) {
  const complaint = await Complaint.findOne({ reference });
  if (!complaint) throw new ApiError(404, 'NOT_FOUND', 'Complaint not found');
  return toPlainComplaint(complaint);
}

export async function updateAdminComplaintStatus(req, reference, status) {
  const complaint = await Complaint.findOne({ reference });
  if (!complaint) throw new ApiError(404, 'NOT_FOUND', 'Complaint not found');
  if (!statusTransitions[complaint.status]?.includes(status)) {
    throw new ApiError(409, 'CONFLICT', `Cannot transition complaint from ${complaint.status} to ${status}`);
  }
  const now = new Date();
  const updated = await Complaint.findOneAndUpdate(
    { _id: complaint.id, status: complaint.status },
    {
      $set: { status },
      $push: { statusHistory: { status, at: now, byUserId: String(req.user.id) } },
    },
    { new: true },
  );
  if (!updated) throw new ApiError(409, 'CONFLICT', 'Complaint changed; reload and retry');
  await logAudit(req, {
    action: 'complaint.status_change',
    entity: 'complaint',
    entityId: reference,
    meta: { from: complaint.status, to: status },
  });
  if (status === 'resolved' || status === 'closed') {
    sendMail({
      to: updated.contactEmail,
      subject: `Complaint ${reference} ${status}`,
      html: `<p>Your complaint <strong>${reference}</strong> is now ${status.replace('_', ' ')}.</p>`,
    });
  }
  return toPlainComplaint(updated);
}

export async function addAdminComplaintMessage(req, reference, { content, isInternal }) {
  const complaint = await Complaint.findOne({ reference });
  if (!complaint) throw new ApiError(404, 'NOT_FOUND', 'Complaint not found');
  if (complaint.status === 'closed') {
    throw new ApiError(409, 'CONFLICT', 'This complaint is closed and can no longer receive replies');
  }
  const now = new Date();
  const nextStatus = !isInternal && complaint.status !== 'awaiting_customer'
    ? 'awaiting_customer'
    : complaint.status;
  const updated = await Complaint.findOneAndUpdate(
    { _id: complaint.id, status: complaint.status },
    {
      $set: { ...(nextStatus !== complaint.status ? { status: nextStatus } : {}) },
      $push: {
        messages: {
          senderRole: 'admin',
          senderId: String(req.user.id),
          senderName: req.user.name,
          content,
          isInternal,
          createdAt: now,
        },
        ...(nextStatus !== complaint.status ? {
          statusHistory: { status: nextStatus, note: 'Support replied', at: now, byUserId: String(req.user.id) },
        } : {}),
      },
    },
    { new: true },
  );
  if (!updated) throw new ApiError(409, 'CONFLICT', 'Complaint changed; reload and retry');
  await logAudit(req, {
    action: isInternal ? 'complaint.internal_note' : 'complaint.reply',
    entity: 'complaint',
    entityId: reference,
    meta: { isInternal },
  });
  if (!isInternal) {
    sendMail({
      to: updated.contactEmail,
      subject: `A reply to complaint ${reference}`,
      html: `<p>${escapeHtml(req.user.name)} replied to your complaint <strong>${reference}</strong>.</p><p>${escapeHtml(content)}</p>`,
    });
  }
  return toPlainComplaint(updated);
}
