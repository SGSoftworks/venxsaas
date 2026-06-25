import { Link } from 'react-router-dom'

export function AceptableUsePage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/"
          className="text-sm text-brand-600 hover:text-brand-700 transition-colors inline-block mb-6"
        >
          &larr; Volver al inicio
        </Link>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-600 to-brand-800 text-white px-8 py-6">
            <h1 className="text-xl font-bold">Politica de Conducta Aceptable</h1>
          </div>

          <div className="px-8 py-6 space-y-0">
            <p className="text-xs text-slate-400 mb-6">
              Ultima actualizacion: 21 de junio de 2026
            </p>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                1. Uso Permitido del Servicio
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                VenxPOS es una plataforma SaaS de punto de venta disenada
                exclusivamente para la gestion legitima de operaciones comerciales
                de establecimientos legalmente constituidos en la Republica de
                Colombia. El acceso y uso del Servicio esta condicionado al
                cumplimiento de los presentes lineamientos de conducta aceptable,
                los cuales forman parte integrante de los Terminos y Condiciones.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                2. Actividades Prohibidas
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                Queda terminantemente prohibido el uso del Servicio para:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
                <li>
                  <span className="font-medium text-slate-700">Actividades ilegales:</span>{' '}
                  cualquier conducta que viole las leyes colombianas, incluyendo
                  pero no limitado a la comercializacion de productos prohibidos,
                  lavado de activos, evasion fiscal, financiacion del terrorismo o
                  cualquier actividad tipificada en el Codigo Penal colombiano.
                </li>
                <li>
                  <span className="font-medium text-slate-700">Fraude:</span>{' '}
                  suplantacion de identidad, falsificacion de documentos, uso de
                  NIT invalidos o de terceros sin autorizacion, o cualquier practica
                  que induzca a error a consumidores, proveedores o autoridades.
                </li>
                <li>
                  <span className="font-medium text-slate-700">Spam y comunicaciones no solicitadas:</span>{' '}
                  envio masivo de correos electronicos o mensajes no deseados
                  utilizando la infraestructura del Servicio.
                </li>
                <li>
                  <span className="font-medium text-slate-700">Actividades de scraping y mineria:</span>{' '}
                  extraccion masiva de datos de la plataforma mediante bots,
                  scripts, raspado web o cualquier herramienta automatizada.
                </li>
                <li>
                  <span className="font-medium text-slate-700">Distribucion de malware:</span>{' '}
                  introduccion, transmision o almacenamiento de virus informaticos,
                  ransomware, spyware, troyanos o cualquier codigo malicioso.
                </li>
                <li>
                  <span className="font-medium text-slate-700">Ingenieria inversa:</span>{' '}
                  descompilacion, desensamblado, ingenieria inversa o intento de
                  derivar el codigo fuente del software de VenxPOS.
                </li>
                <li>
                  <span className="font-medium text-slate-700">Acceso no autorizado:</span>{' '}
                  intentos de vulnerar la seguridad, acceder a cuentas de terceros,
                  probar o escanear la red, o cualquier actividad dirigida a
                  comprometer la integridad del Servicio.
                </li>
              </ul>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                3. Uso de Recursos
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                El usuario se compromete a hacer un uso razonable y proporcionado
                de los recursos del Servicio. En particular:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
                <li>
                  No realizar llamadas excesivas o abusivas a la API que puedan
                  degradar el rendimiento del Servicio para otros usuarios.
                </li>
                <li>
                  No sobrecargar la infraestructura mediante operaciones masivas o
                  automatizadas sin coordinacion previa con VenxPOS.
                </li>
                <li>
                  Respetar los limites de almacenamiento, cantidad de registros y
                  volumen de transacciones establecidos para cada plan contratado.
                </li>
                <li>
                  Abstenerse de utilizar el Servicio para alojar o distribuir
                  archivos de gran tamano ajenos al giro ordinario del negocio.
                </li>
              </ul>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                4. Contenido
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                El usuario no debe almacenar, cargar o transmitir a traves del
                Servicio contenido que:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
                <li>Sea ilegal, fraudulento, difamatorio, obsceno o discriminatorio.</li>
                <li>Infrinja derechos de propiedad intelectual de terceros.</li>
                <li>
                  Contenga datos personales sensibles (salud, biometria, origen
                  etnico, orientacion politica o sexual) sin las autorizaciones
                  exigidas por la Ley 1581 de 2012.
                </li>
                <li>
                  Constituya material de explotacion sexual infantil o cualquier
                  forma de pornografia no consentida.
                </li>
              </ul>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                5. Suspension por Violacion
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                VenxPOS se reserva el derecho de suspender o cancelar de inmediato,
                sin previo aviso y sin responsabilidad, el acceso al Servicio de
                cualquier usuario que viole esta Politica de Conducta Aceptable.
                La suspension se aplicara de manera preventiva mientras se investiga
                la presunta violacion. Si se confirma la infraccion, la cuenta sera
                cancelada de forma definitiva sin que proceda reembolso alguno por
                el periodo no utilizado, sin perjuicio de las acciones legales que
                VenxPOS pueda ejercer por los perjuicios ocasionados. VenxPOS
                colaborara con las autoridades competentes en caso de actividades
                que puedan constituir delito.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                6. Reporte de Violaciones
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Si tiene conocimiento de una violacion a esta Politica de Conducta
                Aceptable, le solicitamos que la reporte de inmediato al correo{' '}
                <a
                  href="mailto:soporte@venxpos.com"
                  className="text-brand-600 hover:underline"
                >
                  soporte@venxpos.com
                </a>
                . Todos los reportes seran tratados con confidencialidad y
                analizados por el equipo de seguridad de VenxPOS en un plazo maximo
                de cinco (5) dias habiles.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
