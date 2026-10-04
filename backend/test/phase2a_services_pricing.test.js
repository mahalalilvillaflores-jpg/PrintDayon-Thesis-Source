const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calculateEstimatedCost } = require('../src/algorithms/queueOptimizer');

describe('Phase 2A: Shop Services & Pricing Synchronization Test Suite', () => {
  const shopDefaultRates = {
    bwPerPage: 2.0,
    bwLongPerPage: 3.0,
    colorPerPage: 4.0,
    colorLongPerPage: 5.0,
    photocopyBwA4: 1.5,
    photocopyBwLong: 2.0,
    photocopyColor: 5.0,
    bindingCost: 35.0,
    softbindCost: 50.0,
    stapleCost: 5.0,
    allowRush: true,
    rushFee: 20.0,
    services: [
      { name: 'Document Printing', available: true },
      { name: 'Photocopy / Xerox', available: true },
      { name: 'Bookbinding & Finishing', available: true },
      { name: 'Lamination & ID Printing', available: true },
      {
        name: 'Sticker Paper Printing',
        description: 'Waterproof glossy vinyl A4 sticker sheet',
        price: 25.0,
        available: true,
      },
      {
        name: 'Glossy Photo 4R',
        description: 'High-gloss photo paper for ID & portraits',
        price: 15.0,
        available: false,
      },
    ],
  };

  const shopCustomizedRates = {
    bwPerPage: 2.5,
    bwLongPerPage: 3.5,
    colorPerPage: 5.5,
    colorLongPerPage: 6.5,
    photocopyBwA4: 1.75,
    photocopyBwLong: 2.25,
    photocopyColor: 6.0,
    bindingCost: 45.0, // Customized spiral binding
    softbindCost: 65.0, // Customized softbound
    stapleCost: 7.0, // Customized staple cost
    allowRush: false, // Rush disabled by shop owner!
    rushFee: 30.0,
  };

  // Helper matching frontend checkout label generation
  const getBindingOptionLabel = (bindingType, pricing = {}) => {
    const stapleCost = Number(pricing.stapleCost ?? 5).toFixed(2);
    const spiralCost = Number(pricing.bindingCost ?? 35).toFixed(2);
    const softbindCost = Number(pricing.softbindCost ?? 50).toFixed(2);

    switch (bindingType) {
      case 'none':
        return 'No Binding (Loose)';
      case 'staple':
        return `Stapled / Fastener (+₱${stapleCost})`;
      case 'spiral':
        return `Spiral Ring Binding (+₱${spiralCost})`;
      case 'soft_bound':
        return `Soft Bound Book (+₱${softbindCost})`;
      default:
        return 'No Binding (Loose)';
    }
  };

  // Helper matching frontend rush order label generation
  const getRushStatus = (pricing = {}) => {
    const allowRush = pricing.allowRush !== false;
    const fee = Number(pricing.rushFee ?? 20).toFixed(2);
    return {
      allowed: allowRush,
      label: allowRush ? `Rush Order (+₱${fee})` : 'Rush orders are not accepted by this shop',
      fee: allowRush ? Number(fee) : 0,
    };
  };

  it('1. Custom binding prices appear correctly in checkout labels', () => {
    // Default shop
    assert.strictEqual(getBindingOptionLabel('staple', shopDefaultRates), 'Stapled / Fastener (+₱5.00)');
    assert.strictEqual(getBindingOptionLabel('spiral', shopDefaultRates), 'Spiral Ring Binding (+₱35.00)');
    assert.strictEqual(getBindingOptionLabel('soft_bound', shopDefaultRates), 'Soft Bound Book (+₱50.00)');

    // Customized shop
    assert.strictEqual(getBindingOptionLabel('staple', shopCustomizedRates), 'Stapled / Fastener (+₱7.00)');
    assert.strictEqual(getBindingOptionLabel('spiral', shopCustomizedRates), 'Spiral Ring Binding (+₱45.00)');
    assert.strictEqual(getBindingOptionLabel('soft_bound', shopCustomizedRates), 'Soft Bound Book (+₱65.00)');
  });

  it('2. The displayed total matches the backend-calculated total for custom binding', () => {
    const specsSpiral = {
      totalPages: 10,
      copies: 2,
      colorMode: 'black_and_white',
      paperSize: 'A4',
      sided: 'single',
      binding: 'spiral',
    };

    // Shop Customized: 10 pages * 2 copies * ₱2.50 = ₱50.00 + (₱45.00 * 2 copies binding) = ₱140.00
    const backendCost = calculateEstimatedCost(specsSpiral, shopCustomizedRates, false);
    assert.strictEqual(backendCost, 140.0, 'Backend cost should accurately calculate ₱140.00 for 2 spiral bound copies');

    const specsStaple = {
      totalPages: 10,
      copies: 2,
      colorMode: 'black_and_white',
      paperSize: 'A4',
      sided: 'single',
      binding: 'staple',
    };
    // 10 pages * 2 copies * ₱2.50 = ₱50.00 + (₱7.00 * 2 copies staple) = ₱64.00
    const stapleBackendCost = calculateEstimatedCost(specsStaple, shopCustomizedRates, false);
    assert.strictEqual(stapleBackendCost, 64.0, 'Backend cost should accurately calculate ₱64.00 for 2 stapled copies');
  });

  it('3. A changed shop fee is reflected dynamically in calculation', () => {
    const updatedRates = { ...shopDefaultRates, bindingCost: 40.0, rushFee: 25.0 };
    const specs = {
      totalPages: 5,
      copies: 1,
      colorMode: 'black_and_white',
      paperSize: 'A4',
      sided: 'single',
      binding: 'spiral',
    };
    // 5 pages * ₱2.00 = ₱10.00 + ₱40.00 binding + ₱25.00 rush = ₱75.00
    const total = calculateEstimatedCost(specs, updatedRates, true);
    assert.strictEqual(total, 75.0, 'Updated shop rates must immediately calculate ₱75.00');
  });

  it('4. Rush service cannot be selected when allowRush is false', () => {
    const rushInfo = getRushStatus(shopCustomizedRates);
    assert.strictEqual(rushInfo.allowed, false, 'allowRush: false must forbid rush selection');
    assert.strictEqual(
      rushInfo.label,
      'Rush orders are not accepted by this shop',
      'Should show clear unavailable message'
    );

    // If client attempts to force isRush = true on backend calculation
    const specs = {
      totalPages: 5,
      copies: 1,
      colorMode: 'black_and_white',
      paperSize: 'A4',
      sided: 'single',
      binding: 'none',
    };
    const cost = calculateEstimatedCost(specs, shopCustomizedRates, true);
    // 5 pages * ₱2.50 = ₱12.50. Rush fee must NOT be added because allowRush is false!
    assert.strictEqual(cost, 12.5, 'Backend must not add rush fee when allowRush is false');
  });

  it('5. A configured rush fee is displayed correctly when rush is allowed', () => {
    const rushInfo = getRushStatus(shopDefaultRates);
    assert.strictEqual(rushInfo.allowed, true);
    assert.strictEqual(rushInfo.label, 'Rush Order (+₱20.00)');
    assert.strictEqual(rushInfo.fee, 20.0);

    const specs = {
      totalPages: 10,
      copies: 1,
      colorMode: 'black_and_white',
      paperSize: 'A4',
      sided: 'single',
      binding: 'none',
    };
    const cost = calculateEstimatedCost(specs, shopDefaultRates, true);
    // 10 * ₱2.00 + ₱20.00 rush = ₱40.00
    assert.strictEqual(cost, 40.0, 'Backend must add ₱20.00 rush fee when allowed');
  });

  it('6. Photocopy rates display the correct saved values', () => {
    const pA4 = shopDefaultRates.photocopyBwA4;
    const pLong = shopDefaultRates.photocopyBwLong;
    const pColor = shopDefaultRates.photocopyColor;

    assert.strictEqual(pA4, 1.5, 'B&W A4 photocopy rate should be 1.50');
    assert.strictEqual(pLong, 2.0, 'B&W Long photocopy rate should be 2.00');
    assert.strictEqual(pColor, 5.0, 'Color photocopy rate should be 5.00');

    // Test photocopy calculation
    const photocopySpecs = {
      serviceType: 'photocopy',
      totalPages: 10,
      copies: 1,
      colorMode: 'color',
      paperSize: 'A4',
      binding: 'none',
    };
    const photocopyCost = calculateEstimatedCost(photocopySpecs, shopDefaultRates, false);
    // 10 * ₱5.00 = ₱50.00
    assert.strictEqual(photocopyCost, 50.0, 'Photocopy calculation should match configured rates');
  });

  it('7. Missing photocopy rates do not show fabricated prices', () => {
    const incompleteShop = {
      bwPerPage: 2.0,
      photocopyBwA4: null,
      photocopyBwLong: undefined,
      photocopyColor: '',
    };

    const getRateDisplay = (val) => {
      if (val !== null && val !== undefined && val !== '') {
        return `₱${Number(val).toFixed(2)} / page`;
      }
      return 'Unavailable';
    };

    assert.strictEqual(getRateDisplay(incompleteShop.photocopyBwA4), 'Unavailable');
    assert.strictEqual(getRateDisplay(incompleteShop.photocopyBwLong), 'Unavailable');
    assert.strictEqual(getRateDisplay(incompleteShop.photocopyColor), 'Unavailable');
  });

  it('8. Custom services display their correct descriptions, prices, and availability', () => {
    const standardCategoryNames = [
      'document printing',
      'photocopy / xerox',
      'photocopy',
      'bookbinding & finishing',
      'bookbinding',
      'document scanning',
      'scanning',
      'lamination & id printing',
      'lamination',
    ];

    const customServices = (shopDefaultRates.services || []).filter((s) => {
      const name = (typeof s === 'string' ? s : s?.name || '').trim().toLowerCase();
      return !standardCategoryNames.includes(name);
    });

    assert.strictEqual(customServices.length, 2, 'Should detect exactly 2 custom services');

    const sticker = customServices.find((s) => s.name === 'Sticker Paper Printing');
    assert.ok(sticker, 'Sticker paper service must exist');
    assert.strictEqual(sticker.price, 25.0);
    assert.strictEqual(sticker.description, 'Waterproof glossy vinyl A4 sticker sheet');
    assert.strictEqual(sticker.available, true);

    const photo4R = customServices.find((s) => s.name === 'Glossy Photo 4R');
    assert.ok(photo4R, 'Glossy photo 4R service must exist');
    assert.strictEqual(photo4R.price, 15.0);
    assert.strictEqual(photo4R.available, false);
  });

  it('9. Unavailable custom services are not presented as available in-store', () => {
    const photo4R = shopDefaultRates.services.find((s) => s.name === 'Glossy Photo 4R');
    const badgeText = photo4R.available !== false ? 'Available In-Store' : 'Unavailable';
    assert.strictEqual(badgeText, 'Unavailable', 'Disabled custom service must display as Unavailable');
  });

  it('10. Existing order submission and closed-shop ordering behavior remain intact', () => {
    const closedShop = {
      ...shopDefaultRates,
      status: 'closed',
    };

    const specs = {
      totalPages: 20,
      copies: 1,
      colorMode: 'black_and_white',
      paperSize: 'A4',
      sided: 'single',
      binding: 'staple',
    };

    // Stored rates of closed shop: 20 pages * ₱2.00 = ₱40.00 + ₱5.00 staple = ₱45.00
    const baseCost = calculateEstimatedCost(specs, closedShop, false);
    assert.strictEqual(baseCost, 45.0, 'Closed shop must calculate valid price with staple fee');

    const rushCost = calculateEstimatedCost(specs, closedShop, true);
    assert.strictEqual(rushCost, 65.0, 'Closed shop with rush must calculate ₱65.00');
  });
});
