/**
 * Backend Google Apps Script para Tu Dulcedía.
 *
 * Funciones principales:
 * - Recibe pedidos desde GitHub Pages.
 * - Guarda pedidos en Google Sheets.
 * - Envía alerta por correo.
 * - Expone endpoints admin para listar pedidos y actualizar estado / estado de pago.
 * - Registra fechas automáticas e historial de cambios.
 *
 * Seguridad admin:
 * - No hardcodear la clave en el código.
 * - Configurar ADMIN_TOKEN en Propiedades de secuencia de comandos.
 */

const CONFIG = {
  SPREADSHEET_ID: "1rePCmh_N_XT964-BD3BeHJfkh8YhueOD_EDVif-SGGw",
  NOMBRE_HOJA: "Pedidos",
  NOMBRE_HOJA_HISTORIAL: "Historial pedidos",
  ESTADO_INICIAL: "Pendiente",
  EMAIL_ALERTA: "mat.echeverria@gmail.com",
  WHATSAPP_COMPROBANTE: "+56 9 5422 6146"
};

const COLUMNAS = [
  "Folio pedido",
  "Estado",
  "Estado de pago",
  "Estado operativo",
  "Teléfono",
  "Nombre cliente",
  "Fecha solicitada",
  "Productos seleccionados",
  "Total estimado",
  "Método de pago",
  "Requiere datos transferencia",
  "Tipo entrega",
  "Observación",
  "Observación interna",
  "Fecha/hora registro",
  "Fecha confirmado",
  "Fecha pagado",
  "Fecha entregado",
  "Origen",
  "Indicación de pago",
  "Detalle JSON"
];

const COLUMNAS_HISTORIAL = [
  "Fecha/hora cambio",
  "Folio pedido",
  "Campo",
  "Valor anterior",
  "Valor nuevo",
  "Origen",
  "Observación interna"
];

const ESTADOS_PEDIDO = [
  "Pendiente",
  "Confirmado",
  "En preparación",
  "Listo para retiro/entrega",
  "Entregado",
  "Cancelado"
];

const ESTADOS_PAGO = [
  "Pendiente de comprobante",
  "Comprobante recibido",
  "Pagado",
  "Pago al retirar"
];

