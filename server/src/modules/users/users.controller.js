import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { User } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { logAudit } from '../../utils/audit.js';
import { buildMeta, parsePagination } from '../../utils/paginate.js';
import { ok } from '../../utils/respond.js';

async function getCustomer(req) {
  const user = await User.findOne({ _id: req.user.id, role: 'customer' });
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'Customer not found');
  return user;
}

export async function listAddresses(req, res) {
  const user = await getCustomer(req);
  return ok(res, user.addresses);
}

export async function addAddress(req, res) {
  const user = await getCustomer(req);
  const address = { id: randomUUID(), ...req.body, isDefault: Boolean(req.body.isDefault) };
  if (address.isDefault) user.addresses.forEach((current) => { current.isDefault = false; });
  user.addresses.push(address);
  await user.save();
  return ok(res, user.addresses.find((current) => current.id === address.id), { status: 201 });
}

export async function updateAddress(req, res) {
  const user = await getCustomer(req);
  const address = user.addresses.find((current) => current.id === req.params.id);
  if (!address) throw new ApiError(404, 'NOT_FOUND', 'Address not found');
  if (req.body.isDefault) user.addresses.forEach((current) => { current.isDefault = current.id === address.id; });
  Object.assign(address, req.body);
  await user.save();
  return ok(res, address);
}

export async function removeAddress(req, res) {
  const user = await getCustomer(req);
  const address = user.addresses.find((current) => current.id === req.params.id);
  if (!address) throw new ApiError(404, 'NOT_FOUND', 'Address not found');
  user.addresses.pull({ id: req.params.id });
  await user.save();
  return ok(res, {});
}

export async function listCustomers(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { role: 'customer' };
  if (req.query.q) {
    const query = req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: new RegExp(query, 'i') }, { email: new RegExp(query, 'i') }];
  }
  const [customers, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  return ok(res, customers, { meta: buildMeta(page, limit, total) });
}

export async function createAdmin(req, res) {
  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const admin = await User.create({
    name: req.body.name,
    email: req.body.email,
    passwordHash,
    role: 'admin',
  });
  await logAudit(req, {
    action: 'admin.create',
    entity: 'admin',
    entityId: admin.id,
  });
  return ok(res, admin, { status: 201 });
}

export async function updateCustomerStatus(req, res) {
  const customer = await User.findOneAndUpdate(
    { _id: req.params.id, role: 'customer' },
    { $set: { isActive: req.body.isActive } },
    { new: true, runValidators: true },
  );
  if (!customer) throw new ApiError(404, 'NOT_FOUND', 'Customer not found');
  await logAudit(req, {
    action: 'customer.status_change',
    entity: 'customer',
    entityId: customer.id,
    meta: { isActive: customer.isActive },
  });
  return ok(res, customer);
}
