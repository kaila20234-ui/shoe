import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import { loadEnv } from '../config/env.js';
import { DeliveryZone, Discount, Product, User } from '../models/index.js';

loadEnv();

const passwordHash = await bcrypt.hash('Passw0rd!123', 12);
const accounts = [
  { name: 'Shoe Store Customer', email: 'customer@shoestore.test', role: 'customer' },
  { name: 'Shoe Store Admin', email: 'admin@shoestore.test', role: 'admin' },
  { name: 'Shoe Store Owner', email: 'owner@shoestore.test', role: 'owner' },
];

const productSeeds = [
  ['Air Runner One', 'Nike', 'men', 'sneakers', 850000],
  ['Court Classic', 'Adidas', 'men', 'sneakers', 720000],
  ['Metro Leather', 'Clarks', 'men', 'formal', 940000],
  ['Everyday Slide', 'Puma', 'men', 'sandals', 380000],
  ['Trail Motion', 'Nike', 'men', 'sports', 1100000],
  ['Chelsea Street Boot', 'Timberland', 'men', 'boots', 1350000],
  ['Cloud Walk', 'New Balance', 'women', 'sneakers', 790000],
  ['City Ballet Flat', 'Clarks', 'women', 'formal', 650000],
  ['Summer Comfort Sandal', 'Puma', 'women', 'sandals', 420000],
  ['Active Pace', 'Adidas', 'women', 'sports', 890000],
  ['Junior Sprint', 'Nike', 'kids', 'sneakers', 520000],
  ['Little Trek', 'Timberland', 'kids', 'boots', 680000],
];

const imageUrl = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80';

async function seed() {
  await connectDatabase();
  for (const account of accounts) {
    await User.findOneAndUpdate(
      { email: account.email },
      { $set: { ...account, passwordHash, isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  for (const [index, [name, brand, audience, type, price]] of productSeeds.entries()) {
    const baseSku = `SH-${String(index + 1).padStart(3, '0')}`;
    const variants = [39, 40, 41, 42, 43].map((size) => ({
      sku: `${baseSku}-${size}`,
      size,
      color: index % 2 ? 'Black' : 'White',
      stock: 8 + (index % 5),
    }));
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    await Product.findOneAndUpdate(
      { slug },
      {
        $set: {
          name,
          slug,
          description: `${name} by ${brand}, made for everyday comfort and dependable wear.`,
          brand,
          audience,
          type,
          price,
          images: [imageUrl],
          variants,
          isActive: true,
        },
        $setOnInsert: { ratingAverage: 0, ratingCount: 0 },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }

  const zones = [
    { name: 'Lagos', states: ['Lagos'], fee: 250000, estimatedDays: '1-2 days', isActive: true },
    { name: 'South West', states: ['Ogun', 'Oyo', 'Osun', 'Ondo', 'Ekiti'], fee: 400000, estimatedDays: '2-4 days', isActive: true },
    { name: 'Nationwide', states: ['Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Nasarawa', 'Niger', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'], fee: 650000, estimatedDays: '4-7 days', isActive: true },
  ];
  for (const zone of zones) {
    await DeliveryZone.findOneAndUpdate({ name: zone.name }, { $set: zone }, { upsert: true, new: true });
  }

  const discounts = [
    { code: 'WELCOME10', type: 'percentage', value: 10, minSubtotal: 0, maxUses: 1000, usedCount: 0, isActive: true },
    { code: 'SHOE5000', type: 'fixed', value: 500000, minSubtotal: 1000000, maxUses: 500, usedCount: 0, isActive: true },
  ];
  for (const discount of discounts) {
    await Discount.findOneAndUpdate(
      { code: discount.code },
      { $set: { ...discount, usedCount: 0 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  console.info(`Seeded ${accounts.length} accounts, ${productSeeds.length} products, ${zones.length} delivery zones, and ${discounts.length} discounts`);
  await mongoose.disconnect();
}

try {
  await seed();
} catch (error) {
  await mongoose.disconnect();
  console.error(error);
  process.exitCode = 1;
}