function doGet(e) {
  const parametros = e && e.parameter ? e.parameter : {};
  const action = parametros.action || "";

  try {
    if (action === "adminListarPedidos") {
      validarAdmin_(parametros.token);
      return responderJsonp_(adminListarPedidos_(), parametros.callback);
    }

    if (action === "adminActualizarPedido") {
      validarAdmin_(parametros.token);
      return responderJsonp_(adminActualizarPedido_(parametros), parametros.callback);
    }

    return responderJsonp_({
      exito: true,
      mensaje: "Web App activo. Usa POST para registrar pedidos."
    }, parametros.callback);

  } catch (error) {
    return responderJsonp_({
      exito: false,
      mensaje: error.message || "Error desconocido."
    }, parametros.callback);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const contenido = e && e.postData && e.postData.contents
      ? e.postData.contents
      : "";

    if (!contenido) {
      throw new Error("No se recibió contenido en el POST.");
    }

    const pedido = JSON.parse(contenido);
    validarPedido_(pedido);

    const libro = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const hoja = obtenerHojaPedidos_(libro);
    const filaPedido = hoja.getLastRow() + 1;
    const folioPedido = generarFolio_(filaPedido);

    const productos = Array.isArray(pedido.productosSeleccionados)
      ? pedido.productosSeleccionados
      : [];

    const productosTexto = productos
      .map(function(producto) {
        const nombre = producto.nombre || "Producto sin nombre";
        const cantidad = Number(producto.cantidad || 1);
        const precio = Number(producto.precio || 0);
        const subtotal = Number(producto.subtotal || precio * cantidad);

        return nombre +
          " x " + cantidad +
          " - Unitario $" + precio +
          " - Subtotal $" + subtotal;
      })
      .join(" | ");

    const metodoPago = pedido.metodoPago || "Transferencia bancaria";
    const requiereDatosTransferencia = pedido.requiereDatosTransferencia === true || metodoPago === "Transferencia bancaria";
    const estadoPago = pedido.estadoPago || (metodoPago === "Transferencia bancaria" ? "Pendiente de comprobante" : "Pago al retirar");
    const estadoPedido = CONFIG.ESTADO_INICIAL;
    const estadoOperativo = calcularEstadoOperativo_(estadoPedido, estadoPago);
    const indicacionPago = pedido.indicacionPago || (metodoPago === "Transferencia bancaria"
      ? "Enviar datos de transferencia por WhatsApp después de confirmar disponibilidad y solicitar comprobante al " + CONFIG.WHATSAPP_COMPROBANTE + "."
      : "Cliente pagará al retirar o recibir el pedido.");

    const tipoEntrega = pedido.notaEntrega || (pedido.entregaSeparada
      ? "Cliente solicita entrega separada."
      : "Pedido con entrega única.");

    const detallePedido = Object.assign({}, pedido, {
      folioPedido: folioPedido,
      metodoPago: metodoPago,
      estadoPago: estadoPago,
      estado: estadoPedido,
      estadoOperativo: estadoOperativo,
      requiereDatosTransferencia: requiereDatosTransferencia,
      indicacionPago: indicacionPago,
      tipoEntrega: tipoEntrega
    });

    escribirFilaPorEncabezado_(hoja, {
      "Folio pedido": folioPedido,
      "Estado": estadoPedido,
      "Estado de pago": estadoPago,
      "Estado operativo": estadoOperativo,
      "Teléfono": pedido.telefonoCliente || "",
      "Nombre cliente": pedido.nombreCliente,
      "Fecha solicitada": pedido.fechaSolicitada,
      "Productos seleccionados": productosTexto,
      "Total estimado": Number(pedido.totalEstimado || 0),
      "Método de pago": metodoPago,
      "Requiere datos transferencia": requiereDatosTransferencia ? "Sí" : "No",
      "Tipo entrega": tipoEntrega,
      "Observación": pedido.observacion || "",
      "Observación interna": "",
      "Fecha/hora registro": new Date(),
      "Fecha confirmado": "",
      "Fecha pagado": "",
      "Fecha entregado": "",
      "Origen": pedido.origen || "Catálogo web",
      "Indicación de pago": indicacionPago,
      "Detalle JSON": JSON.stringify(detallePedido)
    });

    try {
      enviarAlertaPedido_(detallePedido, productosTexto, filaPedido);
    } catch (errorAlerta) {
      console.error("El pedido se guardó, pero falló la alerta por correo: " + errorAlerta.message);
    }

    return responderJson_({
      exito: true,
      mensaje: "Pedido registrado correctamente.",
      folio: folioPedido,
      fila: filaPedido
    });

  } catch (error) {
    return responderJson_({
      exito: false,
      mensaje: error.message || "Error desconocido al registrar el pedido."
    });

  } finally {
    try {
      lock.releaseLock();
    } catch (errorLock) {
      // Sin acción.
    }
  }
}

function migrarHojaPedidos() {
  const libro = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const hoja = obtenerHojaPedidos_(libro);
  obtenerHojaHistorial_(libro);
  hoja.setFrozenRows(1);
  hoja.setFrozenColumns(1);
  hoja.autoResizeColumns(1, hoja.getLastColumn());
  return "Hoja migrada correctamente. Se aseguraron columnas de fechas, observación interna e historial.";
}

function probarEnvioCorreo() {
  MailApp.sendEmail({
    to: CONFIG.EMAIL_ALERTA,
    subject: "Prueba alerta Tu Dulcedía",
    body: "Si recibes este correo, MailApp está autorizado correctamente para enviar alertas de pedidos.",
    name: "Tu Dulcedía Pedidos"
  });

  return "Correo de prueba enviado a " + CONFIG.EMAIL_ALERTA;
}

