/**
 * Role guard middleware factory.
 * Usage: router.get('/admin-route', authMiddleware, roleGuard('admin', 'owner'), handler)
 */
module.exports = function roleGuard(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
};
