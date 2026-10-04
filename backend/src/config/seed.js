
require('dotenv').config();
const mongoose = require('mongoose');

const User          = require('../models/User');
const PrintingShop  = require('../models/PrintingShop');
const PrintingRequest = require('../models/PrintingRequest');
const Document      = require('../models/Document');
const Notification  = require('../models/Notification');
const connectDB     = require('./db');

const c = { green:'\x1b[32m', cyan:'\x1b[36m', yellow:'\x1b[33m', bold:'\x1b[1m', reset:'\x1b[0m', gray:'\x1b[90m' };
const log = {
  ok:  (m) => console.log(`${c.green}✔${c.reset}  ${m}`),
  info:(m) => console.log(`${c.cyan}i${c.reset}  ${m}`),
  row: (m) => console.log(`   ${c.gray}${m}${c.reset}`),
  div: ()  => console.log(`${c.gray}${'─'.repeat(56)}${c.reset}`),
};

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

const operatingHours = DAYS.map((day) => ({
  day,
  open: '07:00',
  close: '21:00',
  isClosed: day === 'sunday',
}));

const defaultPricing = {
  bwPerPage: 3,
  colorPerPage: 8,
  a4Multiplier: 1,
  a3Multiplier: 1.5,
  legalMultiplier: 1.2,
  doublesidedDiscount: 0,
  bindingCost: 35,
  speedPerPageSeconds: 5,
};

const coreServices = [
  { name: 'Black & White Printing', description: 'Standard B&W document printing', available: true },
  { name: 'Color Printing',         description: 'Full-color document printing',    available: true },
  { name: 'Photocopying',           description: 'Document photocopying',           available: true },
  { name: 'Scanning',               description: 'Document scanning to PDF/JPEG',   available: true },
  { name: 'Binding',                description: 'Spiral and staple binding',        available: true },
];