function configurarAdminTokenTemporal() {
  const token = "CAMBIA_ESTA_CLAVE_PRIVADA";

  if (token === "CAMBIA_ESTA_CLAVE_PRIVADA") {
    throw new Error("Edita la variable token antes de ejecutar esta función.");
  }

  PropertiesService.getScriptProperties().setProperty("ADMIN_TOKEN", token);
  return "ADMIN_TOKEN configurado correctamente.";
}

function probarRegistroManual() {
  const pedidoPrueba = {
    nombreCliente: "Cliente prueba Apps Script",
    telefonoCliente: "+56 9 0000 0000",
    fechaSolicitada: "2026-06-20",
    productosSeleccionados: [
      {
        id: "galleta-vainilla-chips",
        nombre: "Galleta de vainilla con chips",
        categoria: "galleta",
        precio: 500,
        cantidad: 6,
        subtotal: 3000
      },
      {
        id: "pan-masa-madre-1kg",
        nombre: "Pan de masa madre 1 kg aprox.",
        categoria: "pan",
        precio: 4000,
        cantidad: 1,
        subtotal: 4000
      }
    ],
    observacion: "Pedido de prueba creado desde Apps Script",
    totalEstimado: 7000,
    metodoPago: "Transferencia bancaria",
    estadoPago: "Pendiente de comprobante",
    requiereDatosTransferencia: true,
    indicacionPago: "Enviar datos de transferencia por WhatsApp después de confirmar disponibilidad y solicitar comprobante al +56 9 5422 6146.",
    estado: "Pendiente",
    entregaSeparada: false,
    notaEntrega: "Pedido conjunto: entregar galletas junto con el pan.",
    origen: "Prueba manual Apps Script"
  };

  return doPost({
    postData: {
      contents: JSON.stringify(pedidoPrueba)
    }
  });
}

function adminListarPedidos_() {
  const libro = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const hoja = obtenerHojaPedidos_(libro);
  const ultimaFila = hoja.getLastRow();
  const ultimaColumna = hoja.getLastColumn();

  if (ultimaFila < 2) {
    return {
      exito: true,
      pedidos: []
    };
  }

  const encabezados = hoja
    .getRange(1, 1, 1, ultimaColumna)
    .getValues()[0]
    .map(function(valor) {
      return String(valor || "").trim();
    });

  const valores = hoja
    .getRange(2, 1, ultimaFila - 1, ultimaColumna)
    .getValues();

  const indice = {};
  encabezados.forEach(function(nombre, i) {
    if (nombre) indice[nombre] = i;
  });

  const pedidos = valores.map(function(fila) {
    const estado = obtenerValorFila_(fila, indice, "Estado") || "Pendiente";
    const estadoPago = obtenerValorFila_(fila, indice, "Estado de pago") || "";
    const estadoOperativoGuardado = obtenerValorFila_(fila, indice, "Estado operativo");

    return {
      folioPedido: obtenerValorFila_(fila, indice, "Folio pedido"),
      fechaRegistro: formatearValor_(obtenerValorFila_(fila, indice, "Fecha/hora registro")),
      nombreCliente: obtenerValorFila_(fila, indice, "Nombre cliente"),
      telefonoCliente: obtenerValorFila_(fila, indice, "Teléfono"),
      fechaSolicitada: formatearValor_(obtenerValorFila_(fila, indice, "Fecha solicitada")),
      productosTexto: obtenerValorFila_(fila, indice, "Productos seleccionados"),
      observacion: obtenerValorFila_(fila, indice, "Observación"),
      observacionInterna: obtenerValorFila_(fila, indice, "Observación interna"),
      totalEstimado: obtenerValorFila_(fila, indice, "Total estimado"),
      metodoPago: obtenerValorFila_(fila, indice, "Método de pago"),
      estadoPago: estadoPago,
      estadoOperativo: estadoOperativoGuardado || calcularEstadoOperativo_(estado, estadoPago),
      requiereDatosTransferencia: obtenerValorFila_(fila, indice, "Requiere datos transferencia"),
      indicacionPago: obtenerValorFila_(fila, indice, "Indicación de pago"),
      estado: estado,
      tipoEntrega: obtenerValorFila_(fila, indice, "Tipo entrega"),
      fechaConfirmado: formatearValor_(obtenerValorFila_(fila, indice, "Fecha confirmado")),
      fechaPagado: formatearValor_(obtenerValorFila_(fila, indice, "Fecha pagado")),
      fechaEntregado: formatearValor_(obtenerValorFila_(fila, indice, "Fecha entregado")),
      origen: obtenerValorFila_(fila, indice, "Origen")
    };
  });

  pedidos.reverse();

  return {
    exito: true,
    pedidos: pedidos.slice(0, 150)
  };
}

