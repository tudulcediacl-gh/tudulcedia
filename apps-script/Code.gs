/** Backend Google Apps Script para Tu Dulcedía. */

const CONFIG = {
  SPREADSHEET_ID: "1rePCmh_N_XT964-BD3BeHJfkh8YhueOD_EDVif-SGGw",
  NOMBRE_HOJA: "Pedidos",
  NOMBRE_HOJA_HISTORIAL: "Historial pedidos",
  ESTADO_INICIAL: "Pendiente",
  EMAIL_ALERTA: "tudulcediacl@gmail.com",
  WHATSAPP_COMPROBANTE: "+56 9 7849 6366",
  MINUTOS_ANTI_DUPLICADO: 15
};

const COLUMNAS = [
  "Folio pedido","Estado","Estado de pago","Estado operativo","Teléfono","Nombre cliente","Fecha solicitada",
  "Productos seleccionados","Total estimado","Método de pago","Requiere datos transferencia","Tipo entrega",
  "Observación","Observación interna","Fecha/hora registro","Fecha confirmado","Fecha pagado","Fecha entregado",
  "Origen","Indicación de pago","Detalle JSON"
];
const COLUMNAS_HISTORIAL = ["Fecha/hora cambio","Folio pedido","Campo","Valor anterior","Valor nuevo","Origen","Observación interna"];
const ESTADOS_PEDIDO = ["Pendiente","Confirmado","En preparación","Listo para retiro/entrega","Entregado","Cancelado"];
const ESTADOS_PAGO = ["Pendiente de comprobante","Comprobante recibido","Pagado","Pago al retirar"];

