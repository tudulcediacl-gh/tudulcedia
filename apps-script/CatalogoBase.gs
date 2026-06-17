/** Base FASE 3: hojas Productos y Disponibilidad. */

const NOMBRE_HOJA_PRODUCTOS = "Productos";
const NOMBRE_HOJA_DISPONIBILIDAD = "Disponibilidad";

const COLUMNAS_PRODUCTOS = ["ID","Nombre","Categoría","Precio","Activo","Anticipación días","Descripción","Orden"];
const COLUMNAS_DISPONIBILIDAD = ["Fecha","Estado","Cupo máximo","Nota"];

const PRODUCTOS_INICIALES = [
  ["galleta-vainilla-chips","Galleta de vainilla con chips","galleta",500,"Sí",1,"Galleta artesanal de vainilla con chips.",10],
  ["galleta-vainilla-nueces","Galleta de vainilla con nueces","galleta",600,"Sí",1,"Galleta artesanal de vainilla con nueces.",20],
  ["galleta-chocolate-chips","Galleta de chocolate con chips","galleta",500,"Sí",1,"Galleta artesanal de chocolate con chips.",30],
  ["galleta-chocolate-nueces","Galleta de chocolate con nueces","galleta",600,"Sí",1,"Galleta artesanal de chocolate con nueces.",40],
  ["galleta-vainilla-chips-nueces","Galleta de vainilla con chips y nueces","galleta",700,"Sí",1,"Galleta artesanal de vainilla con chips y nueces.",50],
  ["galleta-chocolate-chips-nueces","Galleta de chocolate con chips y nueces","galleta",700,"Sí",1,"Galleta artesanal de chocolate con chips y nueces.",60],
  ["pan-masa-madre-1kg","Pan de masa madre 1 kg aprox.","pan",4000,"Sí",3,"Pan artesanal de masa madre, 1 kg aprox.",70]
];

function migrarHojasCatalogo() {
  const libro = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const hojaProductos = obtenerHojaCatalogo_(libro, NOMBRE_HOJA_PRODUCTOS, COLUMNAS_PRODUCTOS);
  const hojaDisponibilidad = obtenerHojaCatalogo_(libro, NOMBRE_HOJA_DISPONIBILIDAD, COLUMNAS_DISPONIBILIDAD);
  poblarProductosInicialesSiVacio_(hojaProductos);
  poblarDisponibilidadInicialSiVacio_(hojaDisponibilidad);
  hojaProductos.setFrozenRows(1);
  hojaDisponibilidad.setFrozenRows(1);
  hojaProductos.autoResizeColumns(1, hojaProductos.getLastColumn());
  hojaDisponibilidad.autoResizeColumns(1, hojaDisponibilidad.getLastColumn());
  return "Hojas Productos y Disponibilidad preparadas correctamente.";
}

function obtenerCatalogoPublico_() {
  const libro = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const productos = leerProductos_(obtenerHojaCatalogo_(libro, NOMBRE_HOJA_PRODUCTOS, COLUMNAS_PRODUCTOS), true);
  const disponibilidad = leerDisponibilidad_(obtenerHojaCatalogo_(libro, NOMBRE_HOJA_DISPONIBILIDAD, COLUMNAS_DISPONIBILIDAD));
  return { exito: true, productos: productos, disponibilidad: disponibilidad, actualizado: new Date() };
}

function adminListarCatalogo_() {
  const libro = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return {
    exito: true,
    productos: leerProductos_(obtenerHojaCatalogo_(libro, NOMBRE_HOJA_PRODUCTOS, COLUMNAS_PRODUCTOS), false),
    disponibilidad: leerDisponibilidad_(obtenerHojaCatalogo_(libro, NOMBRE_HOJA_DISPONIBILIDAD, COLUMNAS_DISPONIBILIDAD))
  };
}

function adminGuardarProducto_(p) {
  const id = String(p.id || "").trim();
  if (!id) throw new Error("Falta ID de producto.");
  const libro = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const hoja = obtenerHojaCatalogo_(libro, NOMBRE_HOJA_PRODUCTOS, COLUMNAS_PRODUCTOS);
  const fila = buscarFilaCatalogo_(hoja, id);
  const valores = [
    id,
    String(p.nombre || "").trim(),
    String(p.categoria || "").trim(),
    Number(p.precio || 0),
    normalizarSiNo_(p.activo),
    Number(p.anticipacionDias || 1),
    String(p.descripcion || "").trim(),
    Number(p.orden || 999)
  ];
  if (fila) hoja.getRange(fila, 1, 1, valores.length).setValues([valores]);
  else hoja.getRange(hoja.getLastRow() + 1, 1, 1, valores.length).setValues([valores]);
  return { exito: true, mensaje: "Producto guardado.", producto: id };
}

