import { buildWhatsAppUrl, APP_CONFIG } from '@/lib/appConfig'
import { LegalLayout, type LegalSection } from './LegalLayout'
import { Mail, MessageCircle } from 'lucide-react'

const sections: LegalSection[] = [
  { id: 'datos-recopilados', title: '1. Datos que Recopilamos' },
  { id: 'finalidad', title: '2. Finalidad del Tratamiento' },
  { id: 'seguridad', title: '3. Almacenamiento y Seguridad' },
  { id: 'conservacion', title: '4. Conservación de Datos' },
  { id: 'derechos', title: '5. Derechos del Titular' },
  { id: 'transferencia', title: '6. Transferencia Internacional' },
  { id: 'cookies', title: '7. Cookies' },
  { id: 'contacto', title: '8. Contacto' },
]

export function PrivacidadPage() {
  return (
    <LegalLayout title="Política de Privacidad" sections={sections}>
      <Section id="datos-recopilados" num="1" title="Datos que Recopilamos">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          En VenxPOS recopilamos únicamente los datos estrictamente necesarios para la
          prestación del Servicio, de conformidad con el principio de finalidad establecido
          en la Ley 1581 de 2012:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
          <li><span className="font-medium text-slate-700">Nombre:</span> nombres y apellidos del titular o representante legal.</li>
          <li><span className="font-medium text-slate-700">Correo electrónico:</span> dirección de correo del contacto principal.</li>
          <li><span className="font-medium text-slate-700">Teléfono:</span> número de contacto comercial.</li>
          <li><span className="font-medium text-slate-700">Empresa:</span> razón social o nombre comercial del establecimiento.</li>
          <li><span className="font-medium text-slate-700">NIT:</span> número de identificación tributaria del comercio.</li>
          <li><span className="font-medium text-slate-700">Dirección:</span> dirección física del establecimiento principal.</li>
          <li><span className="font-medium text-slate-700">Actividad comercial:</span> sector o tipo de comercio del Cliente.</li>
          <li><span className="font-medium text-slate-700">Historial de pagos:</span> registro de transacciones y facturación.</li>
          <li><span className="font-medium text-slate-700">Facturas:</span> documentos electrónicos generados por el Servicio.</li>
          <li><span className="font-medium text-slate-700">Inventario:</span> registro de productos y existencias del comercio.</li>
          <li><span className="font-medium text-slate-700">Ventas:</span> transacciones comerciales registradas en la plataforma.</li>
          <li><span className="font-medium text-slate-700">Sucursales:</span> sedes o puntos de venta asociados a la cuenta.</li>
        </ul>
        <p className="text-sm text-slate-600 leading-relaxed mt-3">
          VenxPOS no procesa pagos con tarjeta y no almacena números de tarjeta, CVV ni
          fechas de vencimiento. Los pagos de suscripción se registran manualmente mediante
          comprobantes bajo los estándares de seguridad de la plataforma.
        </p>
      </Section>

      <Section id="finalidad" num="2" title="Finalidad del Tratamiento">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          Los datos recopilados se tratan para las siguientes finalidades legítimas:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
          <li>Prestación del Servicio contratado y todas sus funcionalidades.</li>
          <li>Soporte técnico y atención al Cliente.</li>
          <li>Facturación, procesamiento de pagos y gestión de suscripciones.</li>
          <li>Generación de analíticas y reportes operativos.</li>
          <li>Seguridad de la plataforma, detección y prevención de fraudes.</li>
          <li>Cumplimiento de obligaciones legales, fiscales y contables colombianas.</li>
          <li>Mejora continua del Servicio y desarrollo de nuevas funcionalidades.</li>
          <li>Comunicaciones operativas y notificaciones de servicio.</li>
        </ul>
      </Section>

      <Section id="seguridad" num="3" title="Almacenamiento y Seguridad">
        <p className="text-sm text-slate-600 leading-relaxed">
          Los datos se almacenan en servidores seguros de Supabase sobre infraestructura AWS
          (Amazon Web Services), con cifrado en tránsito mediante TLS 1.3 y cifrado en reposo
          AES-256. Las contraseñas se almacenan con hash bcrypt con sal única por usuario.
          VenxPOS implementa medidas técnicas, administrativas y organizacionales para proteger
          los datos contra acceso no autorizado, pérdida, alteración o divulgación, incluyendo
          control de acceso basado en roles (RBAC), autenticación segura y monitoreo continuo
          de la plataforma. Sin embargo, ningún sistema de almacenamiento o transmisión por
          internet es completamente seguro, por lo cual no se puede garantizar seguridad absoluta.
        </p>
      </Section>

      <Section id="conservacion" num="4" title="Conservación de Datos">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          Conservamos los datos personales mientras la cuenta del Cliente permanezca activa.
          Al cancelar la suscripción, los datos se conservan por un período de noventa (90)
          días calendario para facilitar la reactivación, tras el cual son eliminados de manera
          irreversible. Los datos de facturación y registros contables se conservan por el
          término de cinco (5) años exigido por el Estatuto Tributario colombiano.
        </p>
        <p className="text-sm text-slate-600 leading-relaxed">
          El Cliente puede solicitar en cualquier momento la eliminación anticipada de sus
          datos contactando a la Gerencia, siempre que no exista una obligación legal que
          impida dicha eliminación.
        </p>
      </Section>

      <Section id="derechos" num="5" title="Derechos del Titular (Ley 1581 de 2012)">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          De conformidad con la Ley 1581 de 2012 y el Decreto Reglamentario 1377 de 2013,
          como titular de los datos personales usted tiene derecho a:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
          <li><span className="font-medium text-slate-700">Consultar</span> sus datos personales en cualquier momento.</li>
          <li><span className="font-medium text-slate-700">Actualizar</span> la información registrada cuando sea necesario.</li>
          <li><span className="font-medium text-slate-700">Rectificar</span> datos inexactos o incompletos.</li>
          <li><span className="font-medium text-slate-700">Eliminar</span> sus datos cuando no exista un deber legal que lo impida.</li>
          <li><span className="font-medium text-slate-700">Solicitar copia</span> de la autorización otorgada para el tratamiento.</li>
          <li><span className="font-medium text-slate-700">Revocar</span> la autorización para el tratamiento de sus datos.</li>
          <li><span className="font-medium text-slate-700">Presentar quejas</span> ante la Superintendencia de Industria y Comercio (SIC) por infracciones a la Ley de Habeas Data.</li>
        </ul>
      </Section>

      <Section id="transferencia" num="6" title="Transferencia Internacional">
        <p className="text-sm text-slate-600 leading-relaxed">
          Los datos pueden ser almacenados y procesados en servidores ubicados fuera de Colombia
          (Estados Unidos, a través de AWS/Supabase). Al aceptar esta Política, el Cliente autoriza
          expresamente la transferencia internacional de sus datos bajo los estándares de protección
          aplicables. VenxPOS exige contractualmente a sus proveedores de infraestructura el
          cumplimiento de medidas de seguridad equivalentes a las exigidas por la legislación colombiana.
        </p>
      </Section>

      <Section id="cookies" num="7" title="Cookies">
        <p className="text-sm text-slate-600 leading-relaxed">
          VenxPOS utiliza cookies técnicas, funcionales y analíticas para el correcto funcionamiento
          de la plataforma, la autenticación de usuarios y la mejora de la experiencia de navegación.
          Para obtener información detallada sobre los tipos de cookies utilizadas, su finalidad y
          cómo configurarlas, consulte nuestra{' '}
          <a href="/legal/cookies" className="text-brand-600 hover:underline">Política de Cookies</a>.
        </p>
      </Section>

      <Section id="contacto" num="8" title="Contacto para el Ejercicio de Derechos">
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          Para ejercer sus derechos como titular, presentar consultas, quejas o solicitar
          información sobre el tratamiento de sus datos personales, puede comunicarse a través
          de los siguientes canales. Su solicitud será atendida en un plazo máximo de diez (10)
          días hábiles, prorrogables por una sola vez por igual período conforme al artículo 14
          de la Ley 1581 de 2012.
        </p>
        <div className="flex flex-wrap gap-3 mt-3">
          <a
            href={buildWhatsAppUrl('Hola, tengo una consulta sobre la política de privacidad de VenxPOS.')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp: {APP_CONFIG.whatsapp}
          </a>
          <a
            href={`mailto:${APP_CONFIG.email}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <Mail className="w-4 h-4" />
            {APP_CONFIG.email}
          </a>
        </div>
      </Section>
    </LegalLayout>
  )
}

function Section({ id, num, title, children }: { id: string; num: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="py-5 border-t border-slate-100 first:border-t-0">
      <h2 className="text-base font-semibold text-slate-900 mb-3">
        {num}. {title}
      </h2>
      {children}
    </section>
  )
}