async function seed() {
  await connectDB();
  console.log('\n');
  log.div();
  console.log(`${c.bold}${c.cyan}  PrintDayon — Database Seed${c.reset}`);
  log.div();
  console.log();

  log.info('Preserving admin accounts...');
  const existingAdmins = await User.find({ role: 'admin' });
  log.ok(`Found ${existingAdmins.length} existing admin(s) — keeping them.`);

  log.info('Clearing non-admin data...');
  await Promise.all([
    User.deleteMany({ role: { $ne: 'admin' } }),
    PrintingShop.deleteMany({}),
    PrintingRequest.deleteMany({}),
    Document.deleteMany({}),
    Notification.deleteMany({}),
  ]);
  log.ok('Cleared shops, requests, documents, notifications.\n');

  log.info('Creating shop owners...');

  const ownersData = [
    { name: 'Maria Santos',     email: 'maria.santos@printdayon.com',   contactNumber: '09171234567' },
    { name: 'Juan Dela Cruz',   email: 'juan.delacruz@printdayon.com',  contactNumber: '09271234568' },
    { name: 'Ana Reyes',        email: 'ana.reyes@printdayon.com',       contactNumber: '09181234569' },
    { name: 'Roberto Villanueva', email: 'roberto.v@printdayon.com',    contactNumber: '09091234570' },
    { name: 'Lena Mangosing',   email: 'lena.mangosing@printdayon.com', contactNumber: '09281234571' },
  ];

  const owners = [];
  for (const d of ownersData) {
    const owner = new User({ ...d, password: 'owner123', role: 'shop_owner' });
    await owner.save();
    owners.push(owner);
    log.row(`Shop Owner: ${d.name}  •  ${d.email}  •  pw: owner123`);
  }
  log.ok(`${owners.length} shop owners created.\n`);

  log.info('Creating customers...');

  const customersData = [
    { name: 'John Carlo Lim',       email: 'johnlim@printdayon.com',      contactNumber: '09101234572' },
    { name: 'Jane Marie Delos Santos', email: 'janeds@printdayon.com',    contactNumber: '09201234573' },
    { name: 'Carlos Manalo',        email: 'carlos.manalo@printdayon.com', contactNumber: '09151234574' },
    { name: 'Patricia Gonzales',    email: 'pat.gonzales@printdayon.com', contactNumber: '09301234575' },
    { name: 'Mark Anthony Tan',     email: 'marktan@printdayon.com',      contactNumber: '09121234576' },
    { name: 'Kristine Laguna',      email: 'kris.laguna@printdayon.com',  contactNumber: '09221234577' },
    { name: 'Roldan Navarro',       email: 'roldan.nav@printdayon.com',   contactNumber: '09321234578' },
    { name: 'Sheila Caballero',     email: 'sheila.c@printdayon.com',     contactNumber: '09131234579' },
  ];

  const customers = [];
  for (const d of customersData) {
    const cust = new User({ ...d, password: 'customer123', role: 'customer' });
    await cust.save();
    customers.push(cust);
    log.row(`Customer: ${d.name}  •  ${d.email}  •  pw: customer123`);
  }
  log.ok(`${customers.length} customers created.\n`);

  log.info('Creating printing shops in Naval, Biliran...');

  const shopsData = [
    {
      ownerId:            owners[0]._id,
      shopName:           'Know-well Office Systems',
      address:            'Redaza Street, Naval, Biliran',
      landmark:           'Near Naval Central School & Cathedral',
      locationDescription: 'Near Naval Central School & Cathedral',
      latitude:           11.56250,
      longitude:          124.39593,
      location:           { type: 'Point', coordinates: [124.39593, 11.56250] },
      description:        'Full sublimation printing, jerseys, custom apparel, and document printing solutions.',
      contactNumber:      '053-500-3429',
      services: [
        ...coreServices,
        { name: 'Full Sublimation', description: 'Jerseys and apparel sublimation', available: true },
        { name: 'Tarpaulin',        description: 'Large-format banners and tarp',   available: true },
      ],
      pricing:            { ...defaultPricing, bwPerPage: 3, colorPerPage: 8, speedPerPageSeconds: 4 },
      operatingHours,
      status:             'open',
      verificationStatus: 'verified',
      currentQueue:       2,
      activeJobs:         1,
      isAcceptingRequests: true,
      graphNodeId:        'N024',
    },
    {
      ownerId:            owners[1]._id,
      shopName:           'Biliran Paperworks (BiPSU Gate 1)',
      address:            'P.I. Garcia St. (Fronting BiPSU Gate 1), Naval, Biliran',
      landmark:           'Fronting BiPSU Gate 1 (Near the university entrance)',
      locationDescription: 'Fronting BiPSU Gate 1 (Near the university entrance)',
      latitude:           11.56620,
      longitude:          124.39850,
      location:           { type: 'Point', coordinates: [124.39850, 11.56620] },
      description:        'Directly across BiPSU Gate 1. Thesis printing, bookbinding, photocopying, and school supplies.',
      contactNumber:      '09751480189',
      services: [
        ...coreServices,
        { name: 'ID Photo',         description: '1x1 and 2x2 passport/ID photos',              available: true },
      ],
      pricing:            { ...defaultPricing, bwPerPage: 2.5, colorPerPage: 7, speedPerPageSeconds: 5 },
      operatingHours,
      status:             'open',
      verificationStatus: 'verified',
      currentQueue:       5,
      activeJobs:         2,
      isAcceptingRequests: true,
      graphNodeId:        'N022',
    },
    {
      ownerId:            owners[2]._id,
      shopName:           'Printa Naval',
      address:            'Caneja Extension, Brgy. P.I. Garcia, Naval, Biliran',
      landmark:           'Near BiPSU Gymnasium & Caneja St.',
      locationDescription: 'Near BiPSU Gymnasium & Caneja St.',
      latitude:           11.56500,
      longitude:          124.39700,
      location:           { type: 'Point', coordinates: [124.39700, 11.56500] },
      description:        'Full sublimation, t-shirt/polo shirt printing, corporate uniforms, and customized print orders.',
      contactNumber:      '09181234569',
      services: [
        ...coreServices,
        { name: 'T-Shirt Printing', description: 'Silk screen, heat press, and sublimation', available: true },
      ],
      pricing:            { ...defaultPricing, bwPerPage: 3, colorPerPage: 8, speedPerPageSeconds: 5 },
      operatingHours,
      status:             'open',
      verificationStatus: 'verified',
      currentQueue:       1,
      activeJobs:         1,
      isAcceptingRequests: true,
      graphNodeId:        'N025',
    },
    {
      ownerId:            owners[3]._id,
      shopName:           'Braice Prints & Apparel',
      address:            'Vicentillo Ext., Brgy. P.I. Garcia, Naval, Biliran',
      landmark:           'Near the school (BiPSU & Cathedral School of La Naval)',
      locationDescription: 'Near the school (BiPSU & Cathedral School of La Naval)',
      latitude:           11.56400,
      longitude:          124.39900,
      location:           { type: 'Point', coordinates: [124.39900, 11.56400] },
      description:        'Custom apparel, heat transfer, document photocopy, and personalized gifts.',
      contactNumber:      '053-500-0071',
      services: [
        ...coreServices,
        { name: 'Heat Transfer', description: 'Apparel and mug heat transfer printing', available: true },
        { name: 'Lamination',    description: 'Document and ID card lamination',       available: true },
      ],
      pricing:            { ...defaultPricing, bwPerPage: 3, colorPerPage: 8, speedPerPageSeconds: 6 },
      operatingHours,
      status:             'open',
      verificationStatus: 'verified',
      currentQueue:       3,
      activeJobs:         1,
      isAcceptingRequests: true,
      graphNodeId:        'N021',
    },
    {
      ownerId:            owners[4]._id,
      shopName:           'Biliran Paperworks (PSA Branch)',
      address:            'P.I. Garcia St. (Fronting PSA Office), Naval, Biliran',
      landmark:           'Fronting PSA Office & Near BiPSU Gate 2',
      locationDescription: 'Fronting PSA Office & Near BiPSU Gate 2',
      latitude:           11.56780,
      longitude:          124.40150,
      location:           { type: 'Point', coordinates: [124.40150, 11.56780] },
      description:        'Convenient document printing, government form preparation, photocopying, and scanning.',
      contactNumber:      '09281234571',
      services: [
        ...coreServices,
        { name: 'Government Document Prep', description: 'PSA, NBI, and passport requirements copy & print', available: true },
      ],
      pricing:            { ...defaultPricing, bwPerPage: 3, colorPerPage: 8, speedPerPageSeconds: 5 },
      operatingHours,
      status:             'open',
      verificationStatus: 'verified',
      currentQueue:       2,
      activeJobs:         1,
      isAcceptingRequests: true,
      graphNodeId:        'N026',
    },
  ];

  const shops = [];
  for (const d of shopsData) {
    const shop = new PrintingShop(d);
    await shop.save();
    shops.push(shop);
    log.row(`${shop.shopName}  •  ${shop.verificationStatus}  •  queue: ${shop.currentQueue}`);
  }
  log.ok(`${shops.length} printing shops created.\n`);

  const sampleDoc = await Document.create({
    customerId:       customers[0]._id,
    originalFilename: 'thesis_chapter1.pdf',
    storedFilename:   'seed-doc-thesis.pdf',
    fileType:         'pdf',
    fileSize:         204800,
    storagePath:      'uploads/seed-doc-thesis.pdf',
    pageCount:        25,
  });

  log.info('Creating sample printing requests...');

  await PrintingRequest.insertMany([
    {
      customerId:  customers[0]._id,
      shopId:      shops[0]._id,
      documentId:  sampleDoc._id,
      printingSpecifications: {
        copies: 1, totalPages: 10, colorMode: 'black_and_white',
        sided: 'single', paperSize: 'A4', paperType: 'bond', binding: 'none',
      },
      estimatedCost: 30, estimatedTravelTime: 3,
      estimatedWaitingTime: 5, estimatedPrintingTime: 2, estimatedCompletionTime: 10,
      queuePosition: 1,
      status: 'printing',
      printingStartedAt: new Date(Date.now() - 60_000),
      acceptedAt:        new Date(Date.now() - 120_000),
      submittedAt:       new Date(Date.now() - 180_000),
    },
    {
      customerId:  customers[1]._id,
      shopId:      shops[0]._id,
      documentId:  sampleDoc._id,
      printingSpecifications: {
        copies: 2, totalPages: 5, colorMode: 'black_and_white',
        sided: 'single', paperSize: 'A4', paperType: 'bond', binding: 'staple',
      },
      estimatedCost: 35, estimatedTravelTime: 5,
      estimatedWaitingTime: 8, estimatedPrintingTime: 3, estimatedCompletionTime: 16,
      queuePosition: 2,
      status: 'queued',
      acceptedAt:  new Date(Date.now() - 60_000),
      submittedAt: new Date(Date.now() - 120_000),
    },
    {
      customerId:  customers[2]._id,
      shopId:      shops[1]._id,
      documentId:  sampleDoc._id,
      printingSpecifications: {
        copies: 1, totalPages: 20, colorMode: 'color',
        sided: 'double', paperSize: 'A4', paperType: 'bond', binding: 'spiral',
      },
      estimatedCost: 160, estimatedTravelTime: 4,
      estimatedWaitingTime: 10, estimatedPrintingTime: 5, estimatedCompletionTime: 19,
      queuePosition: 0,
      status: 'completed',
      printingStartedAt: new Date(Date.now() - 600_000),
      acceptedAt:        new Date(Date.now() - 700_000),
      completedAt:       new Date(Date.now() - 300_000),
      submittedAt:       new Date(Date.now() - 800_000),
    },
    {
      customerId:  customers[3]._id,
      shopId:      shops[2]._id,
      documentId:  sampleDoc._id,
      printingSpecifications: {
        copies: 3, totalPages: 8, colorMode: 'black_and_white',
        sided: 'single', paperSize: 'Legal', paperType: 'bond', binding: 'none',
      },
      estimatedCost: 29, estimatedTravelTime: 6,
      estimatedWaitingTime: 3, estimatedPrintingTime: 2, estimatedCompletionTime: 11,
      queuePosition: 0,
      status: 'pending',
      submittedAt: new Date(Date.now() - 30_000),
    },
    {
      customerId:  customers[4]._id,
      shopId:      shops[3]._id,
      documentId:  sampleDoc._id,
      printingSpecifications: {
        copies: 1, totalPages: 15, colorMode: 'color',
        sided: 'single', paperSize: 'A4', paperType: 'photo', binding: 'none',
      },
      estimatedCost: 120, estimatedTravelTime: 7,
      estimatedWaitingTime: 12, estimatedPrintingTime: 4, estimatedCompletionTime: 23,
      queuePosition: 0,
      status: 'cancelled',
      cancellationReason: 'Customer changed mind.',
      submittedAt:        new Date(Date.now() - 1_200_000),
    },
  ]);

  log.ok('Sample requests created (printing, queued, completed, pending, cancelled).\n');

  log.div();
  console.log(`${c.bold}${c.green}  🎉 Seed completed successfully!${c.reset}`);
  log.div();
  console.log();
  console.log(`${c.bold}  Test Accounts:${c.reset}`);

  const allAdmins = await User.find({ role: 'admin' }).select('name email');
  allAdmins.forEach(a => log.row(`Admin:    ${a.email}  •  (your password)`));

  ownersData.forEach(o => log.row(`Owner:    ${o.email}  •  owner123`));
  customersData.slice(0,3).forEach(c2 => log.row(`Customer: ${c2.email}  •  customer123`));
  console.log(`   ${c.gray}... and ${customersData.length - 3} more customers${c.reset}`);

  console.log();
  console.log(`${c.bold}  Database Summary:${c.reset}`);
  log.row(`Total Users:  ${existingAdmins.length} admin(s) + ${owners.length} shop owners + ${customers.length} customers`);
  log.row(`Total Shops:  ${shops.length} (all verified, Naval, Biliran)`);
  log.row(`Total Requests: 5 (printing/queued/completed/pending/cancelled)`);
  console.log();
  log.div();
  console.log();

  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
