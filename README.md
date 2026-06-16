# Tu Dulcedía — MVP catálogo web

Solución mínima viable para tomar pedidos desde un catálogo web compartido manualmente por WhatsApp.

## 1. Arquitectura propuesta

- **Frontend estático:** `index.html` con HTML, CSS y JavaScript vanilla. Se puede alojar gratis en GitHub Pages.
- **Backend liviano:** Google Apps Script desplegado como Web App. Recibe pedidos por `POST`.
- **Base operativa:** Google Sheets con una hoja llamada `Pedidos`.
- **Flujo:** cliente abre el link → selecciona productos → completa datos → revisa resumen → confirma → Apps Script registra el pedido en Sheets.

No se usa API oficial de WhatsApp en esta fase.

## 2. Estructura de Google Sheets

La hoja debe llamarse exactamente:

```text
Pedidos
```

Columnas exactas:

```text
Fecha/hora registro
Nombre cliente
Teléfono
Fecha solicitada
Productos seleccionados
Observación
Total estimado
Estado
Origen
Detalle JSON
```

El script puede crear esta estructura automáticamente ejecutando `inicializarHojaPedidos()`.

## 3. Archivos incluidos

- `index.html`: frontend completo con CSS y JavaScript integrados.
- `google-apps-script.gs`: código completo para Apps Script.
- `.nojekyll`: evita procesamiento Jekyll innecesario en GitHub Pages.

## 4. Reglas de negocio implementadas

- El pan de masa madre requiere **3 días de anticipación**.
- Las galletas requieren **al menos 1 día hábil de anticipación**.
- Si se seleccionan pan y galletas, se aplica la regla más exigente: **3 días**.
- El formulario valida:
  - Nombre obligatorio.
  - Al menos un producto seleccionado.
  - Fecha obligatoria.
  - Fecha mínima según productos seleccionados.
- El formulario muestra el aviso:

> Importante: el pan de masa madre requiere 3 días de anticipación y las galletas al menos 1 día hábil. Esperamos mejorar estos tiempos de respuesta en el corto plazo.

## 5. Productos iniciales

Los productos están en el arreglo editable `productos` dentro de `index.html`.

Cada producto usa esta estructura:

```js
{
  id: "galleta-vainilla-chips",
  nombre: "Galleta de vainilla con chips",
  categoria: "galleta",
  precio: 500,
  descripcion: "Galleta artesanal...",
  anticipacion_dias: 0,
  anticipacion_habil: 1
}
```

El campo `cantidad` queda preparado internamente como `1` para una fase 2.

## 6. Cómo crear la Google Sheet

1. Entra a Google Drive.
2. Crea una nueva hoja de cálculo.
3. Nómbrala, por ejemplo: `Pedidos Tu Dulcedía`.
4. Crea una hoja llamada exactamente `Pedidos`, o deja que el script la cree.
5. Abre `Extensiones > Apps Script`.

## 7. Cómo pegar y desplegar Apps Script

1. En Apps Script, borra el contenido inicial de `Code.gs`.
2. Copia el contenido de `google-apps-script.gs`.
3. Pégalo en `Code.gs`.
4. Guarda el proyecto.
5. En el selector de funciones, elige `inicializarHojaPedidos`.
6. Presiona `Ejecutar`.
7. Acepta los permisos solicitados por Google.
8. Verifica que la hoja `Pedidos` tenga encabezados.

## 8. Cómo desplegar como Web App

1. En Apps Script, haz clic en `Implementar` o `Deploy`.
2. Selecciona `Nueva implementación`.
3. En tipo de implementación, elige `Aplicación web` o `Web app`.
4. Configura:
   - **Ejecutar como:** `Yo`.
   - **Quién tiene acceso:** `Cualquier persona`.
5. Haz clic en `Implementar`.
6. Autoriza los permisos.
7. Copia la URL del Web App que termina en `/exec`.

## 9. Cómo poner la URL en el frontend

En `index.html`, busca:

