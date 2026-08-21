# Manual de POS — Cajero

Sistema de Punto de Venta para registrar ventas y administrar el dia a dia del negocio.

## Acceso

El Sistema POS es una aplicacion independiente. Accede desde:
1. El enlace "Sistema POS" en el panel administrativo VenxPOS
2. O directamente desde la URL del POS (proporcionada por la gerencia)
3. Inicia sesion con tu usuario y contrasena de cajero

## Funciones Principales

### Registrar una Venta
1. Selecciona los productos desde el catalogo
2. Escanea codigos de barras con lector o camara
3. Ingresa las cantidades
4. Selecciona metodo de pago (Efectivo, Tarjeta, Billetera, Mixto)
5. Confirma la venta → se genera el ticket
6. El inventario se descuenta automaticamente

### Administrar Caja
- Apertura de caja al iniciar turno
- Registrar ingresos/egresos durante el turno
- Cierre de caja al finalizar (comparacion sistema vs fisico)

### Consultar Inventario
- Ver stock actual de productos
- Identificar productos con stock bajo
- Buscar productos por nombre o codigo de barras

### Productos
- Ver detalle del producto (precio, stock, categoria)
- No puedes crear/modificar productos (solo lectura)

## Solucion de Problemas

### "Stock insuficiente"
El producto no tiene suficiente inventario. Verifica el stock actual o contacta al administrador.

### Error de conexion
El POS necesita conexion a internet. Si pierdes conexion, los datos se guardan localmente y se sincronizan al reconectar.

### Ticket no se imprime
Verifica que la impresora termica este encendida y conectada. Puedes reimprimir el ultimo ticket desde el historial.

## Soporte

Contacta a la gerencia del negocio para:
- Problemas con tu usuario/contrasena
- Reportar errores en el sistema
- Solicitar nuevos productos en el catalogo