function doGet(e) {
  const p = e && e.parameter ? e.parameter : {};
  const action = p.action || "";
  try {
    if (action === "catalogoPublico") return responderJsonp_(obtenerCatalogoPublico_(), p.callback);
    if (action === "adminListarPedidos") { validarAdmin_(p.token); return responderJsonp_(adminListarPedidos_(), p.callback); }
    if (action === "adminActualizarPedido") { validarAdmin_(p.token); return responderJsonp_(adminActualizarPedido_(p), p.callback); }
    if (action === "adminListarCatalogo") { validarAdmin_(p.token); return responderJsonp_(adminListarCatalogo_(), p.callback); }
    if (action === "adminGuardarProducto") { validarAdmin_(p.token); return responderJsonp_(adminGuardarProducto_(p), p.callback); }
    if (action === "adminGuardarDisponibilidad") { validarAdmin_(p.token); return responderJsonp_(adminGuardarDisponibilidad_(p), p.callback); }
    return responderJsonp_({exito:true,mensaje:"Web App activo."}, p.callback);
  } catch (error) {
    return responderJsonp_({exito:false,mensaje:error.message || "Error desconocido."}, p.callback);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const contenido = e && e.postData && e.postData.contents ? e.postData.contents : "";
    if (!contenido) throw new Error("No se recibió contenido en el POST.");

    const pedido = JSON.parse(contenido);
    validarPedido_(pedido);

    const libro = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const hoja = obtenerHojaPedidos_(libro);
    const catalogo = obtenerMapaProductosCatalogo_();
    const productos = normalizarProductosPedido_(pedido.productosSeleccionados, catalogo);
    const totalCalculado = productos.reduce(function(total, producto) { return total + producto.subtotal; }, 0);
    const metodoPago = pedido.metodoPago || "Transferencia bancaria";
    const requiereDatosTransferencia = pedido.requiereDatosTransferencia === true || metodoPago === "Transferencia bancaria";
    const estadoPago = pedido.estadoPago || (metodoPago === "Transferencia bancaria" ? "Pendiente de comprobante" : "Pago al retirar");
    const estadoPedido = CONFIG.ESTADO_INICIAL;
    const estadoOperativo = calcularEstadoOperativo_(estadoPedido, estadoPago);
    const indicacionPago = pedido.indicacionPago || (metodoPago === "Transferencia bancaria" ? "Enviar datos de transferencia por WhatsApp después de confirmar disponibilidad y solicitar comprobante al " + CONFIG.WHATSAPP_COMPROBANTE + "." : "Cliente pagará al retirar o recibir el pedido.");
    const tipoEntrega = pedido.notaEntrega || pedido.tipoEntrega || (pedido.entregaSeparada ? "Cliente solicita entrega separada: galletas antes y pan cuando esté listo. Coordinar manualmente." : "Pedido con entrega única.");
    const firmaPedido = generarFirmaPedido_(pedido, productos, totalCalculado, metodoPago, tipoEntrega);
    const duplicado = buscarPedidoDuplicadoReciente_(hoja, firmaPedido, CONFIG.MINUTOS_ANTI_DUPLICADO);

    if (duplicado) {
      return responderJson_({
        exito: true,
        duplicado: true,
        mensaje: "Pedido duplicado reciente detectado. No se creó un nuevo registro.",
        folio: duplicado.folio,
        fila: duplicado.fila
      });
    }

    const filaPedido = hoja.getLastRow() + 1;
    const folioPedido = generarFolio_(filaPedido);
    const productosTexto = productos.map(function(producto) {
      return producto.nombre + " x " + producto.cantidad + " - Unitario $" + producto.precio + " - Subtotal $" + producto.subtotal;
    }).join(" | ");

    const detallePedido = Object.assign({}, pedido, {
      folioPedido: folioPedido,
      productosSeleccionados: productos,
      totalEstimado: totalCalculado,
      metodoPago: metodoPago,
      estadoPago: estadoPago,
      estado: estadoPedido,
      estadoOperativo: estadoOperativo,
      requiereDatosTransferencia: requiereDatosTransferencia,
      indicacionPago: indicacionPago,
      tipoEntrega: tipoEntrega,
      notaEntrega: tipoEntrega,
      firmaPedido: firmaPedido
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
      "Total estimado": totalCalculado,
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

    try { enviarAlertaPedido_(detallePedido, productosTexto, filaPedido); } catch (errorAlerta) { console.error(errorAlerta.message); }
    return responderJson_({exito:true,mensaje:"Pedido registrado correctamente.",folio:folioPedido,fila:filaPedido,total:totalCalculado});
  } catch (error) {
    return responderJson_({exito:false,mensaje:error.message || "Error desconocido al registrar el pedido."});
  } finally {
    try { lock.releaseLock(); } catch (errorLock) {}
  }
}

function migrarHojaPedidos() {
  const libro = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const hoja = obtenerHojaPedidos_(libro);
  obtenerHojaHistorial_(libro);
  hoja.setFrozenRows(1);
  hoja.setFrozenColumns(1);
  hoja.autoResizeColumns(1, hoja.getLastColumn());
  return "Hoja migrada correctamente.";
}

function probarEnvioCorreo() {
  MailApp.sendEmail({to:CONFIG.EMAIL_ALERTA,subject:"Prueba alerta Tu Dulcedía",body:"MailApp autorizado correctamente.",name:"Tu Dulcedía Pedidos"});
  return "Correo de prueba enviado a " + CONFIG.EMAIL_ALERTA;
}

function probarRegistroManual() {
  const pedidoPrueba = {nombreCliente:"Cliente prueba Apps Script",telefonoCliente:"+56 9 0000 0000",fechaSolicitada:"2026-06-20",productosSeleccionados:[{id:"galleta-vainilla-chips",nombre:"Galleta de vainilla con chips",categoria:"galleta",precio:500,cantidad:6,subtotal:3000},{id:"pan-masa-madre-1kg",nombre:"Pan de masa madre 1 kg aprox.",categoria:"pan",precio:4000,cantidad:1,subtotal:4000}],observacion:"Pedido de prueba creado desde Apps Script",totalEstimado:7000,metodoPago:"Transferencia bancaria",estadoPago:"Pendiente de comprobante",requiereDatosTransferencia:true,entregaSeparada:false,notaEntrega:"Pedido conjunto: entregar galletas junto con el pan.",origen:"Prueba manual Apps Script"};
  return doPost({postData:{contents:JSON.stringify(pedidoPrueba)}});
}

function adminListarPedidos_() {
  const libro = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const hoja = obtenerHojaPedidos_(libro);
  const ultimaFila = hoja.getLastRow();
  const ultimaColumna = hoja.getLastColumn();
  if (ultimaFila < 2) return {exito:true,pedidos:[]};
  const encabezados = hoja.getRange(1,1,1,ultimaColumna).getValues()[0].map(function(v){return String(v||"").trim();});
  const valores = hoja.getRange(2,1,ultimaFila-1,ultimaColumna).getValues();
  const indice = {}; encabezados.forEach(function(n,i){if(n) indice[n]=i;});
  const pedidos = valores.map(function(fila) {
    const estado = obtenerValorFila_(fila, indice, "Estado") || "Pendiente";
    const estadoPago = obtenerValorFila_(fila, indice, "Estado de pago") || "";
    const estadoOperativo = obtenerValorFila_(fila, indice, "Estado operativo") || calcularEstadoOperativo_(estado, estadoPago);
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
      estadoOperativo: estadoOperativo,
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
  return {exito:true,pedidos:pedidos.slice(0,150)};
}

function adminActualizarPedido_(p) {
  const folio = String(p.folio || "").trim();
  const nuevoEstado = String(p.estado || "").trim();
  const nuevoEstadoPago = String(p.estadoPago || "").trim();
  const obsInterna = p.observacionInterna !== undefined ? String(p.observacionInterna || "").trim() : null;
  if (!folio) throw new Error("Falta el folio del pedido.");
  if (nuevoEstado && ESTADOS_PEDIDO.indexOf(nuevoEstado) === -1) throw new Error("Estado de pedido no válido.");
  if (nuevoEstadoPago && ESTADOS_PAGO.indexOf(nuevoEstadoPago) === -1) throw new Error("Estado de pago no válido.");
  const libro = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const hoja = obtenerHojaPedidos_(libro);
  const historial = obtenerHojaHistorial_(libro);
  const fila = buscarFilaPorFolio_(hoja, folio);
  if (!fila) throw new Error("No se encontró el pedido " + folio + ".");
  const mapa = obtenerMapaEncabezados_(hoja);
  const ahora = new Date();
  const estadoAnterior = obtenerCeldaPorMapa_(hoja, fila, mapa, "Estado");
  const pagoAnterior = obtenerCeldaPorMapa_(hoja, fila, mapa, "Estado de pago");
  const obsAnterior = obtenerCeldaPorMapa_(hoja, fila, mapa, "Observación interna");
  const estadoFinal = nuevoEstado || estadoAnterior || "Pendiente";
  const pagoFinal = nuevoEstadoPago || pagoAnterior || "";
  const opFinal = calcularEstadoOperativo_(estadoFinal, pagoFinal);
  const cambios = [];
  if (nuevoEstado && nuevoEstado !== estadoAnterior) { setCeldaPorMapa_(hoja, fila, mapa, "Estado", nuevoEstado); cambios.push([ahora, folio, "Estado", estadoAnterior, nuevoEstado, "Admin dashboard", obsInterna || ""]); }
  if (nuevoEstadoPago && nuevoEstadoPago !== pagoAnterior) { setCeldaPorMapa_(hoja, fila, mapa, "Estado de pago", nuevoEstadoPago); cambios.push([ahora, folio, "Estado de pago", pagoAnterior, nuevoEstadoPago, "Admin dashboard", obsInterna || ""]); }
  setCeldaPorMapa_(hoja, fila, mapa, "Estado operativo", opFinal);
  if (obsInterna !== null && obsInterna !== obsAnterior) { setCeldaPorMapa_(hoja, fila, mapa, "Observación interna", obsInterna); cambios.push([ahora, folio, "Observación interna", obsAnterior, obsInterna, "Admin dashboard", obsInterna || ""]); }
  if (estadoFinal !== "Pendiente") setFechaSiVacia_(hoja, fila, mapa, "Fecha confirmado", ahora);
  if (pagoFinal === "Pagado") setFechaSiVacia_(hoja, fila, mapa, "Fecha pagado", ahora);
  if (estadoFinal === "Entregado") setFechaSiVacia_(hoja, fila, mapa, "Fecha entregado", ahora);
  if (cambios.length) historial.getRange(historial.getLastRow()+1,1,cambios.length,COLUMNAS_HISTORIAL.length).setValues(cambios);
  return {exito:true,mensaje:"Pedido actualizado correctamente.",folio:folio,estado:estadoFinal,estadoPago:pagoFinal,estadoOperativo:opFinal};
}

function validarAdmin_(token) {
  const conf = PropertiesService.getScriptProperties().getProperty("ADMIN_TOKEN");
  if (!conf) throw new Error("Falta configurar ADMIN_TOKEN en Propiedades de secuencia de comandos.");
  if (!token || token !== conf) throw new Error("Clave admin inválida.");
}

function obtenerHojaPedidos_(libro) { let hoja = libro.getSheetByName(CONFIG.NOMBRE_HOJA); if (!hoja) hoja = libro.insertSheet(CONFIG.NOMBRE_HOJA); asegurarColumnas_(hoja, COLUMNAS); return hoja; }
function obtenerHojaHistorial_(libro) { let hoja = libro.getSheetByName(CONFIG.NOMBRE_HOJA_HISTORIAL); if (!hoja) hoja = libro.insertSheet(CONFIG.NOMBRE_HOJA_HISTORIAL); asegurarColumnas_(hoja, COLUMNAS_HISTORIAL); hoja.setFrozenRows(1); return hoja; }

function asegurarColumnas_(hoja, columnas) {
  if (hoja.getLastRow() === 0) { hoja.getRange(1,1,1,columnas.length).setValues([columnas]); hoja.setFrozenRows(1); return; }
  const actuales = hoja.getRange(1,1,1,Math.max(hoja.getLastColumn(),1)).getValues()[0].map(function(v){return String(v||"").trim();});
  const faltantes = columnas.filter(function(c){return actuales.indexOf(c) === -1;});
  if (faltantes.length) hoja.getRange(1,hoja.getLastColumn()+1,1,faltantes.length).setValues([faltantes]);
  hoja.setFrozenRows(1);
}

function obtenerMapaEncabezados_(hoja) { asegurarColumnas_(hoja, COLUMNAS); const h=hoja.getRange(1,1,1,hoja.getLastColumn()).getValues()[0]; const m={}; h.forEach(function(n,i){n=String(n||"").trim(); if(n) m[n]=i+1;}); return m; }
function escribirFilaPorEncabezado_(hoja, datos) { const mapa=obtenerMapaEncabezados_(hoja); const fila=hoja.getLastRow()+1; const vals=new Array(hoja.getLastColumn()).fill(""); Object.keys(datos).forEach(function(k){ if(mapa[k]) vals[mapa[k]-1]=datos[k]; }); hoja.getRange(fila,1,1,vals.length).setValues([vals]); }
function buscarFilaPorFolio_(hoja, folio) { const mapa=obtenerMapaEncabezados_(hoja); const col=mapa["Folio pedido"]; const last=hoja.getLastRow(); if(!col||last<2)return 0; const vals=hoja.getRange(2,col,last-1,1).getValues(); for(let i=0;i<vals.length;i++) if(String(vals[i][0]).trim()===folio) return i+2; return 0; }
function obtenerCeldaPorMapa_(hoja,fila,mapa,col){ return mapa[col] ? hoja.getRange(fila,mapa[col]).getValue() : ""; }
function setCeldaPorMapa_(hoja,fila,mapa,col,val){ if(mapa[col]) hoja.getRange(fila,mapa[col]).setValue(val); }
function setFechaSiVacia_(hoja,fila,mapa,col,fecha){ if(!mapa[col])return; const actual=hoja.getRange(fila,mapa[col]).getValue(); if(!actual) hoja.getRange(fila,mapa[col]).setValue(fecha); }

function calcularEstadoOperativo_(estado, pago) {
  if (estado === "Cancelado") return "Cancelado";
  if (estado === "Entregado" && pago === "Pagado") return "Entregado y pagado";
  if (estado === "Entregado" && pago === "Pago al retirar") return "Entregado con pago al retirar";
  if (pago === "Pagado" && estado !== "Entregado") return "Pagado pendiente entrega";
  if (estado === "Listo para retiro/entrega") return "Listo para entregar";
  if (estado === "En preparación") return "En preparación";
  if (pago === "Pendiente de comprobante") return "Pendiente de pago";
  return "Pendiente de confirmación";
}

function obtenerMapaProductosCatalogo_() {
  const libro = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const hoja = libro.getSheetByName("Productos");
  const mapa = {};
  if (!hoja || hoja.getLastRow() < 2) return mapa;
  const valores = hoja.getRange(2, 1, hoja.getLastRow() - 1, Math.min(hoja.getLastColumn(), 8)).getValues();
  valores.forEach(function(fila) {
    const id = String(fila[0] || "").trim();
    if (!id) return;
    mapa[id] = { nombre: fila[1] || id, categoria: fila[2] || "", precio: Number(fila[3] || 0), activo: String(fila[4] || "Sí") };
  });
  return mapa;
}

function normalizarProductosPedido_(productos, catalogo) {
  if (!Array.isArray(productos) || !productos.length) throw new Error("El pedido no tiene productos seleccionados.");
  return productos.map(function(producto) {
    const id = String(producto.id || "").trim();
    const info = id && catalogo[id] ? catalogo[id] : {};
    const cantidad = Math.max(1, Math.floor(Number(producto.cantidad || 1)));
    const precio = Number(info.precio || producto.precio || 0);
    const subtotal = precio * cantidad;
    if (!precio || precio < 0) throw new Error("Precio inválido para producto " + (id || producto.nombre || "sin ID") + ".");
    return {
      id: id,
      nombre: info.nombre || producto.nombre || "Producto sin nombre",
      categoria: info.categoria || producto.categoria || "",
      precio: precio,
      cantidad: cantidad,
      subtotal: subtotal
    };
  });
}

function generarFirmaPedido_(pedido, productos, total, metodoPago, tipoEntrega) {
  const base = {
    nombre: String(pedido.nombreCliente || "").trim().toLowerCase(),
    telefono: String(pedido.telefonoCliente || "").replace(/\D/g, ""),
    fecha: String(pedido.fechaSolicitada || "").trim(),
    metodoPago: String(metodoPago || "").trim(),
    entregaSeparada: pedido.entregaSeparada === true,
    tipoEntrega: String(tipoEntrega || "").trim(),
    total: Number(total || 0),
    productos: productos.map(function(p) { return [p.id, p.cantidad, p.precio]; }).sort()
  };
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(base))).slice(0, 32);
}

function buscarPedidoDuplicadoReciente_(hoja, firma, minutos) {
  const mapa = obtenerMapaEncabezados_(hoja);
  const colJson = mapa["Detalle JSON"];
  const colFolio = mapa["Folio pedido"];
  const colFecha = mapa["Fecha/hora registro"];
  const last = hoja.getLastRow();
  if (!firma || !colJson || last < 2) return null;
  const start = Math.max(2, last - 40);
  const valores = hoja.getRange(start, 1, last - start + 1, hoja.getLastColumn()).getValues();
  const ahora = new Date().getTime();
  for (let i = valores.length - 1; i >= 0; i--) {
    const fila = valores[i];
    const fecha = colFecha ? fila[colFecha - 1] : null;
    if (Object.prototype.toString.call(fecha) === "[object Date]") {
      const minutosDiff = (ahora - fecha.getTime()) / 60000;
      if (minutosDiff > minutos) continue;
    }
    try {
      const detalle = JSON.parse(fila[colJson - 1] || "{}");
      if (detalle.firmaPedido === firma) {
        return { fila: start + i, folio: fila[colFolio - 1] || detalle.folioPedido || "" };
      }
    } catch (error) {}
  }
  return null;
}

function enviarAlertaPedido_(pedido, productosTexto, filaPedido) {
  if (!CONFIG.EMAIL_ALERTA) return;
  const urlSheet = "https://docs.google.com/spreadsheets/d/" + CONFIG.SPREADSHEET_ID + "/edit";
  const total = Number(pedido.totalEstimado || 0).toLocaleString("es-CL");
  const etiquetaPago = pedido.metodoPago === "Transferencia bancaria" ? "[TRANSFERENCIA]" : "[PAGO AL RETIRAR]";
  const asunto = etiquetaPago + " Nuevo pedido " + pedido.folioPedido + " - Tu Dulcedía";
  const tel = normalizarTelefonoWhatsapp_(pedido.telefonoCliente);
  const msgW = "Hola " + pedido.nombreCliente + ", recibimos tu pedido " + pedido.folioPedido + ". Total estimado: $" + total + ". Te confirmaremos disponibilidad durante el día. Muchas gracias.";
  const linkW = tel ? "https://wa.me/" + tel + "?text=" + encodeURIComponent(msgW) : "";
  const cuerpo = etiquetaPago + " Nuevo pedido recibido en Tu Dulcedía\n\nFolio: " + pedido.folioPedido + "\nCliente: " + pedido.nombreCliente + "\nTeléfono: " + (pedido.telefonoCliente || "No indicado") + "\nFecha solicitada: " + pedido.fechaSolicitada + "\nProductos: " + productosTexto + "\nObservación: " + (pedido.observacion || "Sin observación") + "\nTotal estimado: $" + total + "\nMétodo de pago: " + pedido.metodoPago + "\nEstado de pago: " + pedido.estadoPago + "\nEstado operativo: " + pedido.estadoOperativo + "\nTipo entrega: " + pedido.tipoEntrega + "\nFila: " + filaPedido + "\n\nVer pedidos:\n" + urlSheet + "\n\n" + (linkW ? "Responder por WhatsApp:\n" + linkW : "Sin link de WhatsApp.");
  const html = "<h2>" + escaparHtml_(etiquetaPago) + " Nuevo pedido recibido</h2><p><strong>Folio:</strong> " + escaparHtml_(pedido.folioPedido) + "</p><p><strong>Cliente:</strong> " + escaparHtml_(pedido.nombreCliente) + "</p><p><strong>Total:</strong> $" + total + "</p><p><strong>Productos:</strong> " + escaparHtml_(productosTexto) + "</p><p><a href='" + urlSheet + "'>Abrir Google Sheets</a></p>" + (linkW ? "<p><a href='" + linkW + "'>Responder por WhatsApp</a></p>" : "");
  MailApp.sendEmail({to:CONFIG.EMAIL_ALERTA,subject:asunto,body:cuerpo,htmlBody:html,name:"Tu Dulcedía Pedidos"});
}

function validarPedido_(pedido) { if(!pedido||typeof pedido!=="object") throw new Error("El pedido recibido no es válido."); if(!pedido.nombreCliente||!String(pedido.nombreCliente).trim()) throw new Error("Falta el nombre del cliente."); if(!pedido.fechaSolicitada) throw new Error("Falta la fecha solicitada."); if(!Array.isArray(pedido.productosSeleccionados)||!pedido.productosSeleccionados.length) throw new Error("El pedido no tiene productos seleccionados."); }
function generarFolio_(filaPedido) { return "TD-" + String(Math.max(1, filaPedido - 1)).padStart(4,"0"); }
function normalizarTelefonoWhatsapp_(telefono) { if(!telefono)return""; let x=String(telefono).replace(/\D/g,""); if(!x)return""; if(x.startsWith("56"))return x; if(x.startsWith("9")&&x.length===9)return"56"+x; if(x.startsWith("0"))x=x.replace(/^0+/,""); return x.length>=8&&x.length<=9?"56"+x:x; }
function obtenerValorFila_(fila, indice, col) { const p=indice[col]; return p===undefined?"":fila[p]; }
function formatearValor_(valor) { if(Object.prototype.toString.call(valor)==="[object Date]") return Utilities.formatDate(valor, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm"); return valor || ""; }
function escaparHtml_(texto) { return String(texto).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
function responderJson_(objeto) { return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON); }
function responderJsonp_(objeto, callback) { const json=JSON.stringify(objeto); if(callback) return ContentService.createTextOutput(String(callback)+"("+json+");").setMimeType(ContentService.MimeType.JAVASCRIPT); return responderJson_(objeto); }
