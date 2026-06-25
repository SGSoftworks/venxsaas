import { Link } from 'react-router-dom'

export function CumplimientoPage() {
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
            <h1 className="text-xl font-bold">Cumplimiento Normativo</h1>
          </div>

          <div className="px-8 py-6 space-y-0">
            <p className="text-xs text-slate-400 mb-6">
              Ultima actualizacion: 21 de junio de 2026
            </p>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                1. Facturacion Electronica DIAN
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                VenxPOS integra funcionalidades de facturacion electronica conforme
                al marco normativo establecido por la Direccion de Impuestos y
                Aduanas Nacionales (DIAN) de Colombia, particularmente:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
                <li>
                  <span className="font-medium text-slate-700">Decreto 2242 de 2015:</span>{' '}
                  reglamenta las condiciones de expedicion de la factura electronica
                  como documento equivalente a la factura de venta.
                </li>
                <li>
                  <span className="font-medium text-slate-700">Resolucion 000042 de 2020:</span>{' '}
                  establece los sistemas tecnicos de control, requisitos y
                  procedimientos para la facturacion electronica en Colombia.
                </li>
                <li>
                  <span className="font-medium text-slate-700">Anexo tecnico 1.0:</span>{' '}
                  especificaciones tecnicas de los documentos electronicos
                  (XML, firma digital, codigos de representacion grafica).
                </li>
              </ul>
              <p className="text-sm text-slate-600 leading-relaxed mt-3">
                El usuario es responsable de configurar correctamente los datos
                fiscales de su establecimiento (NIT, regimen tributario, actividad
                economica) dentro de la plataforma para la generacion de documentos
                electronicos validos ante la DIAN.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                2. Ley 1581 de 2012 &mdash; Proteccion de Datos Personales
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                VenxPOS actua como Responsable del Tratamiento de los datos
                personales de los usuarios del Servicio y como Encargado del
                Tratamiento respecto de los datos que los comercios gestionan
                sobre sus propios clientes dentro de la plataforma. En ambos
                roles, VenxPOS cumple con las disposiciones de la Ley 1581 de
                2012 (Habeas Data) y el Decreto Reglamentario 1377 de 2013:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
                <li>
                  Los datos personales se recolectan con autorizacion previa,
                  expresa e informada del titular.
                </li>
                <li>
                  Se informa al titular la finalidad especifica del tratamiento y
                  los derechos que le asisten (acceso, rectificacion, cancelacion
                  y oposicion).
                </li>
                <li>
                  Se han implementado politicas de tratamiento de datos y medidas
                  de seguridad tecnicas y administrativas.
                </li>
                <li>
                  Los titulares pueden ejercer sus derechos de Habeas Data mediante
                  solicitud al correo{' '}
                  <a
                    href="mailto:soporte@venxpos.com"
                    className="text-brand-600 hover:underline"
                  >
                    soporte@venxpos.com
                  </a>
                  .
                </li>
              </ul>
              <p className="text-sm text-slate-600 leading-relaxed mt-3">
                El comercio usuario de VenxPOS, en su calidad de Responsable del
                Tratamiento de los datos de sus propios clientes, es el obligado
                a mantener su propio registro de bases de datos ante la
                Superintendencia de Industria y Comercio (SIC) y a atender las
                solicitudes de sus titulares.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                3. Ley 527 de 1999 &mdash; Comercio Electronico
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                La operacion de VenxPOS se enmarca en las disposiciones de la Ley
                527 de 1999, que regula el comercio electronico en Colombia y
                reconoce validez juridica a los mensajes de datos y las firmas
                digitales. En particular:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
                <li>
                  Los contratos de suscripcion celebrados electronicamente a
                  traves de la plataforma tienen plena validez juridica (articulos
                  5 a 10).
                </li>
                <li>
                  Las notificaciones electronicas, facturas y demas comunicaciones
                  enviadas a traves de la plataforma constituyen mensajes de datos
                  validos y vinculantes (articulo 14).
                </li>
                <li>
                  VenxPOS conserva los registros electronicos de las transacciones
                  conforme a los requisitos de integridad y conservacion exigidos
                  por la ley (articulo 12).
                </li>
              </ul>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                4. Resolucion 000042 de 2020 DIAN
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                El modulo de facturacion electronica de VenxPOS se alinea con los
                requisitos de la Resolucion 000042 de 2020 de la DIAN, que
                establece que los sistemas de facturacion deben garantizar la
                generacion, transmision, validacion y entrega de la factura
                electronica con los requisitos tecnicos de autenticidad, integridad
                y disponibilidad. VenxPOS facilita la integracion con proveedores
                de software autorizados por la DIAN para la transmision de
                documentos electronicos, sin perjuicio de que el usuario deba
                realizar su propio proceso de habilitacion y certificacion ante la
                DIAN.
              </p>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                5. Estatuto Tributario Colombiano
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                VenxPOS opera en cumplimiento de las obligaciones tributarias
                previstas en el Estatuto Tributario colombiano (Decreto 624 de
                1989 y sus modificaciones), particularmente en lo relativo a:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
                <li>
                  <span className="font-medium text-slate-700">Articulo 615:</span>{' '}
                  obligacion de expedir factura por todas las operaciones de venta
                  de bienes y prestacion de servicios. VenxPOS emite factura
                  electronica por cada cobro de suscripcion.
                </li>
                <li>
                  <span className="font-medium text-slate-700">Articulo 617:</span>{' '}
                  requisitos de la factura de venta, incluyendo NIT, razon social
                  y discriminacion del IVA cuando corresponda.
                </li>
                <li>
                  <span className="font-medium text-slate-700">Articulo 420:</span>{' '}
                  causacion del IVA sobre la prestacion de servicios en el
                  territorio nacional colombiano.
                </li>
                <li>
                  <span className="font-medium text-slate-700">Articulo 632:</span>{' '}
                  conservacion de copias de facturas y documentos equivalentes por
                  el termino de cinco (5) anos contados a partir de la fecha de
                  su expedicion.
                </li>
              </ul>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                6. Regimen de Responsabilidad
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                VenxPOS actua como proveedor de infraestructura tecnologica SaaS.
                Esto implica el siguiente regimen de responsabilidad:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 leading-relaxed">
                <li>
                  VenxPOS es responsable de la disponibilidad, seguridad y correcto
                  funcionamiento tecnico de la plataforma, dentro de los parametros
                  del plan contratado.
                </li>
                <li>
                  El usuario comercio es el unico responsable de la veracidad de
                  la informacion cargada en la plataforma, del cumplimiento de sus
                  obligaciones fiscales y tributarias, de la correcta configuracion
                  de sus datos ante la DIAN, y del tratamiento de los datos
                  personales de sus propios clientes.
                </li>
                <li>
                  VenxPOS no asume responsabilidad por sanciones, multas o
                  perjuicios derivados de informacion incorrecta, incompleta o
                  desactualizada proporcionada por el usuario, ni por el uso
                  indebido de la plataforma.
                </li>
              </ul>
            </section>

            <section className="py-5 border-t border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-3">
                7. Contacto
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Para consultas sobre cumplimiento normativo, requisitos legales o
                cualquier aspecto regulatorio relacionado con el Servicio:{' '}
                <a
                  href="mailto:soporte@venxpos.com"
                  className="text-brand-600 hover:underline"
                >
                  soporte@venxpos.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
