const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = { module: { exports: {} }, globalThis: {} };
vm.runInNewContext(fs.readFileSync('./js/dashboard-metrics.js', 'utf8'), context, {
  filename: 'js/dashboard-metrics.js'
});
const {
  buildDashboardMetrics,
  getAccountCollections,
  getRecentlyUpdatedAt,
  buildCustomerKycRows,
  filterAndSortCustomerKycRows,
  paginateRows
} = context.module.exports;

const now = new Date(2026, 8, 16, 12, 0, 0).getTime();
const today = new Date(2026, 8, 16, 9, 0, 0).getTime();
const yesterday = new Date(2026, 8, 15, 9, 0, 0).getTime();

test('separates all, customer, and staff accounts without losing admin users', () => {
  const users = [
    { id: 'admin1', role: 'admin', createdAt: yesterday },
    { id: 'owner1', role: 'owner', createdAt: yesterday },
    ...Array.from({ length: 69 }, (_, index) => ({ id: `u${index + 1}`, role: 'user', createdAt: index === 0 ? today : yesterday }))
  ];
  const collections = getAccountCollections(users);
  assert.equal(collections.allUsers.length, 71);
  assert.equal(collections.customerUsers.length, 69);
  assert.equal(collections.staffUsers.length, 2);
  assert.equal(collections.allUsers.some(user => user.role === 'admin'), true);
  assert.equal(collections.customerUsers.some(user => user.role === 'owner'), false);
});

test('keeps KYC records distinct and counts date metrics from their semantic timestamps', () => {
  const users = [
    { id: 'admin1', role: 'admin', createdAt: yesterday },
    { id: 'owner1', role: 'owner', createdAt: yesterday },
    ...Array.from({ length: 69 }, (_, index) => ({ id: `u${index + 1}`, role: 'user', createdAt: index === 0 ? today : yesterday }))
  ];
  const records = [
    { id: 'k1', userId: 'u1', status: 'approved', submittedAt: yesterday, reviewedAt: today, approvedOn: today, updatedAt: today },
    { id: 'k2', userId: 'u2', status: 'rejected', submittedAt: yesterday, reviewedAt: today, updatedAt: today },
    { id: 'k3', userId: 'u3', status: 'pending', submittedAt: today, updatedAt: today },
    ...Array.from({ length: 62 }, (_, index) => ({ id: `k${index + 4}`, userId: `u${index + 4}`, status: 'pending', submittedAt: yesterday, updatedAt: yesterday }))
  ];
  const metrics = buildDashboardMetrics({ users, records, activities: [{ timestamp: today }, { timestamp: yesterday }], now });
  assert.equal(metrics.totalAccounts, 71);
  assert.equal(metrics.customerAccounts, 69);
  assert.equal(metrics.staffAccounts, 2);
  assert.equal(metrics.kycRecords, 65);
  assert.equal(metrics.newKycRequestsToday, 1);
  assert.equal(metrics.reviewedToday, 2);
  assert.equal(metrics.approvedToday, 1);
  assert.equal(metrics.rejectedToday, 1);
  assert.equal(metrics.newUsersToday, 1);
  assert.equal(metrics.activityToday, 1);
});

test('recently updated sorting can surface an old submission reviewed today', () => {
  const oldSubmission = new Date(2026, 8, 1, 9, 0, 0).getTime();
  const reviewedToday = new Date(2026, 8, 16, 10, 0, 0).getTime();
  assert.equal(
    getRecentlyUpdatedAt({ submittedAt: oldSubmission, reviewedAt: reviewedToday }, { createdAt: oldSubmission }),
    reviewedToday
  );
});

test('counts API-style ISO timestamps and case-insensitive KYC statuses', () => {
  const metrics = buildDashboardMetrics({
    records: [
      { status: 'Pending', submittedAt: new Date(today).toISOString() },
      { status: 'APPROVED', submittedAt: new Date(today).toISOString(), reviewedAt: new Date(today).toISOString() }
    ],
    now
  });
  assert.equal(metrics.pending, 1);
  assert.equal(metrics.approved, 1);
  assert.equal(metrics.newKycRequestsToday, 2);
  assert.equal(metrics.approvedToday, 1);
});

test('customer filtering and pagination never change the complete account count', () => {
  const users = [
    { id: 'admin1', role: 'admin', name: 'System Admin', email: 'admin@example.com', mobile: '', createdAt: yesterday },
    { id: 'owner1', role: 'owner', name: 'Owner', email: 'owner@example.com', mobile: '', createdAt: yesterday },
    ...Array.from({ length: 69 }, (_, index) => ({
      id: `u${index + 1}`,
      role: 'user',
      name: `Customer ${index + 1}`,
      email: `customer${index + 1}@example.com`,
      mobile: `9000000${String(index + 10).slice(-3)}`,
      kycStatus: index % 2 ? 'pending' : 'approved',
      createdAt: yesterday,
      updatedAt: yesterday
    }))
  ];
  const records = users.filter(user => user.role === 'user').map(user => ({
    id: `k${user.id}`,
    userId: user.id,
    status: user.kycStatus,
    submittedAt: yesterday,
    updatedAt: yesterday
  }));
  const { allUsers, customerUsers } = getAccountCollections(users);
  const rows = buildCustomerKycRows(customerUsers, records);
  const filtered = filterAndSortCustomerKycRows(rows, { filter: 'pending', search: 'Customer', sort: 'latest' });
  const page = paginateRows(filtered, 1, 10);

  assert.equal(allUsers.length, 71);
  assert.equal(rows.length, 69);
  assert.equal(filtered.length, 34);
  assert.equal(page.items.length, 10);
  assert.equal(page.total, 34);
  assert.equal(page.totalPages, 4);
});