```js
const URL_WEB_APP = "CONFIGURAR_AQUI_URL_WEB_APP_DE_APPS_SCRIPT";
```

Reemplázalo por tu URL real:

```js
const URL_WEB_APP = "https://script.google.com/macros/s/XXXX/exec";
```

Usa siempre la URL `/exec`, no la `/dev`, para producción.

## 10. Cómo subirlo a GitHub Pages

### Opción A: desde GitHub web

1. Entra al repositorio.
2. Sube `index.html`, `google-apps-script.gs`, `README.md` y `.nojekyll`.
3. Entra a `Settings > Pages`.
4. En `Build and deployment`, selecciona:
   - Source: `Deploy from a branch`.
   - Branch: `main`.
   - Folder: `/root`.
5. Guarda.
6. GitHub mostrará la URL pública del sitio cuando termine la publicación.

### Opción B: desde terminal

```bash
git clone https://github.com/matecheverria/tudulcedia.git
cd tudulcedia
cp /ruta/a/index.html .
cp /ruta/a/google-apps-script.gs .
cp /ruta/a/README.md .
cp /ruta/a/.nojekyll .
git add .
git commit -m "Crear catálogo web inicial"
git push origin main
```

Luego activa GitHub Pages desde `Settings > Pages`.

## 11. Nota sobre CORS y despliegue

El frontend envía el pedido con:

```js
headers: {
  "Content-Type": "text/plain;charset=utf-8"
}
```

Esto evita un `preflight` CORS innecesario, porque `text/plain` es un tipo de contenido simple para el navegador.

Para evitar errores:

- Despliega Apps Script como **Web App**.
- Usa acceso **Cualquier persona**.
- Usa la URL pública `/exec`.
- No uses `/dev` en GitHub Pages.
- Si editas Apps Script después, crea una **nueva versión** o actualiza la implementación.

Si el navegador muestra error de CORS, normalmente se debe a una de estas causas:

- URL incorrecta.
- Web App no desplegado como público.
- Se pegó la URL `/dev`.
- Falta actualizar la implementación tras editar el código.
- El script no tiene permisos aceptados por el dueño.

## 12. Recomendaciones fase 2

- Cantidad editable por producto.
- Subtotal por producto.
- Folio automático de pedido.
- Notificación por correo al negocio.
- Envío de correo de confirmación al cliente.
- Bloqueo visual más avanzado de fechas no válidas.
- Calendario con días cerrados, feriados o cupos máximos.
- Confirmación automática por WhatsApp mediante link prellenado o API oficial en una etapa posterior.
- Exportación a Excel con formato y filtros.
- Dashboard simple de estados: Pendiente, Confirmado, Preparando, Entregado, Cancelado.
- Panel interno protegido para cambiar precios sin editar código.

## 13. Cómo probarlo paso a paso

1. Abre el link público de GitHub Pages desde el celular.
2. Selecciona:
   - `Galleta de vainilla con chips`
   - `Pan de masa madre 1 kg aprox.`
3. Ingresa:
   - Nombre: `Cliente de prueba`
   - Teléfono: `+56 9 1234 5678`
4. Elige una fecha de hoy + 3 días o más.
5. Escribe una observación:
   - `Pedido de prueba desde catálogo web`
6. Presiona `Enviar pedido`.
7. Revisa el resumen.
8. Presiona `Confirmar y enviar pedido`.
9. Debe aparecer un mensaje de éxito.
10. Abre Google Sheets.
11. En la hoja `Pedidos`, debería aparecer una nueva fila con:
    - Fecha/hora de registro.
    - Nombre del cliente.
    - Teléfono.
    - Fecha solicitada.
    - Productos unidos por ` | `.
    - Observación.
    - Total estimado.
    - Estado `Pendiente`.

## 14. Cómo editar productos después

En `index.html`, busca:

```js
const productos = [
```

Puedes cambiar `nombre`, `precio`, `descripcion` o agregar nuevos productos.

No cambies el `id` de productos que ya estás usando en pedidos históricos, salvo que sepas que no lo necesitas para trazabilidad.