function adminActualizarPedido_(parametros) {
  const folio = String(parametros.folio || "").trim();
  const nuevoEstado = String(parametros.estado || "").trim();
  const nuevoEstadoPago = String(parametros.estadoPago || "").trim();
  const observacionInterna = parametros.observacionInterna !== undefined
    ? String(parametros.observacionInterna || "").trim()
    : null;

  if (!folio) {
    throw new Error("Falta el folio del pedido.");
  }

  if (nuevoEstado && ESTADOS_PEDIDO.indexOf(nuevoEstado) === -1) {
    throw new Error("Estado de pedido no válido.");
  }

  if (nuevoEstadoPago && ESTADOS_PAGO.indexOf(nuevoEstadoPago) === -1) {
    throw new Error("Estado de pago no válido.");
  }

  const libro = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const hoja = obtenerHojaPedidos_(libro);
  const historial = obtenerHojaHistorial_(libro);
  const filaObjetivo = buscarFilaPorFolio_(hoja, folio);

  if (!filaObjetivo) {
    throw new Error("No se encontró el pedido " + folio + ".");
  }

  const mapa = obtenerMapaEncabezados_(hoja);
  const ahora = new Date();
  const estadoAnterior = obtenerCeldaPorMapa_(hoja, filaObjetivo, mapa, "Estado");
  const estadoPagoAnterior = obtenerCeldaPorMapa_(hoja, filaObjetivo, mapa, "Estado de pago");
  const observacionAnterior = obtenerCeldaPorMapa_(hoja, filaObjetivo, mapa, "Observación interna");
  const estadoFinal = nuevoEstado || estadoAnterior || "Pendiente";
  const estadoPagoFinal = nuevoEstadoPago || estadoPagoAnterior || "";
  const estadoOperativoFinal = calcularEstadoOperativo_(estadoFinal, estadoPagoFinal);
  const cambios = [];

  if (nuevoEstado && nuevoEstado !== estadoAnterior) {
    setCeldaPorMapa_(hoja, filaObjetivo, mapa, "Estado", nuevoEstado);
    cambios.push([ahora, folio, "Estado", estadoAnterior, nuevoEstado, "Admin dashboard", observacionInterna || ""]);
  }

  if (nuevoEstadoPago && nuevoEstadoPago !== estadoPagoAnterior) {
    setCeldaPorMapa_(hoja, filaObjetivo, mapa, "Estado de pago", nuevoEstadoPago);
    cambios.push([ahora, folio, "Estado de pago", estadoPagoAnterior, nuevoEstadoPago, "Admin dashboard", observacionInterna || ""]);
  }

  setCeldaPorMapa_(hoja, filaObjetivo, mapa, "Estado operativo", estadoOperativoFinal);

  if (observacionInterna !== null && observacionInterna !== observacionAnterior) {
    setCeldaPorMapa_(hoja, filaObjetivo, mapa, "Observación interna", observacionInterna);
    cambios.push([ahora, folio, "Observación interna", observacionAnterior, observacionInterna, "Admin dashboard", observacionInterna || ""]);
  }

  if (estadoFinal !== "Pendiente") {
    setFechaSiVacia_(hoja, filaObjetivo, mapa, "Fecha confirmado", ahora);
  }

  if (estadoPagoFinal === "Pagado") {
    setFechaSiVacia_(hoja, filaObjetivo, mapa, "Fecha pagado", ahora);
  }

  if (estadoFinal === "Entregado") {
    setFechaSiVacia_(hoja, filaObjetivo, mapa, "Fecha entregado", ahora);
  }

  if (cambios.length > 0) {
    historial.getRange(historial.getLastRow() + 1, 1, cambios.length, COLUMNAS_HISTORIAL.length).setValues(cambios);
  }

  return {
    exito: true,
    mensaje: "Pedido actualizado correctamente.",
    folio: folio,
    estado: estadoFinal,
    estadoPago: estadoPagoFinal,
    estadoOperativo: estadoOperativoFinal
  };
}

