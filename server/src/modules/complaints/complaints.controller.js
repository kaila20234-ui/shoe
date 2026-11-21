import { ok } from '../../utils/respond.js';
import {
  addAdminComplaintMessage,
  addCustomerComplaintMessage,
  addGuestComplaintMessage,
  createComplaint,
  getAdminComplaint,
  getCustomerComplaint,
  getGuestComplaint,
  listAdminComplaints,
  listCustomerComplaints,
  updateAdminComplaintStatus,
} from './complaints.service.js';

export async function create(req, res) {
  const result = await createComplaint(req, req.body);
  return ok(res, result, { status: 201 });
}

export async function listCustomer(req, res) {
  const result = await listCustomerComplaints(req.user.id, req.query);
  return ok(res, result.items, { meta: result.meta });
}

export async function getCustomer(req, res) {
  return ok(res, await getCustomerComplaint(req.user.id, req.params.reference));
}

export async function replyCustomer(req, res) {
  return ok(res, await addCustomerComplaintMessage(req.user.id, req.params.reference, req.body.content));
}

export async function getGuest(req, res) {
  return ok(res, await getGuestComplaint(req.params.reference, req.get('x-complaint-token')));
}

export async function replyGuest(req, res) {
  return ok(res, await addGuestComplaintMessage(
    req.params.reference,
    req.get('x-complaint-token'),
    req.body.content,
  ));
}

export async function listAdmin(req, res) {
  const result = await listAdminComplaints(req.query);
  return ok(res, result.items, { meta: result.meta });
}

export async function getAdmin(req, res) {
  return ok(res, await getAdminComplaint(req.params.reference));
}

export async function updateStatus(req, res) {
  return ok(res, await updateAdminComplaintStatus(req, req.params.reference, req.body.status));
}

export async function replyAdmin(req, res) {
  return ok(res, await addAdminComplaintMessage(req, req.params.reference, req.body));
}
