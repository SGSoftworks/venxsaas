# Entrega Técnica — VenxPOS

Documentación técnica del sistema **VenxPOS** (panel SaaS + aplicación de punto de venta), elaborada a partir del código fuente y del esquema de base de datos en vivo.

## Contenido

| # | Documento | Descripción |
|---|---|---|
| 01 | `01_Requerimientos_Sistema.md` | Requerimientos funcionales (RF), no funcionales (RNF), reglas de negocio (RN), actores y alcance. |
| 02 | `02_Stack_Tecnologico.md` | Tecnologías, dependencias y herramientas. |
| 03 | `03_Arquitectura_Sistema.md` | Arquitectura general, capas y despliegue. |
| 04 | `04_Modelo_Entidad_ER.md` | Modelo entidad-relación, inventario de tablas, FKs, CHECKs y trazabilidad MER↔RPC. |
| 05 | `05_BPMN_Proceso_Principal.md` | Proceso principal en BPMN (venta, devolución, cierre de caja). |
| 06 | `06_Modelo_C4.md` | Modelo C4 (contexto, contenedores, componentes, código). |
| 07 | `07_Matriz_Trazabilidad.md` / `.xlsx` | Matriz de trazabilidad Necesidad→Requerimiento→Regla→Proceso→Arquitectura→Datos→Código→Prueba. |
| 08 | `08_Plan_y_Casos_de_Prueba.md` | Estrategia y casos de prueba (CP-001…CP-030). |
| 09 | `09_Informe_Auditoria_y_Brechas.md` | Hallazgos de auditoría, severidad y brechas/limitaciones. |

## Diagramas

Fuentes editables (texto):

```
diagramas/
  arquitectura/   arquitectura_general.mmd, arquitectura_capas.mmd, despliegue.mmd
  secuencias/     seq_venta_pos.mmd, seq_login_suscripcion.mmd, seq_devolucion.mmd, seq_aprobacion_tenant.mmd
  mer/            MER_Central.mmd
  bpmn/           BPMN_Venta_POS.bpmn   (XML BPMN 2.0)
  c4/             C4_Contexto.puml, C4_Contenedores.puml, C4_Componentes.puml, C4_Codigo.puml
```

- **Mermaid** (`.mmd`): render con Mermaid CLI o en https://mermaid.live.
- **PlantUML** (`.puml`): render con PlantUML (incluyen C4-PlantUML).
- **BPMN** (`.bpmn`): abrir en bpmn.io / Camunda Modeler.

## Evidencias

Ver `evidencias/README.md`.

## Notas

- Documento técnico sin formato APA; las referencias APA se reservan para `documentacion_metodologica.txt`.
- Los entregables de esta carpeta no modifican el código del sistema.
