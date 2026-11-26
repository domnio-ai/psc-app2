export const sessionExpiryFromMinutes = (value, fallback = '8h') => {
  const minutes = Number(value)
  return Number.isInteger(minutes) && minutes >= 15 && minutes <= 1440
    ? `${minutes}m`
    : fallback
}