function adminGuardarDisponibilidad_(p) {
  const fecha = String(p.fecha || "").trim();
  if (!fecha) throw new Error("Falta fecha.");
  const libro = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const hoja = obtenerHojaCatalogo_(libro, NOMBRE_HOJA_DISPONIBILIDAD, COLUMNAS_DISPONIBILIDAD);
  const fila = buscarFilaCatalogo_(hoja, fecha);
  const valores = [fecha, String(p.estado || "Abierto").trim(), p.cupoMaximo || "", String(p.nota || "").trim()];
  if (fila) hoja.getRange(fila, 1, 1, valores.length).setValues([valores]);
  else hoja.getRange(hoja.getLastRow() + 1, 1, 1, valores.length).setValues([valores]);
  return { exito: true, mensaje: "Disponibilidad guardada.", fecha: fecha };
}

function obtenerHojaCatalogo_(libro, nombreHoja, columnas) {
  let hoja = libro.getSheetByName(nombreHoja);
  if (!hoja) hoja = libro.insertSheet(nombreHoja);
  asegurarColumnasCatalogo_(hoja, columnas);
  return hoja;
}

function asegurarColumnasCatalogo_(hoja, columnas) {
  if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, columnas.length).setValues([columnas]);
    hoja.setFrozenRows(1);
    return;
  }
  const actuales = hoja.getRange(1, 1, 1, Math.max(hoja.getLastColumn(), 1)).getValues()[0].map(function(v){return String(v||"").trim();});
  const faltantes = columnas.filter(function(c){ return actuales.indexOf(c) === -1; });
  if (faltantes.length) hoja.getRange(1, hoja.getLastColumn() + 1, 1, faltantes.length).setValues([faltantes]);
  hoja.setFrozenRows(1);
}

function poblarProductosInicialesSiVacio_(hoja) {
  if (hoja.getLastRow() > 1) return;
  hoja.getRange(2, 1, PRODUCTOS_INICIALES.length, COLUMNAS_PRODUCTOS.length).setValues(PRODUCTOS_INICIALES);
}

function poblarDisponibilidadInicialSiVacio_(hoja) {
  if (hoja.getLastRow() > 1) return;
  hoja.getRange(2, 1, 1, COLUMNAS_DISPONIBILIDAD.length).setValues([["", "Abierto", "", "Agrega una fecha para bloquear o limitar cupo."]]);
}

function leerProductos_(hoja, soloActivos) {
  const last = hoja.getLastRow();
  if (last < 2) return [];
  return hoja.getRange(2, 1, last - 1, COLUMNAS_PRODUCTOS.length).getValues()
    .filter(function(r){ return r[0] && (!soloActivos || String(r[4] || "Sí").toLowerCase() !== "no"); })
    .map(function(r){ return { id:r[0], nombre:r[1], categoria:r[2], precio:Number(r[3]||0), activo:String(r[4]||"Sí"), anticipacionDias:Number(r[5]||1), descripcion:r[6]||"", orden:Number(r[7]||999) }; })
    .sort(function(a,b){ return a.orden - b.orden; });
}

function leerDisponibilidad_(hoja) {
  const last = hoja.getLastRow();
  if (last < 2) return [];
  return hoja.getRange(2, 1, last - 1, COLUMNAS_DISPONIBILIDAD.length).getValues()
    .filter(function(r){ return r[0]; })
    .map(function(r){ return { fecha: formatearValor_(r[0]), estado:r[1]||"Abierto", cupoMaximo:r[2]||"", nota:r[3]||"" }; });
}

function buscarFilaCatalogo_(hoja, clave) {
  const last = hoja.getLastRow();
  if (last < 2) return 0;
  const vals = hoja.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (String(vals[i][0]).trim() === String(clave).trim()) return i + 2;
  return 0;
}

function normalizarSiNo_(valor) {
  const v = String(valor || "Sí").toLowerCase();
  return (v === "no" || v === "false" || v === "0") ? "No" : "Sí";
}
