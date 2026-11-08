import { User } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { buildMeta } from '../../utils/paginate.js';
import { logAudit } from '../../utils/audit.js';

export async function listAddresses(userId) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  return user.addresses;
}

export async function addAddress(user, input) {
  if (input.isDefault) {
    user.addresses.forEach((address) => { address.isDefault = false; });
  }
  user.addresses.push(input);
  await user.save();
  return user.addresses[user.addresses.length - 1];
}

export async function updateAddress(user, addressId, patch) {
  const address = user.addresses.find((candidate) => candidate.id === addressId);
  if (!address) throw new ApiError(404, 'NOT_FOUND', 'Address not found');
  if (patch.isDefault) {
    user.addresses.forEach((candidate) => { candidate.isDefault = false; });
  }
  Object.assign(address, patch);
  await user.save();
  return address;
}

export async function deleteAddress(user, addressId) {
  const address = user.addresses.find((candidate) => candidate.id === addressId);
  if (!address) throw new ApiError(404, 'NOT_FOUND', 'Address not found');
  user.addresses.splice(user.addresses.indexOf(address), 1);
  await user.save();
}

export async function listCustomers({ page, limit, q }) {
  const filter = { role: 'customer' };
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const search = new RegExp(escaped, 'i');
    filter.$or = [{ name: search }, { email: search }, { phone: search }];
  }
  const [customers, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  return { data: customers, meta: buildMeta(page, limit, total) };
}

export async function setCustomerStatus(req, customerId, isActive) {
  const customer = await User.findOne({ _id: customerId, role: 'customer' });
  if (!customer) throw new ApiError(404, 'NOT_FOUND', 'Customer not found');
  customer.isActive = isActive;
  await customer.save();
  await logAudit(req, {
    action: isActive ? 'customer.unblock' : 'customer.block',
    entity: 'user',
    entityId: customer.id,
    meta: { isActive },
  });
  return customer;
}