function validarAdmin_(token) {
  const tokenConfigurado = PropertiesService.getScriptProperties().getProperty("ADMIN_TOKEN");

  if (!tokenConfigurado) {
    throw new Error("Falta configurar ADMIN_TOKEN en Propiedades de secuencia de comandos.");
  }

  if (!token || token !== tokenConfigurado) {
    throw new Error("Clave admin inválida.");
  }
}

function obtenerHojaPedidos_(libro) {
  let hoja = libro.getSheetByName(CONFIG.NOMBRE_HOJA);

  if (!hoja) {
    hoja = libro.insertSheet(CONFIG.NOMBRE_HOJA);
  }

  asegurarColumnas_(hoja, COLUMNAS);
  return hoja;
}

function obtenerHojaHistorial_(libro) {
  let hoja = libro.getSheetByName(CONFIG.NOMBRE_HOJA_HISTORIAL);

  if (!hoja) {
    hoja = libro.insertSheet(CONFIG.NOMBRE_HOJA_HISTORIAL);
  }

  asegurarColumnas_(hoja, COLUMNAS_HISTORIAL);
  hoja.setFrozenRows(1);
  return hoja;
}

function asegurarColumnas_(hoja, columnasDeseadas) {
  if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, columnasDeseadas.length).setValues([columnasDeseadas]);
    hoja.setFrozenRows(1);
    return;
  }

  const ultimaColumna = Math.max(hoja.getLastColumn(), 1);

  const encabezadosActuales = hoja
    .getRange(1, 1, 1, ultimaColumna)
    .getValues()[0]
    .map(function(valor) {
      return String(valor || "").trim();
    });

  const faltantes = columnasDeseadas.filter(function(columna) {
    return encabezadosActuales.indexOf(columna) === -1;
  });

  if (faltantes.length > 0) {
    const inicio = hoja.getLastColumn() + 1;
    hoja.getRange(1, inicio, 1, faltantes.length).setValues([faltantes]);
  }

  hoja.setFrozenRows(1);
}

function obtenerMapaEncabezados_(hoja) {
  asegurarColumnas_(hoja, COLUMNAS);

  const encabezados = hoja
    .getRange(1, 1, 1, hoja.getLastColumn())
    .getValues()[0];

  const mapa = {};

  encabezados.forEach(function(nombre, indice) {
    const clave = String(nombre || "").trim();
    if (clave) {
      mapa[clave] = indice + 1;
    }
  });

  return mapa;
}

function escribirFilaPorEncabezado_(hoja, datos) {
  const mapa = obtenerMapaEncabezados_(hoja);
  const fila = hoja.getLastRow() + 1;
  const valores = new Array(hoja.getLastColumn()).fill("");

  Object.keys(datos).forEach(function(nombreColumna) {
    const columna = mapa[nombreColumna];
    if (columna) {
      valores[columna - 1] = datos[nombreColumna];
    }
  });

  hoja.getRange(fila, 1, 1, valores.length).setValues([valores]);
}

function buscarFilaPorFolio_(hoja, folio) {
  const mapa = obtenerMapaEncabezados_(hoja);
  const colFolio = mapa["Folio pedido"];
  const ultimaFila = hoja.getLastRow();

  if (!colFolio || ultimaFila < 2) return 0;

  const folios = hoja
    .getRange(2, colFolio, ultimaFila - 1, 1)
    .getValues();

  for (let i = 0; i < folios.length; i++) {
    if (String(folios[i][0]).trim() === folio) {
      return i + 2;
    }
  }

  return 0;
}

