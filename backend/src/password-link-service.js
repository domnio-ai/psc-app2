import crypto from 'node:crypto'

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character])

export const createPasswordLinkService = ({
  transaction,
  sendMail,
  frontendOrigin,
  randomBytes = crypto.randomBytes,
}) => {
  if (typeof transaction !== 'function' || typeof sendMail !== 'function') {
    throw new TypeError('Password link service requires transaction and sendMail functions.')
  }
  if (!frontendOrigin) throw new TypeError('Password link service requires a configured frontend origin.')

  const sendPasswordLink = async (user, { purpose = 'reset' } = {}) => {
    if (!user?.id || !user?.email) throw new TypeError('A user id and registered email are required.')
    if (!['reset', 'setup'].includes(purpose)) throw new TypeError('Password link purpose must be reset or setup.')

    const rawToken = randomBytes(32).toString('hex')
    if (!/^[a-f0-9]{64}$/.test(rawToken)) throw new TypeError('Password token generator returned an invalid token.')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

    await transaction(async client => {
      await client.query(
        'UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL',
        [user.id],
      )
      await client.query(
        "INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 minutes')",
        [user.id, tokenHash],
      )
    })

    const resetUrl = new URL('/', frontendOrigin)
    resetUrl.hash = new URLSearchParams({ resetToken: rawToken }).toString()
    const isSetup = purpose === 'setup'
    const displayName = String(user.name ?? '').replace(/[\r\n\t]+/g, ' ').trim()
    const greetingText = displayName ? `Dear ${displayName},` : 'Dear colleague,'
    const greeting = displayName ? `Dear ${escapeHtml(displayName)},` : 'Dear colleague,'
    const action = isSetup ? 'complete your PSC APP2 account setup' : 'reset your PSC APP2 password'
    const buttonText = isSetup ? 'Set up password' : 'Reset password'
    const subject = isSetup ? 'Set up your PSC APP2 account' : 'Reset your PSC APP2 password'
    const text = `${greetingText}

A request was made to ${action}.

Use this secure, single-use link within 30 minutes:
${resetUrl.toString()}

The link can be used once. If you did not request this change, you can ignore this email.`
    const html = `<div style="font-family:Arial,sans-serif;max-width:640px;color:#263238">
      <h2 style="color:#8a6a00">PSC APP2</h2>
      <p>${greeting}</p>
      <p>A request was made to ${action}.</p>
      <p><a href="${escapeHtml(resetUrl.toString())}" style="display:inline-block;background:#8a6a00;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px">${buttonText}</a></p>
      <p>This secure link can be used once and expires in 30 minutes.</p>
      <p>If you did not request this change, you can ignore this email.</p>
      <hr><small>Public Service Commission Research Department</small>
    </div>`

    try {
      const delivery = await sendMail({ to: user.email, subject, text, html })
      const accepted = Array.isArray(delivery?.accepted)
        && delivery.accepted.some(recipient => String(recipient).toLowerCase() === String(user.email).toLowerCase())
      if (!accepted) {
        throw Object.assign(new Error('SMTP did not accept the password link recipient.'), {
          statusCode: 502,
          code: 'EMAIL_RECIPIENT_NOT_ACCEPTED',
        })
      }
      return { accepted: true, expiresInMinutes: 30 }
    } catch (error) {
      try {
        await transaction(async client => {
          await client.query(
            'UPDATE password_reset_tokens SET used_at=NOW() WHERE token_hash=$1 AND used_at IS NULL',
            [tokenHash],
          )
        })
      } catch {
        // Never log the raw token or provider response.
        console.error('PASSWORD_LINK_TOKEN_INVALIDATION_FAILED', { userId: user.id })
      }
      throw Object.assign(new Error('Password link email could not be delivered.'), {
        statusCode: Number.isInteger(error?.statusCode) ? error.statusCode : 502,
        code: 'PASSWORD_LINK_DELIVERY_FAILED',
      })
    }
  }

  return { sendPasswordLink }
}
