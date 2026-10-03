const Pharmacy = require('../models/Pharmacy');
const User = require('../models/User');
const { seedUsers, assertDevelopmentDatabase } = require('./seed');
const mongoose = require('mongoose');
const path = require('node:path');
const dotenv = require('dotenv');
const schedule = (allDay, open = '08:00', close = '20:00') => Array.from({ length: 7 }, (_, day) => ({ day, closed: false, allDay, ...(!allDay ? { open, close } : {}) }));
const examples = [
  { name: 'Development City Pharmacy', latitude: 6.9271, longitude: 79.8612, openingHours: schedule(false), inventory: [{ name: 'Panadol', genericName: 'Paracetamol', quantity: 25, price: 120 }, { name: 'Vitamin C', genericName: 'Ascorbic Acid', quantity: 0, price: 750 }, { name: 'Amoxicillin', quantity: 15, price: 250 }, { name: 'Cetirizine', quantity: 30, price: 90 }] },
  { name: 'Development 24 Hour Pharmacy', latitude: 6.934, longitude: 79.872, openingHours: schedule(true), inventory: [{ name: 'Panadol', genericName: 'Paracetamol', quantity: 15, price: 125 }, { name: 'Vitamin C', quantity: 20, price: 700 }] },
  { name: 'Development Night Pharmacy', latitude: 6.916, longitude: 79.858, openingHours: schedule(false, '20:00', '06:00'), inventory: [{ name: 'Paracetamol', quantity: 30, price: 100 }, { name: 'Panadol', quantity: 0, price: 120 }] },
];
async function seedPharmacies(model = Pharmacy, owner) {
  for (const example of examples) {
    await model.updateOne({ owner, name: example.name }, { $setOnInsert: { ...example, owner, address: 'Development example, Colombo', district: 'Colombo', phone: '0112345678', timezone: 'Asia/Colombo' } }, { upsert: true, runValidators: true, setDefaultsOnInsert: true, timestamps: false });
    // Add missing examples to previously seeded pharmacies without overwriting owner edits.
    for (const medicine of example.inventory) await model.updateOne({ owner, name: example.name, 'inventory.name': { $ne: medicine.name } }, { $push: { inventory: medicine } }, { runValidators: true, timestamps: false });
  }
}
async function main() {
  dotenv.config({ path: path.join(__dirname, '../.env'), quiet: true });
  assertDevelopmentDatabase(process.env.MONGO_URI, process.env.NODE_ENV);
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await seedUsers();
  const owner = await User.findOne({ email: 'owner@medinear.test' });
  await seedPharmacies(Pharmacy, owner._id);
  console.log('Development pharmacies seeded; missing example medicines added, existing medicine values preserved.');
}
if (require.main === module) main().catch(() => { console.error('Seed failed. A local development MongoDB is required.'); process.exitCode = 1; }).finally(() => mongoose.disconnect());
module.exports = { seedPharmacies, examples };
