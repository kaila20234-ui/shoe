import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import { AuditLog, Cart, DeliveryZone, Discount, Order, Product, ReturnRequest, Review, Transaction, User } from '../models/index.js';

const password = await bcrypt.hash('Passw0rd!123', 12);
const users = [
  { name: 'Ada Okafor', email: 'customer@shoestore.test', role: 'customer' },
  { name: 'Tunde Adeyemi', email: 'admin@shoestore.test', role: 'admin' },
  { name: 'Ngozi Eze', email: 'owner@shoestore.test', role: 'owner' },
];

const zones = [
  {
    name: 'Lagos',
    states: ['Lagos'],
    fee: 250000,
    estimatedDays: '1-2 days',
    isActive: true,
  },
  {
    name: 'South-West',
    states: ['Ekiti', 'Ogun', 'Ondo', 'Osun', 'Oyo'],
    fee: 400000,
    estimatedDays: '2-4 days',
    isActive: true,
  },
  {
    name: 'Rest of Nigeria',
    states: [
      'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
      'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Enugu', 'Federal Capital Territory',
      'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
      'Nasarawa', 'Niger', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
    ],
    fee: 650000,
    estimatedDays: '3-7 days',
    isActive: true,
  },
];

const discounts = [
  { code: 'WELCOME10', type: 'percentage', value: 10, minSubtotal: 0, isActive: true },
  { code: 'FREESHIP', type: 'fixed', value: 150000, minSubtotal: 0, isActive: true },
];

const products = [
  ['Urban Pace Runner', 'urban-pace-runner', 'StrideLab', 'men', 'sneakers', 1850000, ['black', 'white'], [40, 41, 42, 43], [7, 12, 0]],
  ['Classic Court Low', 'classic-court-low', 'Northline', 'women', 'sneakers', 1620000, ['white', 'navy'], [36, 37, 38, 39], [2, 15, 20]],
  ['Everyday Slide', 'everyday-slide', 'Coaststep', 'men', 'sandals', 650000, ['brown', 'black'], [40, 42, 44], [11, 0, 5]],
  ['City Formal Oxford', 'city-formal-oxford', 'Alder & Row', 'men', 'formal', 2450000, ['black'], [40, 41, 42, 43], [4, 8, 13]],
  ['Trailbound Hiker', 'trailbound-hiker', 'TerraForm', 'men', 'boots', 3120000, ['olive', 'charcoal'], [41, 42, 43, 44], [0, 6, 9]],
  ['Junior Dash', 'junior-dash', 'StrideLab', 'kids', 'sports', 980000, ['blue', 'coral'], [30, 31, 32, 33], [18, 12, 5]],
  ['Softstep Ballet Flat', 'softstep-ballet-flat', 'Mira Lane', 'women', 'formal', 1190000, ['tan', 'black'], [36, 37, 38, 39], [1, 7, 11]],
  ['Weekend Trek Sandal', 'weekend-trek-sandal', 'Coaststep', 'women', 'sandals', 870000, ['sand', 'teal'], [37, 38, 39, 40], [16, 8, 3]],
  ['Courtline High Top', 'courtline-high-top', 'Northline', 'men', 'sneakers', 2240000, ['red', 'white'], [40, 41, 42, 43], [6, 14, 2]],
  ['Little Explorer Boot', 'little-explorer-boot', 'TerraForm', 'kids', 'boots', 1380000, ['brown', 'navy'], [29, 30, 31, 32], [10, 0, 4]],
  ['Tempo Knit Trainer', 'tempo-knit-trainer', 'StrideLab', 'women', 'sports', 1980000, ['lilac', 'black'], [37, 38, 39, 40], [9, 17, 6]],
  ['Office Ease Loafer', 'office-ease-loafer', 'Alder & Row', 'women', 'formal', 2160000, ['burgundy', 'black'], [36, 37, 38, 39], [3, 10, 15]],
];

async function seed() {
  await connectDatabase();

  await Promise.all(
    [User, Product, Cart, Order, Transaction, Discount, DeliveryZone, Review, ReturnRequest, AuditLog]
      .map((model) => model.createIndexes()),
  );

  for (const user of users) {
    await User.updateOne(
      { email: user.email },
      { $setOnInsert: { ...user, passwordHash: password, isActive: true, addresses: [], wishlist: [] } },
      { upsert: true },
    );
  }

  for (const zone of zones) {
    await DeliveryZone.updateOne({ name: zone.name }, { $set: zone }, { upsert: true });
  }
  for (const discount of discounts) {
    await Discount.updateOne(
      { code: discount.code },
      { $set: discount, $setOnInsert: { usedCount: 0 } },
      { upsert: true },
    );
  }

  for (const [index, product] of products.entries()) {
    const [name, slug, brand, audience, type, price, colors, sizes, stockLevels] = product;
    const variants = colors.flatMap((color, colorIndex) =>
      sizes.map((size, sizeIndex) => ({
        sku: `${brand.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 3)}-${String(index + 1).padStart(2, '0')}-${color.slice(0, 3).toUpperCase()}-${size}`,
        size,
        color,
        stock: stockLevels[(colorIndex + sizeIndex) % stockLevels.length],
      })),
    );
    const images = [
      `https://placehold.co/800x800?text=${encodeURIComponent(name)}`,
      `https://placehold.co/800x800?text=${encodeURIComponent(`${name} side view`)}`,
      `https://placehold.co/800x800?text=${encodeURIComponent(`${name} detail`)}`,
    ];

    await Product.updateOne(
      { slug },
      {
        $setOnInsert: {
          name,
          description: `${name} combines everyday comfort with a versatile design, made for life on the move.`,
          brand,
          audience,
          type,
          price,
          images,
          variants,
          isActive: true,
          ratingAverage: 0,
          ratingCount: 0,
        },
      },
      { upsert: true },
    );
  }

  console.info('Seed data is ready.');
}

seed()
  .catch((error) => {
    console.error('Unable to seed database:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
