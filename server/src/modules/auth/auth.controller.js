import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../../models/index.js';
import ApiError from '../../utils/ApiError.js';
import { ok } from '../../utils/respond.js';
import { sendMail } from '../../utils/mailer.js';

function publicUser(user) {
  return user.toJSON();
}

function issueToken(user) {
  if (!process.env.JWT_SECRET) throw new ApiError(500, 'INTERNAL', 'JWT_SECRET is not configured');
  const token = jwt.sign(
    { sub: String(user.id), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );
  return { token, user: publicUser(user) };
}

export async function register(req, res) {
  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    passwordHash,
    ...(req.body.phone ? { phone: req.body.phone } : {}),
    role: 'customer',
  });
  return ok(res, issueToken(user), { status: 201 });
}

export async function login(req, res) {
  const user = await User.findOne({ email: req.body.email });
  if (!user || !await bcrypt.compare(req.body.password, user.passwordHash)) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Email or password is incorrect');
  }
  if (!user.isActive) throw new ApiError(403, 'FORBIDDEN', 'This account is blocked');
  return ok(res, issueToken(user));
}

export async function forgotPassword(req, res) {
  const user = await User.findOne({ email: req.body.email });
  if (user) {
    const token = randomBytes(32).toString('hex');
    user.resetPasswordTokenHash = createHash('sha256').update(token).digest('hex');
    user.resetPasswordExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${encodeURIComponent(token)}`;
    await sendMail({
      to: user.email,
      subject: 'Reset your Shoe Store password',
      html: `<p>Use this link to reset your password: <a href="${resetUrl}">${resetUrl}</a></p>`,
    });
  }
  return ok(res, {});
}

export async function resetPassword(req, res) {
  const tokenHash = createHash('sha256').update(req.body.token).digest('hex');
  const user = await User.findOne({
    resetPasswordTokenHash: tokenHash,
    resetPasswordExpiresAt: { $gt: new Date() },
  });
  if (!user) throw new ApiError(400, 'VALIDATION_ERROR', 'Password reset token is invalid or expired');
  user.passwordHash = await bcrypt.hash(req.body.password, 12);
  user.resetPasswordTokenHash = undefined;
  user.resetPasswordExpiresAt = undefined;
  await user.save();
  return ok(res, {});
}

export async function me(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  return ok(res, publicUser(user));
}

export async function updateProfile(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  if (req.body.name !== undefined) user.name = req.body.name;
  if (req.body.phone !== undefined) user.phone = req.body.phone;
  await user.save();
  return ok(res, publicUser(user));
}

export async function changePassword(req, res) {
  const user = await User.findById(req.user.id);
  if (!user || !await bcrypt.compare(req.body.currentPassword, user.passwordHash)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Current password is incorrect');
  }
  user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  await user.save();
  return ok(res, {});
}
