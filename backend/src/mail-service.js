const providerFor = (host) => String(host || "").toLowerCase() === "smtp.gmail.com"
  ? "Gmail SMTP"
  : host ? "Custom SMTP" : null;

export const createMailService = (smtp, createTransport) => {
  const mailStatus = () => {
    const complete = Boolean(smtp.host && smtp.port && smtp.user && smtp.password && smtp.from);
    return {
      enabled: smtp.enabled,
      configured: complete,
      provider: providerFor(smtp.host),
      host: smtp.host || null,
      port: smtp.port,
      secure: smtp.secure,
      from: smtp.from || "",
      ready: smtp.enabled && complete,
    };
  };

  const sendMail = async ({ to, subject, text, attachments = [] }) => {
    if (!mailStatus().ready) {
      throw Object.assign(new Error("Email delivery is not enabled or SMTP configuration is incomplete."), { statusCode: 503 });
    }
    try {
      const transport = await createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.password },
        requireTLS: !smtp.secure,
      });
      await transport.verify();
      const info = await transport.sendMail({
        from: smtp.from,
        to,
        subject,
        text,
        attachments,
        html: `<div style="font-family:Arial,sans-serif;max-width:640px"><h2 style="color:#8a6a00">PSC REDESY</h2><p>${String(text ?? "").replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character])}</p><hr><small>Public Service Commission Research Department</small></div>`,
      });
      return { messageId: info.messageId, accepted: info.accepted };
    } catch {
      throw Object.assign(new Error("The SMTP provider rejected verification or delivery. Check the server-side Gmail App Password/OAuth settings, host and transport security."), { statusCode: 502, code: "EMAIL_TRANSPORT_FAILED" });
    }
  };

  return { mailStatus, sendMail };
};
