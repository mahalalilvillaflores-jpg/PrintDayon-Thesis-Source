const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calculateEstimatedCost } = require('../src/algorithms/queueOptimizer');

describe('Print Job Price Calculation & Order Summary Verification', () => {
  const shopA = {
    bwPerPage: 2.0,
    bwLongPerPage: 3.0,
    colorPerPage: 4.0,
    colorLongPerPage: 5.0,
    photocopyBwA4: 1.5,
    photocopyBwLong: 2.0,
    photocopyColor: 5.0,
    photo4RPrice: 15.0,
    photoA4Price: 35.0,
    a3Multiplier: 1.5,
    bindingCost: 35.0,
    softbindCost: 50.0,
    stapleCost: 5.0,
    allowRush: true,
    rushFee: 20.0,
  };

  const shopB = {
    bwPerPage: 2.5,
    bwLongPerPage: 3.5,
    colorPerPage: 6.0,
    colorLongPerPage: 7.0,
    photocopyBwA4: 2.0,
    photocopyBwLong: 2.5,
    photocopyColor: 6.0,
    photo4RPrice: 18.0,
    photoA4Price: 40.0,
    a3Multiplier: 1.5,
    bindingCost: 40.0,
    softbindCost: 60.0,
    stapleCost: 5.0,
    allowRush: true,
    rushFee: 25.0,
  };

  it('1. Test with no document selected / 0 billable pages', () => {
    const costZeroPages = calculateEstimatedCost(
      { totalPages: 0, copies: 1, colorMode: 'black_and_white', paperSize: 'A4', binding: 'none' },
      shopA,
      false
    );
    assert.strictEqual(costZeroPages, 0, 'No pages should result in 0 total cost');
  });

  it('2. Test with a one-page document (1 page, 1 copy, B&W A4)', () => {
    const costOnePage = calculateEstimatedCost(
      { totalPages: 1, copies: 1, colorMode: 'black_and_white', paperSize: 'A4', binding: 'none' },
      shopA,
      false
    );
    // 1 page * 1 copy * ₱2.00 = ₱2.00
    assert.strictEqual(costOnePage, 2.0, '1 page B&W at Shop A should be ₱2.00');
  });

  it('3. Test with a multipage document (5 pages, 1 copy, B&W A4)', () => {
    const costMultipage = calculateEstimatedCost(
      { totalPages: 5, copies: 1, colorMode: 'black_and_white', paperSize: 'A4', binding: 'none' },
      shopA,
      false
    );
    // 5 pages * 1 copy * ₱2.00 = ₱10.00
    assert.strictEqual(costMultipage, 10.0, '5 pages B&W at Shop A should be ₱10.00');
  });

  it('4. Test with multiple copies (5 pages, 3 copies, B&W A4)', () => {
    const costMultipleCopies = calculateEstimatedCost(
      { totalPages: 5, copies: 3, colorMode: 'black_and_white', paperSize: 'A4', binding: 'none' },
      shopA,
      false
    );
    // 5 pages * 3 copies * ₱2.00 = ₱30.00
    assert.strictEqual(costMultipleCopies, 30.0, '5 pages * 3 copies B&W at Shop A should be ₱30.00');
  });

  it('5. Test black-and-white vs colored printing', () => {
    const costBW = calculateEstimatedCost(
      { totalPages: 10, copies: 2, colorMode: 'black_and_white', paperSize: 'A4', binding: 'none' },
      shopA,
      false
    );
    // 10 pages * 2 copies * ₱2.00 = ₱40.00
    assert.strictEqual(costBW, 40.0, 'B&W 10 pages * 2 copies should be ₱40.00');

    const costColor = calculateEstimatedCost(
      { totalPages: 10, copies: 2, colorMode: 'color', paperSize: 'A4', binding: 'none' },
      shopA,
      false
    );
    // 10 pages * 2 copies * ₱4.00 = ₱80.00
    assert.strictEqual(costColor, 80.0, 'Color 10 pages * 2 copies should be ₱80.00');
  });

  it('6. Test changing the selected shop (Shop A vs Shop B rates)', () => {
    const costAtShopA = calculateEstimatedCost(
      { totalPages: 4, copies: 2, colorMode: 'color', paperSize: 'A4', binding: 'none' },
      shopA,
      false
    );
    // Shop A color rate = ₱4.00 -> 4 * 2 * 4.00 = ₱32.00
    assert.strictEqual(costAtShopA, 32.0, 'Shop A cost should be ₱32.00');

    const costAtShopB = calculateEstimatedCost(
      { totalPages: 4, copies: 2, colorMode: 'color', paperSize: 'A4', binding: 'none' },
      shopB,
      false
    );
    // Shop B color rate = ₱6.00 -> 4 * 2 * 6.00 = ₱48.00
    assert.strictEqual(costAtShopB, 48.0, 'Shop B cost should be ₱48.00');
    assert.notStrictEqual(costAtShopA, costAtShopB, 'Different shops with different rates must produce different totals');
  });

  it('7. Test paper sizes and special options (Legal, A3, Binding, Rush)', () => {
    // Legal size B&W at Shop A: 3.00/page
    const costLegal = calculateEstimatedCost(
      { totalPages: 10, copies: 1, colorMode: 'black_and_white', paperSize: 'Legal', binding: 'none' },
      shopA,
      false
    );
    assert.strictEqual(costLegal, 30.0, 'Legal size B&W should use bwLongPerPage rate (₱3.00 * 10 = ₱30.00)');

    // Spiral binding (+35 per copy) + Rush fee (+20)
    const costWithBindingAndRush = calculateEstimatedCost(
      { totalPages: 10, copies: 2, colorMode: 'black_and_white', paperSize: 'A4', binding: 'spiral' },
      shopA,
      true
    );
    // (10 pages * 2 copies * ₱2.00) + (₱35 * 2 binding) + ₱20 rush = 40 + 70 + 20 = ₱130.00
    assert.strictEqual(costWithBindingAndRush, 130.0, 'Binding and rush fee should be calculated correctly');
  });

  it('8. Test 33-page full-color document with 2 copies, staple fee, and rush fee (User Scenario)', () => {
    const specs = {
      totalPages: 33,
      copies: 2,
      colorMode: 'color',
      paperSize: 'A4',
      binding: 'staple',
      sided: 'single',
    };
    // Shop A rates: colorPerPage = ₱4.00, stapleCost = ₱5.00, rushFee = ₱20.00
    // Total = (33 pages * 2 copies * ₱4.00) + (₱5.00 * 2 copies) + ₱20.00 rush fee
    // Total = 264.00 + 10.00 + 20.00 = ₱294.00
    const totalCost = calculateEstimatedCost(specs, shopA, true);
    assert.strictEqual(totalCost, 294.0, '33-page full-color with 2 copies, staple fee, and rush fee must equal ₱294.00');

    // Test changing copies to 3
    const cost3Copies = calculateEstimatedCost({ ...specs, copies: 3 }, shopA, true);
    // (33 * 3 * 4.00) + (5.00 * 3) + 20.00 = 396 + 15 + 20 = ₱431.00
    assert.strictEqual(cost3Copies, 431.0, 'Changing copies to 3 should recalculate to ₱431.00');

    // Test changing print type to black_and_white
    const costBW = calculateEstimatedCost({ ...specs, colorMode: 'black_and_white' }, shopA, true);
    // (33 * 2 * 2.00) + (5.00 * 2) + 20.00 = 132 + 10 + 20 = ₱162.00
    assert.strictEqual(costBW, 162.0, 'Changing to B&W should recalculate to ₱162.00');

    // Test changing page range to 10 pages
    const cost10Pages = calculateEstimatedCost({ ...specs, totalPages: 10 }, shopA, true);
    // (10 * 2 * 4.00) + (5.00 * 2) + 20.00 = 80 + 10 + 20 = ₱110.00
    assert.strictEqual(cost10Pages, 110.0, 'Changing page range to 10 pages should recalculate to ₱110.00');

    // Test changing selected shop to Shop B (colorPerPage = 6.00, rushFee = 25.00, stapleCost = 5.00)
    const costShopB = calculateEstimatedCost(specs, shopB, true);
    // (33 * 2 * 6.00) + (5.00 * 2) + 25.00 = 396 + 10 + 25 = ₱431.00
    assert.strictEqual(costShopB, 431.0, 'Changing shop to Shop B should recalculate to ₱431.00');
  });

  it('9. Test 33-page B&W document at ₱2.00/page, 1 copy, single-sided, no binding (Base ₱66.00, Rush ₱86.00)', () => {
    const specs = {
      totalPages: 33,
      copies: 1,
      colorMode: 'black_and_white',
      paperSize: 'A4',
      sided: 'single',
      binding: 'none',
    };

    // Base total: 33 pages * 1 copy * ₱2.00 = ₱66.00
    const baseTotal = calculateEstimatedCost(specs, shopA, false);
    assert.strictEqual(baseTotal, 66.0, 'Base total for 33-page B&W document at ₱2.00/page must equal exactly ₱66.00');

    // Rush total: ₱66.00 base + ₱20.00 rush fee = ₱86.00
    const rushTotal = calculateEstimatedCost(specs, shopA, true);
    assert.strictEqual(rushTotal, 86.0, 'Total with ₱20.00 rush fee must equal exactly ₱86.00');
  });

  it('10. Test 33-page B&W document with multiple copies', () => {
    const specs = {
      totalPages: 33,
      colorMode: 'black_and_white',
      paperSize: 'A4',
      sided: 'single',
      binding: 'none',
    };

    // 2 copies: 33 * 2 * ₱2.00 = ₱132.00 (rush = ₱152.00)
    const cost2CopiesBase = calculateEstimatedCost({ ...specs, copies: 2 }, shopA, false);
    assert.strictEqual(cost2CopiesBase, 132.0, '2 copies of 33-page B&W should equal ₱132.00');
    const cost2CopiesRush = calculateEstimatedCost({ ...specs, copies: 2 }, shopA, true);
    assert.strictEqual(cost2CopiesRush, 152.0, '2 copies of 33-page B&W with rush fee should equal ₱152.00');

    // 3 copies: 33 * 3 * ₱2.00 = ₱198.00 (rush = ₱218.00)
    const cost3CopiesBase = calculateEstimatedCost({ ...specs, copies: 3 }, shopA, false);
    assert.strictEqual(cost3CopiesBase, 198.0, '3 copies of 33-page B&W should equal ₱198.00');
    const cost3CopiesRush = calculateEstimatedCost({ ...specs, copies: 3 }, shopA, true);
    assert.strictEqual(cost3CopiesRush, 218.0, '3 copies of 33-page B&W with rush fee should equal ₱218.00');
  });

  it('11. Test 33-page document in full color', () => {
    const specs = {
      totalPages: 33,
      colorMode: 'color',
      paperSize: 'A4',
      sided: 'single',
      binding: 'none',
    };

    // 1 copy full color at ₱4.00/page: 33 * 1 * ₱4.00 = ₱132.00 (rush = ₱152.00)
    const costColor1 = calculateEstimatedCost({ ...specs, copies: 1 }, shopA, false);
    assert.strictEqual(costColor1, 132.0, '1 copy of 33-page full-color at ₱4.00/page should equal ₱132.00');
    const costColor1Rush = calculateEstimatedCost({ ...specs, copies: 1 }, shopA, true);
    assert.strictEqual(costColor1Rush, 152.0, '1 copy of 33-page full-color with rush fee should equal ₱152.00');

    // 2 copies full color at ₱4.00/page: 33 * 2 * ₱4.00 = ₱264.00 (rush = ₱284.00)
    const costColor2 = calculateEstimatedCost({ ...specs, copies: 2 }, shopA, false);
    assert.strictEqual(costColor2, 264.0, '2 copies of 33-page full-color at ₱4.00/page should equal ₱264.00');
    const costColor2Rush = calculateEstimatedCost({ ...specs, copies: 2 }, shopA, true);
    assert.strictEqual(costColor2Rush, 284.0, '2 copies of 33-page full-color with rush fee should equal ₱284.00');
  });

  it('12. Test custom page ranges', () => {
    // Custom range: pages 1 to 10 (10 billable pages)
    const cost10Pages = calculateEstimatedCost(
      { totalPages: 10, copies: 1, colorMode: 'black_and_white', paperSize: 'A4', sided: 'single', binding: 'none' },
      shopA,
      false
    );
    assert.strictEqual(cost10Pages, 20.0, 'Custom 10 pages B&W at ₱2.00/page should equal ₱20.00');

    // Custom range: pages 1 to 15 with rush
    const cost15PagesRush = calculateEstimatedCost(
      { totalPages: 15, copies: 1, colorMode: 'black_and_white', paperSize: 'A4', sided: 'single', binding: 'none' },
      shopA,
      true
    );
    // (15 * ₱2.00) + ₱20.00 rush = ₱50.00
    assert.strictEqual(cost15PagesRush, 50.0, 'Custom 15 pages B&W with rush fee should equal ₱50.00');
  });

  it('13. Test missing or invalid pricing structures (fallback behavior)', () => {
    const specs = {
      totalPages: 33,
      copies: 1,
      colorMode: 'black_and_white',
      paperSize: 'A4',
      sided: 'single',
      binding: 'none',
    };

    // When pricing is undefined or null, fallback rates should apply: bwPerPage = 2, rushFee = 20
    const costNullPricing = calculateEstimatedCost(specs, null, false);
    assert.strictEqual(costNullPricing, 66.0, 'Null pricing should use standard default ₱2.00/page resulting in ₱66.00');

    const costNullPricingRush = calculateEstimatedCost(specs, null, true);
    assert.strictEqual(costNullPricingRush, 86.0, 'Null pricing with rush should equal ₱86.00');

    // When pricing is empty object {}
    const costEmptyPricing = calculateEstimatedCost(specs, {}, false);
    assert.strictEqual(costEmptyPricing, 66.0, 'Empty pricing should use standard default ₱2.00/page resulting in ₱66.00');
  });

  it('14. Test closed shop pricing calculation and status handling', () => {
    const closedShop = {
      ...shopA,
      status: 'closed',
    };

    const specs = {
      totalPages: 33,
      copies: 1,
      colorMode: 'black_and_white',
      paperSize: 'A4',
      sided: 'single',
      binding: 'none',
    };

    // Stored rates of closed shop must still produce valid price (₱66.00 base, ₱86.00 rush)
    const baseCost = calculateEstimatedCost(specs, closedShop, false);
    assert.strictEqual(baseCost, 66.0, 'Closed shop stored rates must calculate accurately');

    const rushCost = calculateEstimatedCost(specs, closedShop, true);
    assert.strictEqual(rushCost, 86.0, 'Closed shop rush calculation must calculate accurately');

    // Operational status helper must correctly flag shop as unavailable
    const { getEffectiveShopStatus } = require('../src/utils/shopHelper');
    const effective = getEffectiveShopStatus({
      status: 'closed',
      operatingHours: {
        monday: { open: '08:00', close: '17:00', isClosed: false },
      },
    });
    assert.strictEqual(effective.isOpen, false, 'Closed shop must have isOpen = false');
    assert.strictEqual(effective.isAvailable, false, 'Closed shop must have isAvailable = false');
  });
});
