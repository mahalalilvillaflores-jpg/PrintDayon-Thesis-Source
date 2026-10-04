const User = require('../models/User');
const PrintingShop = require('../models/PrintingShop');
const PrintingRequest = require('../models/PrintingRequest');

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

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
  { name: 'Color Printing', description: 'Full-color document printing', available: true },
  { name: 'Photocopying', description: 'Document photocopying', available: true },
  { name: 'Scanning', description: 'Document scanning to PDF/JPEG', available: true },
  { name: 'Binding', description: 'Spiral and staple binding', available: true },
];

async function autoSeed() {
  try {
    const shopCount = await PrintingShop.countDocuments();
    if (shopCount > 0) {
      console.log(`ℹ️ Database already has ${shopCount} printing shop(s). Verifying coordinate integrity...`);
      try {
        const invalidShops = await PrintingShop.find({
          $or: [
            { latitude: null },
            { longitude: null },
            { 'location.coordinates': { $exists: false } },
          ],
        });
        for (const s of invalidShops) {
          s.latitude = Number(s.latitude || s.lat || s.location?.coordinates?.[1] || 11.563591);
          s.longitude = Number(s.longitude || s.lng || s.location?.coordinates?.[0] || 124.398505);
          s.location = { type: 'Point', coordinates: [s.longitude, s.latitude] };
          s.status = s.status || 'open';
          s.verificationStatus = s.verificationStatus || 'verified';
          await s.save();
        }
      } catch (_) {}
      return;
    }

    console.log('🌱 Fresh database detected (0 shops). Auto-seeding initial Naval shops and accounts...');

    // 1. Ensure at least one Admin account
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      admin = new User({
        name: 'PrintDayon Admin',
        email: 'admin@printdayon.com',
        password: 'adminpassword123',
        contactNumber: '09170000000',
        role: 'admin',
      });
      await admin.save();
      console.log('✔ Created default Admin: admin@printdayon.com / adminpassword123');
    }

    // 2. Create Shop Owners
    const ownersData = [
      { name: 'Maria Santos', email: 'maria.santos@printdayon.com', contactNumber: '09171234567' },
      { name: 'Juan Dela Cruz', email: 'juan.delacruz@printdayon.com', contactNumber: '09271234568' },
      { name: 'Ana Reyes', email: 'ana.reyes@printdayon.com', contactNumber: '09181234569' },
      { name: 'Roberto Villanueva', email: 'roberto.v@printdayon.com', contactNumber: '09091234570' },
      { name: 'Lena Mangosing', email: 'lena.mangosing@printdayon.com', contactNumber: '09281234571' },
    ];

    const owners = [];
    for (const d of ownersData) {
      let owner = await User.findOne({ email: d.email });
      if (!owner) {
        owner = new User({ ...d, password: 'owner123', role: 'shop_owner' });
        await owner.save();
      }
      owners.push(owner);
    }

    // 3. Create default Customer
    let customer = await User.findOne({ email: 'student@printdayon.com' });
    if (!customer) {
      customer = new User({
        name: 'Sample Student',
        email: 'student@printdayon.com',
        password: 'student123',
        contactNumber: '09101234572',
        role: 'customer',
      });
      await customer.save();
      console.log('✔ Created default Student: student@printdayon.com / student123');
    }

    // 4. Create Verified Naval Printing Shops
    const shopsData = [
      {
        ownerId: owners[0]._id,
        shopName: 'Know-well Office Systems',
        address: 'Redaza Street, Naval, Biliran',
        landmark: 'Near Naval Central School & Cathedral',
        locationDescription: 'Near Naval Central School & Cathedral',
        latitude: 11.56250,
        longitude: 124.39593,
        location: { type: 'Point', coordinates: [124.39593, 11.56250] },
        description: 'Full sublimation printing, jerseys, custom apparel, and document printing solutions.',
        contactNumber: '053-500-3429',
        services: [
          ...coreServices,
          { name: 'Full Sublimation', description: 'Jerseys and apparel sublimation', available: true },
          { name: 'Tarpaulin', description: 'Large-format banners and tarp', available: true },
        ],
        pricing: { ...defaultPricing, bwPerPage: 3, colorPerPage: 8, speedPerPageSeconds: 4 },
        operatingHours,
        status: 'open',
        verificationStatus: 'verified',
        currentQueue: 2,
        activeJobs: 1,
        isAcceptingRequests: true,
        graphNodeId: 'N024',
      },
      {
        ownerId: owners[1]._id,
        shopName: 'Biliran Paperworks (BiPSU Gate 1)',
        address: 'P.I. Garcia St. (Fronting BiPSU Gate 1), Naval, Biliran',
        landmark: 'Fronting BiPSU Gate 1 (Near the university entrance)',
        locationDescription: 'Fronting BiPSU Gate 1 (Near the university entrance)',
        latitude: 11.56620,
        longitude: 124.39850,
        location: { type: 'Point', coordinates: [124.39850, 11.56620] },
        description: 'Directly across BiPSU Gate 1. Thesis printing, bookbinding, photocopying, and school supplies.',
        contactNumber: '09751480189',
        services: [
          ...coreServices,
          { name: 'ID Photo', description: '1x1 and 2x2 passport/ID photos', available: true },
        ],
        pricing: { ...defaultPricing, bwPerPage: 2.5, colorPerPage: 7, speedPerPageSeconds: 5 },
        operatingHours,
        status: 'open',
        verificationStatus: 'verified',
        currentQueue: 5,
        activeJobs: 2,
        isAcceptingRequests: true,
        graphNodeId: 'N022',
      },
      {
        ownerId: owners[2]._id,
        shopName: 'Printa Naval',
        address: 'Caneja Extension, Brgy. P.I. Garcia, Naval, Biliran',
        landmark: 'Near BiPSU Gymnasium & Caneja St.',
        locationDescription: 'Near BiPSU Gymnasium & Caneja St.',
        latitude: 11.56500,
        longitude: 124.39700,
        location: { type: 'Point', coordinates: [124.39700, 11.56500] },
        description: 'Full sublimation, t-shirt/polo shirt printing, corporate uniforms, and customized print orders.',
        contactNumber: '09181234569',
        services: [
          ...coreServices,
          { name: 'T-Shirt Printing', description: 'Silk screen, heat press, and sublimation', available: true },
        ],
        pricing: { ...defaultPricing, bwPerPage: 3, colorPerPage: 8, speedPerPageSeconds: 5 },
        operatingHours,
        status: 'open',
        verificationStatus: 'verified',
        currentQueue: 1,
        activeJobs: 1,
        isAcceptingRequests: true,
        graphNodeId: 'N025',
      },
      {
        ownerId: owners[3]._id,
        shopName: 'Braice Prints & Apparel',
        address: 'Vicentillo Ext., Brgy. P.I. Garcia, Naval, Biliran',
        landmark: 'Near the school (BiPSU & Cathedral School of La Naval)',
        locationDescription: 'Near the school (BiPSU & Cathedral School of La Naval)',
        latitude: 11.56400,
        longitude: 124.39900,
        location: { type: 'Point', coordinates: [124.39900, 11.56400] },
        description: 'Custom apparel, heat transfer, document photocopy, and personalized gifts.',
        contactNumber: '053-500-0071',
        services: [
          ...coreServices,
          { name: 'Heat Transfer', description: 'Apparel and mug heat transfer printing', available: true },
        ],
        pricing: { ...defaultPricing, bwPerPage: 3, colorPerPage: 8, speedPerPageSeconds: 4 },
        operatingHours,
        status: 'open',
        verificationStatus: 'verified',
        currentQueue: 0,
        activeJobs: 0,
        isAcceptingRequests: true,
        graphNodeId: 'N026',
      },
      {
        ownerId: owners[4]._id,
        shopName: 'LA- Naval Printing Press',
        address: 'Vicentillo Extension, Brgy. P.I. Garcia, Naval, Biliran',
        landmark: 'Near BiPSU Main Campus',
        locationDescription: 'Near BiPSU Main Campus',
        latitude: 11.563591,
        longitude: 124.398505,
        location: { type: 'Point', coordinates: [124.398505, 11.563591] },
        description: 'High-speed document reproduction, photocopying, spiral binding, and thesis printing.',
        contactNumber: '09178889999',
        services: coreServices,
        pricing: { ...defaultPricing, bwPerPage: 2, colorPerPage: 6, speedPerPageSeconds: 4 },
        operatingHours,
        status: 'open',
        verificationStatus: 'verified',
        currentQueue: 3,
        activeJobs: 1,
        isAcceptingRequests: true,
        graphNodeId: 'N022',
      },
    ];

    await PrintingShop.insertMany(shopsData);
    console.log(`✔ Auto-seeded ${shopsData.length} verified printing shops in Naval.`);
  } catch (error) {
    console.error('⚠️ Auto-seed failed (non-fatal):', error.message);
  }
}

module.exports = autoSeed;
