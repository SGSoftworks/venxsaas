import { Link } from 'react-router-dom'

export function PrivacidadPage() {
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
            <h1 className="text-xl font-bold">Politica de Privacidad</h1>
          </div>

          <div className="px-8 py-6 space-y-0">
            <p className="text-xs text-slate-400 mb-6">
              Ultima actualizacion: 21 de junio de 2026
            </p>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                1. Datos que Recolectamos
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                En VenxPOS recolectamos unicamente los datos estrictamente necesarios
                para la prestacion del Servicio, de conformidad con el principio de
                finalidad establecido en la Ley 1581 de 2012:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
                <li>
                  <span className="font-medium text-slate-700">Datos de negocio:</span>{' '}
                  razon social, nombre comercial, NIT, direccion del establecimiento.
                </li>
                <li>
                  <span className="font-medium text-slate-700">Datos de contacto:</span>{' '}
                  correo electronico, numero de telefono comercial.
                </li>
                <li>
                  <span className="font-medium text-slate-700">Datos transaccionales:</span>{' '}
                  registro de ventas, inventario, productos, clientes y facturacion
                  generados dentro del uso del Servicio.
                </li>
                <li>
                  <span className="font-medium text-slate-700">Datos de pago:</span>{' '}
                  referencias de transaccion de Wompi. VenxPOS no almacena numeros
                  de tarjeta de credito ni debito, CVV ni fechas de vencimiento.
                  Estos datos son gestionados exclusivamente por Wompi (Bancolombia
                  S.A.) bajo sus propios estandares de seguridad PCI-DSS.
                </li>
                <li>
                  <span className="font-medium text-slate-700">Datos de uso:</span>{' '}
                  interacciones con la plataforma, registros de acceso, direccion IP
                  y tipo de navegador con fines de diagnostico y mejora del servicio.
                </li>
              </ul>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                2. Finalidad del Tratamiento
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                Los datos recolectados se tratan para las siguientes finalidades
                legitimas, informadas y autorizadas por el titular:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
                <li>Proveer, mantener y mejorar el Servicio contratado.</li>
                <li>Procesar pagos y gestionar el ciclo de suscripcion.</li>
                <li>Emitir facturas electronicas y documentos equivalentes.</li>
                <li>
                  Enviar comunicaciones operativas, notificaciones de servicio y
                  soporte tecnico.
                </li>
                <li>
                  Cumplir las obligaciones legales, fiscales y contables bajo la
                  legislacion colombiana.
                </li>
                <li>Detectar y prevenir fraudes o usos no autorizados.</li>
              </ul>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                3. Almacenamiento y Seguridad
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Los datos se almacenan en servidores seguros de Supabase sobre
                infraestructura AWS (Amazon Web Services), con cifrado en transito
                mediante TLS 1.3 y cifrado en reposo AES-256. Las contrasenas se
                almacenan con hash bcrypt con sal unica por usuario. VenxPOS
                implementa medidas tecnicas, administrativas y organizacionales para
                proteger los datos contra acceso no autorizado, perdida, alteracion
                o divulgacion. Sin embargo, ningun sistema de almacenamiento o
                transmision por internet es completamente seguro, por lo cual no se
                puede garantizar seguridad absoluta.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                4. Retencion de Datos
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Conservamos los datos personales mientras la cuenta del usuario
                permanezca activa. Al cancelar la suscripcion, los datos se conservan
                por un periodo de noventa (90) dias calendario para facilitar la
                reactivacion, tras el cual son eliminados de manera irreversible.
                Los datos de facturacion y registros contables se conservan por el
                termino de cinco (5) anos exigido por el Estatuto Tributario
                colombiano y la Resolucion 000042 de 2020 de la DIAN.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                5. Derechos del Titular (Ley 1581 de 2012)
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                De conformidad con la Ley 1581 de 2012 y el Decreto Reglamentario
                1377 de 2013, como titular de los datos personales usted tiene
                derecho a:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
                <li>
                  Conocer, actualizar y rectificar sus datos personales (articulo 8,
                  literal a).
                </li>
                <li>
                  Solicitar prueba de la autorizacion otorgada para el tratamiento
                  (articulo 8, literal b).
                </li>
                <li>
                  Ser informado sobre el uso que se ha dado a sus datos, previa
                  solicitud (articulo 8, literal c).
                </li>
                <li>
                  Revocar la autorizacion y solicitar la supresion de sus datos
                  cuando no exista un deber legal o contractual que impida su
                  eliminacion (articulo 8, literales e y f).
                </li>
                <li>
                  Presentar quejas ante la Superintendencia de Industria y Comercio
                  (SIC) por infracciones a la Ley de Habeas Data.
                </li>
              </ul>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                6. Transferencia Internacional
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Los datos pueden ser almacenados y procesados en servidores ubicados
                fuera de Colombia (Estados Unidos, a traves de AWS/Supabase). Al
                aceptar esta Politica, usted autoriza expresamente la transferencia
                internacional de sus datos bajo los estandares de proteccion
                aplicables. VenxPOS exige contractualmente a sus proveedores de
                infraestructura el cumplimiento de medidas de seguridad equivalentes
                a las exigidas por la legislacion colombiana.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                7. Contacto para el Ejercicio de Derechos
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Para ejercer sus derechos como titular, presentar consultas, quejas
                o solicitar informacion sobre el tratamiento de sus datos personales,
                comuniquese a:{' '}
                <a
                  href="mailto:soporte@venxpos.com"
                  className="text-brand-600 hover:underline"
                >
                  soporte@venxpos.com
                </a>
                . Su solicitud sera atendida en un plazo maximo de diez (10) dias
                habiles, prorrogables por una sola vez por igual periodo conforme al
                articulo 14 de la Ley 1581 de 2012.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