function obtenerCeldaPorMapa_(hoja, fila, mapa, columna) {
  const col = mapa[columna];
  if (!col) return "";
  return hoja.getRange(fila, col).getValue();
}

function setCeldaPorMapa_(hoja, fila, mapa, columna, valor) {
  const col = mapa[columna];
  if (!col) return;
  hoja.getRange(fila, col).setValue(valor);
}

function setFechaSiVacia_(hoja, fila, mapa, columna, fecha) {
  const col = mapa[columna];
  if (!col) return;
  const actual = hoja.getRange(fila, col).getValue();
  if (!actual) {
    hoja.getRange(fila, col).setValue(fecha);
  }
}

function calcularEstadoOperativo_(estado, estadoPago) {
  if (estado === "Cancelado") return "Cancelado";
  if (estado === "Entregado" && estadoPago === "Pagado") return "Entregado y pagado";
  if (estado === "Entregado" && estadoPago === "Pago al retirar") return "Entregado con pago al retirar";
  if (estadoPago === "Pagado" && estado !== "Entregado") return "Pagado pendiente entrega";
  if (estado === "Listo para retiro/entrega") return "Listo para entregar";
  if (estado === "En preparación") return "En preparación";
  if (estadoPago === "Pendiente de comprobante") return "Pendiente de pago";
  return "Pendiente de confirmación";
}

