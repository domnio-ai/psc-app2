export function normalizeAdminIdentity(nameInput, emailInput) {
  const name = String(nameInput ?? '').trim()
  const email = String(emailInput ?? '').trim().toLowerCase()
  if (name.length < 3 || name.length > 160) throw new Error('Name must be between 3 and 160 characters.')
  if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address no longer than 255 characters.')
  }
  return { name, email }
}

export function validateAdminPassword(password) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 128
    || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('Password must be 10 to 128 characters and include uppercase, lowercase, and numeric characters.')
  }
  return password
}
