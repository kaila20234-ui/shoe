import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../../models/index.js';
import { config } from '../../config/env.js';
import ApiError from '../../utils/ApiError.js';
import { sendMail } from '../../utils/mailer.js';

function createAuthPayload(user) {
  const token = jwt.sign(
    { role: user.role },
    config.jwtSecret,
    { subject: String(user._id), expiresIn: config.jwtExpiresIn },
  );
  return { token, user };
}

export async function register({ name, email, password, phone }) {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name,
    email,
    passwordHash,
    phone,
    role: 'customer',
    isActive: true,
  });
  return createAuthPayload(user);
}

export async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Email or password is incorrect');
  }
  if (!user.isActive) throw new ApiError(403, 'FORBIDDEN', 'This account is blocked');
  return createAuthPayload(user);
}

export async function forgotPassword(email) {
  const user = await User.findOne({ email });
  if (!user) return;

  const token = randomBytes(32).toString('hex');
  user.resetPasswordTokenHash = createHash('sha256').update(token).digest('hex');
  user.resetPasswordExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  const resetUrl = `${config.clientUrl}/reset-password?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: user.email,
    subject: 'Reset your Shoe Store password',
    html: `<p>Use this link to reset your password. It expires in one hour.</p><p><a href="${resetUrl}">Reset password</a></p>`,
  });
}

export async function resetPassword({ token, password }) {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    resetPasswordTokenHash: tokenHash,
    resetPasswordExpiresAt: { $gt: new Date() },
  }).select('+resetPasswordTokenHash +resetPasswordExpiresAt');
  if (!user) throw new ApiError(400, 'VALIDATION_ERROR', 'Reset token is invalid or expired');

  user.passwordHash = await bcrypt.hash(password, 12);
  user.resetPasswordTokenHash = undefined;
  user.resetPasswordExpiresAt = undefined;
  await user.save();
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Current password is incorrect', {
      currentPassword: 'Current password is incorrect',
    });
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
}
