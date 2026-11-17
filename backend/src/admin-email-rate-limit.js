export const createAdminEmailCooldown = ({ cooldownMs = 60_000, now = Date.now } = {}) => {
  const attempts = new Map();

  return (adminId) => {
    const current = now();
    const previous = attempts.get(adminId);
    if (previous !== undefined && current - previous < cooldownMs) {
      return { allowed: false, retryAfterSeconds: Math.ceil((cooldownMs - (current - previous)) / 1000) };
    }
    attempts.set(adminId, current);
    if (attempts.size > 500) {
      for (const [key, timestamp] of attempts) {
        if (current - timestamp >= cooldownMs) attempts.delete(key);
      }
    }
    return { allowed: true, retryAfterSeconds: 0 };
  };
};
