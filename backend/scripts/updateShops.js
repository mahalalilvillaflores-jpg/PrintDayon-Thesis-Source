const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/printdayon';

async function update() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const storefrontSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <rect width="800" height="600" fill="#0F2747"/>
    <rect x="40" y="40" width="720" height="520" rx="24" fill="#1E3A8A"/>
    <text x="400" y="110" fill="#38BDF8" font-size="26" font-family="sans-serif" font-weight="bold" text-anchor="middle">KNOW WELL SYSTEMS - PRINTING &amp; COPIER HUB</text>
    <text x="400" y="145" fill="#94A3B8" font-size="15" font-family="sans-serif" text-anchor="middle">Redaza Street, Naval, Biliran · Physical Storefront Evidence</text>
    <rect x="80" y="180" width="300" height="310" rx="16" fill="#0F172A" stroke="#38BDF8" stroke-width="4"/>
    <text x="230" y="300" fill="#FFFFFF" font-size="20" font-family="sans-serif" font-weight="bold" text-anchor="middle">Heavy-Duty Production</text>
    <text x="230" y="340" fill="#38BDF8" font-size="15" font-family="sans-serif" text-anchor="middle">High-Speed Laser Xerox Copier</text>
    <rect x="420" y="180" width="300" height="310" rx="16" fill="#0F172A" stroke="#34D399" stroke-width="4"/>
    <text x="570" y="300" fill="#FFFFFF" font-size="20" font-family="sans-serif" font-weight="bold" text-anchor="middle">Front Desk / Terminal</text>
    <text x="570" y="340" fill="#34D399" font-size="15" font-family="sans-serif" text-anchor="middle">Customer Submission Station</text>
    <rect x="250" y="510" width="300" height="32" rx="8" fill="#10B981"/>
    <text x="400" y="532" fill="#FFFFFF" font-size="13" font-family="sans-serif" font-weight="bold" text-anchor="middle">📍 GPS: 11.5625, 124.3960 · NAVAL BILIRAN</text>
  </svg>`;

  const dtiSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <rect width="800" height="600" fill="#F8FAFC"/>
    <rect x="30" y="30" width="740" height="540" rx="16" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="3"/>
    <text x="400" y="90" fill="#64748B" font-size="13" font-family="sans-serif" text-anchor="middle" letter-spacing="4">REPUBLIC OF THE PHILIPPINES</text>
    <text x="400" y="125" fill="#0F2747" font-size="22" font-family="sans-serif" font-weight="bold" text-anchor="middle">DEPARTMENT OF TRADE AND INDUSTRY</text>
    <text x="400" y="150" fill="#64748B" font-size="13" font-family="sans-serif" text-anchor="middle">Biliran Provincial Office · Naval, Biliran</text>
    <line x1="80" y1="170" x2="720" y2="170" stroke="#0F2747" stroke-width="2"/>
    <text x="400" y="210" fill="#1E3A8A" font-size="18" font-family="serif" font-weight="bold" text-anchor="middle">CERTIFICATE OF BUSINESS NAME REGISTRATION</text>
    <text x="100" y="270" fill="#64748B" font-size="13" font-family="sans-serif">BUSINESS NAME:</text>
    <text x="260" y="270" fill="#0F2747" font-size="18" font-family="sans-serif" font-weight="bold">Know Well Systems</text>
    <text x="100" y="320" fill="#64748B" font-size="13" font-family="sans-serif">PROPRIETOR:</text>
    <text x="260" y="320" fill="#0F2747" font-size="16" font-family="sans-serif" font-weight="bold">Noel Pla</text>
    <text x="100" y="370" fill="#64748B" font-size="13" font-family="sans-serif">BUSINESS ADDRESS:</text>
    <text x="260" y="370" fill="#334155" font-size="15" font-family="sans-serif">Redaza Street, Naval, Biliran</text>
    <text x="100" y="420" fill="#64748B" font-size="13" font-family="sans-serif">CERTIFICATE NO:</text>
    <text x="260" y="420" fill="#0D9488" font-size="16" font-family="monospace" font-weight="bold">DTI-09875635</text>
    <circle cx="620" cy="350" r="60" fill="none" stroke="#DC2626" stroke-width="3" stroke-dasharray="6 4"/>
    <text x="620" y="345" fill="#DC2626" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle">DTI REGION VIII</text>
    <text x="620" y="365" fill="#DC2626" font-size="10" font-family="sans-serif" text-anchor="middle">OFFICIAL SEAL</text>
    <text x="400" y="520" fill="#10B981" font-size="12" font-family="sans-serif" font-weight="bold" text-anchor="middle">AUTHENTICATED GOVERNMENT RECORD</text>
  </svg>`;

  const permitSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <rect width="800" height="600" fill="#F0FDFA"/>
    <rect x="30" y="30" width="740" height="540" rx="16" fill="#FFFFFF" stroke="#99F6E4" stroke-width="3"/>
    <text x="400" y="90" fill="#0F766E" font-size="13" font-family="sans-serif" text-anchor="middle" letter-spacing="3">MUNICIPALITY OF NAVAL · PROVINCE OF BILIRAN</text>
    <text x="400" y="125" fill="#134E4A" font-size="24" font-family="sans-serif" font-weight="bold" text-anchor="middle">OFFICE OF THE MUNICIPAL MAYOR</text>
    <text x="400" y="150" fill="#0F766E" font-size="13" font-family="sans-serif" text-anchor="middle">Business Permits and Licensing Office (BPLO)</text>
    <line x1="80" y1="170" x2="720" y2="170" stroke="#0D9488" stroke-width="2"/>
    <text x="400" y="210" fill="#0D9488" font-size="20" font-family="serif" font-weight="bold" text-anchor="middle">MAYOR'S BUSINESS PERMIT 2026</text>
    <text x="100" y="270" fill="#64748B" font-size="13" font-family="sans-serif">PERMITTEE / TRADE NAME:</text>
    <text x="300" y="270" fill="#0F2747" font-size="18" font-family="sans-serif" font-weight="bold">Know Well Systems</text>
    <text x="100" y="320" fill="#64748B" font-size="13" font-family="sans-serif">OPERATOR:</text>
    <text x="300" y="320" fill="#0F2747" font-size="16" font-family="sans-serif" font-weight="bold">Noel Pla</text>
    <text x="100" y="370" fill="#64748B" font-size="13" font-family="sans-serif">BUSINESS NATURE:</text>
    <text x="300" y="370" fill="#334155" font-size="15" font-family="sans-serif">Commercial Printing &amp; Copying Services</text>
    <text x="100" y="420" fill="#64748B" font-size="13" font-family="sans-serif">PERMIT NUMBER:</text>
    <text x="300" y="420" fill="#0D9488" font-size="16" font-family="monospace" font-weight="bold">BP-2026-0819</text>
    <circle cx="630" cy="350" r="60" fill="none" stroke="#0D9488" stroke-width="3" stroke-dasharray="6 4"/>
    <text x="630" y="345" fill="#0D9488" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle">MUNICIPALITY OF NAVAL</text>
    <text x="630" y="365" fill="#0D9488" font-size="10" font-family="sans-serif" text-anchor="middle">OFFICIAL LGU SEAL</text>
    <text x="400" y="520" fill="#0D9488" font-size="12" font-family="sans-serif" font-weight="bold" text-anchor="middle">VALID FOR TAX YEAR 2026 · NAVAL LGU</text>
  </svg>`;

  const storefrontDataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(storefrontSvg);
  const dtiDataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(dtiSvg);
  const permitDataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(permitSvg);

  const res = await mongoose.connection.db.collection('printingshops').updateMany(
    { shopName: 'Know Well Systems' },
    {
      $set: {
        dtiNumber: 'DTI-09875635',
        mayorsPermitNumber: 'BP-2026-0819',
        dtiDocName: 'DTI_Registration_Cert_KnowWell.png',
        permitDocName: 'Mayors_Permit_Naval_2026.png',
        storefrontPhotoName: 'KnowWell_Storefront_Proof.png',
        dtiDocUrl: dtiDataUrl,
        permitDocUrl: permitDataUrl,
        storefrontPhotoUrl: storefrontDataUrl,
        verificationStatus: 'pending'
      }
    }
  );
  console.log(`Updated ${res.modifiedCount} shop(s) successfully.`);
  await mongoose.disconnect();
}

update().catch(err => {
  console.error(err);
  process.exit(1);
});
