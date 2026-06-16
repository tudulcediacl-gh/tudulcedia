/**
 * Google Apps Script para catálogo Tu Dulcedía.
 *
 * Uso recomendado:
 * 1. Crear una Google Sheet.
 * 2. Abrir Extensiones > Apps Script.
 * 3. Pegar este código en Code.gs.
 * 4. Ejecutar inicializarHojaPedidos una vez.
 * 5. Desplegar como Web App.
 */

const CONFIG = {
  NOMBRE_HOJA: "Pedidos",
  ESTADO_INICIAL: "Pendiente"
};

const COLUMNAS = [
  "Fecha/hora registro",
  "Nombre cliente",
  "Teléfono",
  "Fecha solicitada",
  "Productos seleccionados",
  "Observación",
  "Total estimado",
  "Estado",
  "Origen",
  "Detalle JSON"
];

function doGet() {
  return responderJson_({
    exito: true,
    mensaje: "Web App activo. Usa POST para registrar pedidos."
  });
}

function doPost(e) {
  try {
    const contenido = e && e.postData && e.postData.contents ? e.postData.contents : "";
    if (!contenido) {
      throw new Error("No se recibió contenido en el POST.");
    }

    const pedido = JSON.parse(contenido);
    validarPedido_(pedido);

    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = obtenerHojaPedidos_(libro);

    const productos = Array.isArray(pedido.productosSeleccionados)
      ? pedido.productosSeleccionados
      : [];

    const productosTexto = productos
      .map(function(producto) {
        const cantidad = Number(producto.cantidad || 1);
        const precio = Number(producto.precio || 0);
        return producto.nombre + " x " + cantidad + " - $" + precio;
      })
      .join(" | ");

    hoja.appendRow([
      new Date(),
      pedido.nombreCliente,
      pedido.telefonoCliente || "",
      pedido.fechaSolicitada,
      productosTexto,
      pedido.observacion || "",
      Number(pedido.totalEstimado || 0),
      CONFIG.ESTADO_INICIAL,
      pedido.origen || "Catálogo web",
      JSON.stringify(pedido)
    ]);

    return responderJson_({
      exito: true,
      mensaje: "Pedido registrado correctamente."
    });
  } catch (error) {
    return responderJson_({
      exito: false,
      mensaje: error.message || "Error desconocido al registrar el pedido."
    });
  }
}

function inicializarHojaPedidos() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = obtenerHojaPedidos_(libro);
  hoja.clear();
  hoja.getRange(1, 1, 1, COLUMNAS.length).setValues([COLUMNAS]);
  hoja.setFrozenRows(1);
  hoja.autoResizeColumns(1, COLUMNAS.length);
}

function obtenerHojaPedidos_(libro) {
  let hoja = libro.getSheetByName(CONFIG.NOMBRE_HOJA);
  if (!hoja) {
    hoja = libro.insertSheet(CONFIG.NOMBRE_HOJA);
  }

  if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, COLUMNAS.length).setValues([COLUMNAS]);
    hoja.setFrozenRows(1);
  }

  return hoja;
}

function validarPedido_(pedido) {
  if (!pedido || typeof pedido !== "object") {
    throw new Error("El pedido recibido no es válido.");
  }

  if (!pedido.nombreCliente || !String(pedido.nombreCliente).trim()) {
    throw new Error("Falta el nombre del cliente.");
  }

  if (!pedido.fechaSolicitada) {
    throw new Error("Falta la fecha solicitada.");
  }

  if (!Array.isArray(pedido.productosSeleccionados) || pedido.productosSeleccionados.length === 0) {
    throw new Error("El pedido no tiene productos seleccionados.");
  }

  if (pedido.totalEstimado === undefined || pedido.totalEstimado === null || isNaN(Number(pedido.totalEstimado))) {
    throw new Error("El total estimado no es válido.");
  }
}

function responderJson_(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}
