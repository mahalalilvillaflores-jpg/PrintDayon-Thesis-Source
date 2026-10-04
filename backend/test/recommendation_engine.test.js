const { describe, it } = require('node:test');
const assert = require('node:assert');
const { rankShops } = require('../src/algorithms/recommendationEngine');

// Mock Data
const customerLat = 11.56437;
const customerLng = 124.39964;
const specs = { copies: 1, totalPages: 10, colorMode: 'black_and_white', isRush: false };

function createShop(id, name, overrides = {}) {
  return {
    _id: id,
    shopName: name,
    latitude: 11.56250,
    longitude: 124.39593, // Know-well / Redaza coordinates (valid path)
    status: 'online',
    isOpen: true,
    operatingHours: [
      { day: 'monday', isClosed: false, open: '00:00', close: '23:59' },
      { day: 'tuesday', isClosed: false, open: '00:00', close: '23:59' },
      { day: 'wednesday', isClosed: false, open: '00:00', close: '23:59' },
      { day: 'thursday', isClosed: false, open: '00:00', close: '23:59' },
      { day: 'friday', isClosed: false, open: '00:00', close: '23:59' },
      { day: 'saturday', isClosed: false, open: '00:00', close: '23:59' },
      { day: 'sunday', isClosed: false, open: '00:00', close: '23:59' },
    ],
    pricing: {
      bwPerPage: 2,
      colorPerPage: 5,
    },
    services: [{ name: 'Print', available: true }],
    rating: 0,
    reviewsCount: 0,
    walkInCustomerCount: 0,
    verificationStatus: 'verified',
    ...overrides
  };
}

describe('Recommendation Engine - Bayesian Ratings & Top Pick', () => {
  it('Should favor a highly rated shop with many reviews over one with 0 reviews', () => {
    const shops = [
      createShop('s1', 'No Reviews Shop', { rating: 0, reviewsCount: 0 }),
      createShop('s2', 'Highly Rated Shop', { rating: 5, reviewsCount: 50 })
    ];
    const ranked = rankShops(shops, customerLat, customerLng, specs, {}, 'motor');
    const available = ranked.filter(s => s.isAvailable);
    
    assert.strictEqual(available[0].shopId, 's2');
    assert.strictEqual(available[0].isRecommended, true);
    assert.strictEqual(available[0].ratingScore, 100);
  });

  it('Should not automatically let 1 five-star review beat many solid 4.8 reviews due to Bayesian smoothing', () => {
    const shops = [
      createShop('s1', 'One Review 5 Star', { rating: 5.0, reviewsCount: 1 }), // (1*5 + 3*4) / 4 = 4.25
      createShop('s2', 'Many Reviews 4.8', { rating: 4.8, reviewsCount: 50 }) // (50*4.8 + 3*4) / 53 = 4.75
    ];
    const ranked = rankShops(shops, customerLat, customerLng, specs, {}, 'motor');
    const available = ranked.filter(s => s.isAvailable);
    assert.strictEqual(available[0].shopId, 's2'); // s2 wins
  });

  it('Should give unrated shops a fair baseline and handle invalid data', () => {
    const shops = [
      createShop('s1', 'No Reviews', { rating: 0, reviewsCount: 0 }),
      createShop('s2', 'Invalid Ratings', { rating: null, reviewsCount: undefined }),
      createShop('s3', 'Bad Shop', { rating: 1.0, reviewsCount: 10 }), // (10*1 + 3*4) / 13 = 1.69
    ];
    const ranked = rankShops(shops, customerLat, customerLng, specs, {}, 'motor');
    const available = ranked.filter(s => s.isAvailable);
    assert.strictEqual(available[0].shopId, 's1'); // s1 and s2 tie, s1 wins tiebreaker
    assert.strictEqual(available[0].effectiveRating, 4.0);
    assert.strictEqual(available[1].effectiveRating, 4.0);
    assert.ok(available[2].effectiveRating < 4.0);
  });

  it('Tie breaker: Same rating, but different distance', () => {
    const shops = [
      createShop('s1', 'Far', { latitude: 11.5583, longitude: 124.3986, rating: 4.5, reviewsCount: 10 }),
      createShop('s2', 'Near', { latitude: 11.5625, longitude: 124.3959, rating: 4.5, reviewsCount: 10 }),
    ];
    const ranked = rankShops(shops, customerLat, customerLng, specs, {}, 'motor');
    const available = ranked.filter(s => s.isAvailable);
    assert.strictEqual(available[0].shopId, 's2'); // Near wins
  });

  it('Tie breaker: Different queue and turnaround times', () => {
    const shops = [
      createShop('s1', 'Busy', { rating: 4.5, reviewsCount: 10, walkInCustomerCount: 10 }),
      createShop('s2', 'Empty', { rating: 4.5, reviewsCount: 10, walkInCustomerCount: 0 }),
    ];
    const ranked = rankShops(shops, customerLat, customerLng, specs, {}, 'motor');
    const available = ranked.filter(s => s.isAvailable);
    assert.strictEqual(available[0].shopId, 's2'); // Empty wins
  });

  it('Should handle single eligible open shop properly', () => {
    const shops = [
      createShop('s1', 'Only Shop', { rating: 4.5, reviewsCount: 10 }),
      createShop('s2', 'Closed Shop', { status: 'closed', isOpen: false, operatingHours: [{ day: 'monday', isClosed: true }] }),
    ];
    const ranked = rankShops(shops, customerLat, customerLng, specs, {}, 'motor');
    const available = ranked.filter(s => s.isAvailable);
    assert.strictEqual(available.length, 1);
    assert.strictEqual(available[0].shopId, 's1');
    assert.strictEqual(available[0].recommendationScore, 95);
    assert.strictEqual(available[0].isRecommended, true);
  });

  it('Score normalization weights total 100%', () => {
    const shops = [
      createShop('s1', 'Shop 1', { rating: 4, reviewsCount: 10 }),
      createShop('s2', 'Shop 2', { rating: 4.5, reviewsCount: 10 })
    ];
    const ranked = rankShops(shops, customerLat, customerLng, specs, {}, 'motor');
    const available = ranked.filter(s => s.isAvailable);
    const weights = available[0].scoreBreakdown.weights;
    const totalWeight = weights.price + weights.distance + weights.queue + weights.turnaround + weights.rating;
    assert.strictEqual(Math.round(totalWeight * 100), 100);
  });
});
