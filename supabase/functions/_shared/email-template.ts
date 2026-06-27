const LOGO_URL = 'https://beacnoxukkoellhecofm.supabase.co/storage/v1/object/public/branding/logo-saas.png'

export function buildEmailHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px; }
    .header { text-align: center; padding: 32px 0 24px; }
    .header img { max-width: 200px; height: auto; }
    .content { background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .content h1 { font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 16px; }
    .detail-row { display: block; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #374151; }
    .detail-label { color: #6b7280; }
    .badge-success { display: inline-block; background: #ecfdf5; color: #065f46; font-weight: 600; font-size: 14px; padding: 8px 16px; border-radius: 8px; margin: 12px 0; }
    .badge-error { display: inline-block; background: #fef2f2; color: #991b1b; font-weight: 600; font-size: 14px; padding: 8px 16px; border-radius: 8px; margin: 12px 0; }
    .cta { display: inline-block; background: #6D3CF5; color: #ffffff !important; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0; }
    .footer { text-align: center; padding: 24px 0; font-size: 12px; color: #9ca3af; }
    .footer a { color: #6D3CF5; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${LOGO_URL}" alt="VenxPOS" />
    </div>
    <div class="content">
      <h1>${title}</h1>
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>VenxPOS SaaS — Desarrollado por <a href="https://jgsoftworks-site.netlify.app/" target="_blank" rel="noopener noreferrer" style="color:#6D3CF5;text-decoration:underline;">JGSoftworks</a></p>
      <p><a href="https://venxpos.com">www.venxpos.com</a> | <a href="mailto:juan.dev1809@gmail.com">juan.dev1809@gmail.com</a> | WhatsApp: 3228372341</p>
    </div>
  </div>
</body>
</html>`
}

export function pagoAprobadoHtml(params: { negocio: string; monto: string; referencia: string; fecha: string; plan: string }): string {
  return buildEmailHtml('¡Pago aprobado!', `
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px;">Hola <strong>${params.negocio}</strong>, tu pago ha sido procesado exitosamente.</p>
    <span class="badge-success">✓ Pago aprobado</span>
    <div style="margin-top: 20px;">
      <span class="detail-row"><span class="detail-label">Referencia:</span> ${params.referencia}</span>
      <span class="detail-row"><span class="detail-label">Monto:</span> <strong>$${params.monto} COP</strong></span>
      <span class="detail-row"><span class="detail-label">Plan:</span> ${params.plan}</span>
      <span class="detail-row"><span class="detail-label">Fecha:</span> ${params.fecha}</span>
    </div>
    <p style="color: #374151; font-size: 14px; margin-top: 20px;">Ya puedes disfrutar de todas las funcionalidades de VenxPOS. Recibirás tu factura electrónica en este correo en los próximos minutos.</p>
    <a href="https://app.venxpos.com" class="cta">Ir al dashboard</a>
  `)
}

export function pagoRechazadoHtml(params: { negocio: string; monto: string; referencia: string; motivo?: string }): string {
  return buildEmailHtml('Pago rechazado', `
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px;">Hola <strong>${params.negocio}</strong>, el pago no pudo ser procesado.</p>
    <span class="badge-error">✗ Pago rechazado</span>
    <div style="margin-top: 20px;">
      <span class="detail-row"><span class="detail-label">Referencia:</span> ${params.referencia}</span>
      <span class="detail-row"><span class="detail-label">Monto:</span> <strong>$${params.monto} COP</strong></span>
      ${params.motivo ? `<span class="detail-row"><span class="detail-label">Motivo:</span> ${params.motivo}</span>` : ''}
    </div>
    <p style="color: #374151; font-size: 14px; margin-top: 20px;">Puedes intentar nuevamente desde el panel de administración. Si el problema persiste, contacta a tu banco o a nuestro soporte.</p>
    <a href="https://app.venxpos.com" class="cta">Ir al dashboard</a>
  `)
}

export function renovacionExitosaHtml(params: { negocio: string; monto: string; fecha_proximo_cobro: string; plan: string }): string {
  return buildEmailHtml('Renovación exitosa', `
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px;">Hola <strong>${params.negocio}</strong>, tu suscripción se ha renovado automáticamente.</p>
    <span class="badge-success">✓ Renovación exitosa</span>
    <div style="margin-top: 20px;">
      <span class="detail-row"><span class="detail-label">Plan:</span> ${params.plan}</span>
      <span class="detail-row"><span class="detail-label">Monto:</span> <strong>$${params.monto} COP</strong></span>
      <span class="detail-row"><span class="detail-label">Próximo cobro:</span> ${params.fecha_proximo_cobro}</span>
    </div>
    <p style="color: #374151; font-size: 14px; margin-top: 20px;">Tu suscripción continúa activa. No es necesario que realices ninguna acción adicional.</p>
  `)
}

export function suscripcionVencidaHtml(params: { negocio: string; plan: string }): string {
  return buildEmailHtml('Suscripción vencida', `
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px;">Hola <strong>${params.negocio}</strong>, el cobro de tu suscripción no pudo completarse.</p>
    <span class="badge-error">✗ Pago rechazado</span>
    <div style="margin-top: 20px;">
      <span class="detail-row"><span class="detail-label">Plan:</span> ${params.plan}</span>
    </div>
    <p style="color: #374151; font-size: 14px; margin-top: 20px;">Tu cuenta está en estado de vencimiento. Algunas funcionalidades podrían estar limitadas. Realiza el pago desde el dashboard para reactivar tu suscripción.</p>
    <a href="https://app.venxpos.com" class="cta">Realizar pago</a>
  `)
}
