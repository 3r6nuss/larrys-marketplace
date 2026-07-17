export function toInt(value, fallback = null) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function toId(value) {
  return toInt(value, null);
}

export function toCount(value) {
  return toInt(value, 0);
}

export function buildListingSearchFilter(query) {
  const terms = String(query || '').trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return { clause: null, params: [] };

  const termClause = '(l.brand ILIKE ? OR l.model ILIKE ? OR l.plate ILIKE ?)';
  return {
    clause: terms.map(() => termClause).join(' AND '),
    params: terms.flatMap(term => [`%${term}%`, `%${term}%`, `%${term}%`]),
  };
}

export function userHasRole(user, roles) {
  if (!user?.role || !roles) return false;
  if (roles instanceof Set) return roles.has(user.role);
  if (Array.isArray(roles)) return roles.includes(user.role);
  return false;
}

export function canManageOwnedResource(ownerId, user, adminRoles) {
  if (!user) return false;
  return ownerId === user.id || userHasRole(user, adminRoles);
}

export function hasDiscordNotificationsEnabled(userRow) {
  return Boolean(userRow?.discord_id) && (userRow.discord_notifications == 1 || userRow.discord_notifications === true);
}
