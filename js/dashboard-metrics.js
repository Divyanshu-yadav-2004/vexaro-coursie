// Dashboard-only data helpers. These keep account and KYC metrics distinct.
(function exposeDashboardMetrics(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VexaroDashboardMetrics = api;
})(typeof window !== 'undefined' ? window : globalThis, function createDashboardMetrics() {
  function toTimestamp(value) {
    if (value instanceof Date) {
      const timestamp = value.getTime();
      return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
    }
    const timestamp = Number(value);
    if (Number.isFinite(timestamp) && timestamp > 0) return timestamp;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function normalizeKycStatus(status) {
    return String(status || '').trim().toLowerCase();
  }

  function maxTimestamp(...values) {
    const timestamps = values.map(toTimestamp).filter(Boolean);
    return timestamps.length ? Math.max(...timestamps) : 0;
  }

  function startOfLocalDay(now = Date.now()) {
    const date = new Date(now);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }

  function isToday(value, now = Date.now()) {
    const timestamp = toTimestamp(value);
    if (!timestamp) return false;
    const start = startOfLocalDay(now);
    return timestamp >= start && timestamp < start + 24 * 60 * 60 * 1000;
  }

  function getAccountCollections(users = []) {
    const allUsers = Array.isArray(users) ? users : [];
    const customerUsers = allUsers.filter(user => user.role === 'user');
    const staffUsers = allUsers.filter(user => user.role === 'admin' || user.role === 'owner');
    return { allUsers, customerUsers, staffUsers };
  }

  function getStatusTimestamp(record) {
    if (!record) return null;
    const status = normalizeKycStatus(record.status);
    if (status === 'approved') return toTimestamp(record.approvedOn) || toTimestamp(record.reviewedAt);
    if (status === 'rejected') return toTimestamp(record.reviewedAt);
    return null;
  }

  function getRecentlyUpdatedAt(record, user) {
    return maxTimestamp(
      record && record.updatedAt,
      record && record.reviewedAt,
      record && record.submittedAt,
      user && user.updatedAt,
      user && user.createdAt
    );
  }

  function buildCustomerKycRows(customerUsers = [], records = []) {
    const kycRecords = Array.isArray(records) ? records : [];
    return (Array.isArray(customerUsers) ? customerUsers : []).map(user => {
      const kyc = kycRecords.find(record => String(record.userId) === String(user.id));
      return {
        user,
        kyc,
        status: normalizeKycStatus(user.kycStatus || kyc?.status),
        lastUpdatedAt: getRecentlyUpdatedAt(kyc, user)
      };
    });
  }

  function filterAndSortCustomerKycRows(rows = [], { filter = 'all', search = '', sort = 'latest' } = {}) {
    let result = Array.isArray(rows) ? [...rows] : [];
    const query = String(search || '').trim().toLowerCase();
    if (query) {
      result = result.filter(({ user }) => [user.name, user.email, user.mobile]
        .some(value => String(value || '').toLowerCase().includes(query)));
    }
    if (filter !== 'all') result = result.filter(row => row.status === filter);

    if (sort === 'latest') result.sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);
    else if (sort === 'oldest') result.sort((a, b) => toTimestamp(a.kyc?.submittedAt) - toTimestamp(b.kyc?.submittedAt));
    else if (sort === 'name') result.sort((a, b) => String(a.user.name || '').localeCompare(String(b.user.name || '')));
    else if (sort === 'status') result.sort((a, b) => String(a.status || '').localeCompare(String(b.status || '')));
    return result;
  }

  function paginateRows(rows = [], page = 1, itemsPerPage = 10) {
    const total = Array.isArray(rows) ? rows.length : 0;
    const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, total);
    return { currentPage, startIndex, endIndex, total, totalPages, items: rows.slice(startIndex, endIndex) };
  }

  function buildDashboardMetrics({ users = [], records = [], activities = [], now = Date.now() } = {}) {
    const { allUsers, customerUsers, staffUsers } = getAccountCollections(users);
    const kycRecords = Array.isArray(records) ? records : [];
    const activityLogs = Array.isArray(activities) ? activities : [];

    return {
      totalAccounts: allUsers.length,
      customerAccounts: customerUsers.length,
      staffAccounts: staffUsers.length,
      kycRecords: kycRecords.length,
      pending: kycRecords.filter(record => normalizeKycStatus(record.status) === 'pending').length,
      approved: kycRecords.filter(record => normalizeKycStatus(record.status) === 'approved').length,
      rejected: kycRecords.filter(record => normalizeKycStatus(record.status) === 'rejected').length,
      newKycRequestsToday: kycRecords.filter(record => isToday(record.submittedAt, now)).length,
      reviewedToday: kycRecords.filter(record => isToday(record.reviewedAt, now)).length,
      approvedToday: kycRecords.filter(record => normalizeKycStatus(record.status) === 'approved' && isToday(getStatusTimestamp(record), now)).length,
      rejectedToday: kycRecords.filter(record => normalizeKycStatus(record.status) === 'rejected' && isToday(getStatusTimestamp(record), now)).length,
      newUsersToday: allUsers.filter(user => isToday(user.createdAt, now)).length,
      activityToday: activityLogs.filter(activity => isToday(activity.timestamp, now)).length
    };
  }

  return {
    toTimestamp,
    normalizeKycStatus,
    maxTimestamp,
    isToday,
    getAccountCollections,
    getRecentlyUpdatedAt,
    buildCustomerKycRows,
    filterAndSortCustomerKycRows,
    paginateRows,
    buildDashboardMetrics
  };
});