function enviarAlertaPedido_(pedido, productosTexto, filaPedido) {
  if (!CONFIG.EMAIL_ALERTA) return;

  const urlSheet = "https://docs.google.com/spreadsheets/d/" + CONFIG.SPREADSHEET_ID + "/edit";
  const total = Number(pedido.totalEstimado || 0).toLocaleString("es-CL");
  const etiquetaPago = pedido.metodoPago === "Transferencia bancaria" ? "[TRANSFERENCIA]" : "[PAGO AL RETIRAR]";
  const asunto = etiquetaPago + " Nuevo pedido " + pedido.folioPedido + " - Tu Dulcedía";
  const accionPago = pedido.metodoPago === "Transferencia bancaria"
    ? "Enviar datos de transferencia por WhatsApp después de confirmar disponibilidad y esperar comprobante."
    : "Confirmar pedido y coordinar pago al retirar o recibir.";

  const mensajeWhatsapp =
    "Hola " + pedido.nombreCliente + ", recibimos tu pedido " + pedido.folioPedido +
    ". Total estimado: $" + total +
    ". Método de pago: " + pedido.metodoPago +
    ". Te confirmaremos disponibilidad durante el día. Muchas gracias.";

  const telefonoWhatsapp = normalizarTelefonoWhatsapp_(pedido.telefonoCliente);
  const linkWhatsapp = telefonoWhatsapp
    ? "https://wa.me/" + telefonoWhatsapp + "?text=" + encodeURIComponent(mensajeWhatsapp)
    : "";

  const cuerpoTexto =
    etiquetaPago + " Nuevo pedido recibido en Tu Dulcedía\n\n" +
    "Folio: " + pedido.folioPedido + "\n" +
    "Cliente: " + pedido.nombreCliente + "\n" +
    "Teléfono: " + (pedido.telefonoCliente || "No indicado") + "\n" +
    "Fecha solicitada: " + pedido.fechaSolicitada + "\n" +
    "Productos: " + productosTexto + "\n" +
    "Observación: " + (pedido.observacion || "Sin observación") + "\n" +
    "Total estimado: $" + total + "\n" +
    "Método de pago: " + pedido.metodoPago + "\n" +
    "Estado de pago: " + pedido.estadoPago + "\n" +
    "Estado operativo: " + pedido.estadoOperativo + "\n" +
    "Requiere datos transferencia: " + (pedido.requiereDatosTransferencia ? "Sí" : "No") + "\n" +
    "Indicación de pago: " + pedido.indicacionPago + "\n" +
    "Acción sugerida: " + accionPago + "\n" +
    "Tipo entrega: " + pedido.tipoEntrega + "\n" +
    "Estado pedido: Pendiente\n" +
    "Fila en Google Sheets: " + filaPedido + "\n\n" +
    "Ver pedidos:\n" + urlSheet + "\n\n" +
    (linkWhatsapp ? "Responder por WhatsApp:\n" + linkWhatsapp : "No se generó link de WhatsApp porque no hay teléfono válido.");

  const cuerpoHtml =
    "<h2>" + escaparHtml_(etiquetaPago) + " Nuevo pedido recibido</h2>" +
    "<p><strong>Folio:</strong> " + escaparHtml_(pedido.folioPedido) + "</p>" +
    "<p><strong>Cliente:</strong> " + escaparHtml_(pedido.nombreCliente) + "</p>" +
    "<p><strong>Teléfono:</strong> " + escaparHtml_(pedido.telefonoCliente || "No indicado") + "</p>" +
    "<p><strong>Fecha solicitada:</strong> " + escaparHtml_(pedido.fechaSolicitada) + "</p>" +
    "<p><strong>Productos:</strong> " + escaparHtml_(productosTexto) + "</p>" +
    "<p><strong>Observación:</strong> " + escaparHtml_(pedido.observacion || "Sin observación") + "</p>" +
    "<p><strong>Total estimado:</strong> $" + total + "</p>" +
    "<p><strong>Método de pago:</strong> " + escaparHtml_(pedido.metodoPago) + "</p>" +
    "<p><strong>Estado de pago:</strong> " + escaparHtml_(pedido.estadoPago) + "</p>" +
    "<p><strong>Estado operativo:</strong> " + escaparHtml_(pedido.estadoOperativo) + "</p>" +
    "<p><strong>Requiere datos transferencia:</strong> " + (pedido.requiereDatosTransferencia ? "Sí" : "No") + "</p>" +
    "<p><strong>Indicación de pago:</strong> " + escaparHtml_(pedido.indicacionPago) + "</p>" +
    "<p><strong>Acción sugerida:</strong> " + escaparHtml_(accionPago) + "</p>" +
    "<p><strong>Tipo entrega:</strong> " + escaparHtml_(pedido.tipoEntrega) + "</p>" +
    "<p><strong>Estado pedido:</strong> Pendiente</p>" +
    "<p><strong>Fila en Google Sheets:</strong> " + filaPedido + "</p>" +
    "<p><a href='" + urlSheet + "'>Abrir Google Sheets</a></p>" +
    (linkWhatsapp ? "<p><a href='" + linkWhatsapp + "'>Responder por WhatsApp</a></p>" : "");

  MailApp.sendEmail({
    to: CONFIG.EMAIL_ALERTA,
    subject: asunto,
    body: cuerpoTexto,
    htmlBody: cuerpoHtml,
    name: "Tu Dulcedía Pedidos"
  });
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

function generarFolio_(filaPedido) {
  const numero = Math.max(1, filaPedido - 1);
  return "TD-" + String(numero).padStart(4, "0");
}

function normalizarTelefonoWhatsapp_(telefono) {
  if (!telefono) return "";

  let limpio = String(telefono).replace(/\D/g, "");

  if (!limpio) return "";

  if (limpio.startsWith("56")) return limpio;

  if (limpio.startsWith("9") && limpio.length === 9) return "56" + limpio;

  if (limpio.startsWith("0")) limpio = limpio.replace(/^0+/, "");

  if (limpio.length >= 8 && limpio.length <= 9) return "56" + limpio;

  return limpio;
}

function obtenerValorFila_(fila, indice, columna) {
  const posicion = indice[columna];

  if (posicion === undefined) return "";

  return fila[posicion];
}

function formatearValor_(valor) {
  if (Object.prototype.toString.call(valor) === "[object Date]") {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
  }

  return valor || "";
}

function escaparHtml_(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function responderJson_(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

function responderJsonp_(objeto, callback) {
  const json = JSON.stringify(objeto);

  if (callback) {
    return ContentService
      .createTextOutput(String(callback) + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return responderJson_(objeto);
}
