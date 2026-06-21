#!/usr/bin/env node
/*
 * Tu Dulce Dia - Migracion desde Google Sheets exportado a CSV
 *
 * Uso:
 *   node scripts/migrate-from-sheets.js ./exports ./dist-migration
 *
 * Este script no se conecta a Supabase ni modifica produccion.
 * Solo transforma CSV locales a JSON normalizado para revision/importacion posterior.
 */

const fs = require('fs');
const path = require('path');

const INPUT_DIR = process.argv[2] || './exports';
const OUTPUT_DIR = process.argv[3] || './dist-migration';

const MONTHS_ES = {
  enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
  julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readFileIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function listCsvFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.csv'))
    .map((name) => path.join(dir, name));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"' && inQuotes && next === '"') {
      value += '"';
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (c === ',' && !inQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if ((c === '\n' || c === '\r') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      row.push(value);
      if (row.some((x) => String(x).trim() !== '')) rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += c;
  }

  if (value || row.length) {
    row.push(value);
    if (row.some((x) => String(x).trim() !== '')) rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows[0].map((h) => normalizeHeader(h));
  return rows.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = clean(cells[idx] || '');
    });
    return obj;
  });
}

function clean(value) {
  return String(value == null ? '' : value).replace(/^\uFEFF/, '').trim();
}

function normalizeHeader(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeText(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeProductName(value) {
  let n = normalizeText(value)
    .replace(/\bcon\b/g, '')
    .replace(/\bde\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  n = n.replace(/chip\b/g, 'chips');
  n = n.replace(/nuece\b/g, 'nueces');
  n = n.replace(/ma a madre/g, 'masa madre');

  if (n.includes('pan') && n.includes('masa madre')) return 'pan masa madre 1 kg aprox.';
  if (n.includes('vainilla') && n.includes('blanco') && n.includes('nueces')) return 'galleta vainilla chips chocolate blanco nueces';
  if (n.includes('vainilla') && n.includes('blanco')) return 'galleta vainilla chips chocolate blanco';
  if (n.includes('chocolate') && n.includes('chips') && n.includes('nueces')) return 'galleta chocolate chips nueces';
  if (n.includes('vainilla') && n.includes('chips') && n.includes('nueces')) return 'galleta vainilla chips nueces';
  if (n.includes('chocolate') && n.includes('nueces')) return 'galleta chocolate nueces';
  if (n.includes('vainilla') && n.includes('nueces')) return 'galleta vainilla nueces';
  if (n.includes('chocolate') && n.includes('chips')) return 'galleta chocolate chips';
  if (n.includes('vainilla') && n.includes('chips')) return 'galleta vainilla chips';
  return n;
}

function canonInsumo(value) {
  const n = normalizeText(value);
  if (!n) return '';
  if (n.includes('chip') && n.includes('blanco')) return 'chips de chocolate blanco';
  if (n.includes('chip')) return 'chips de chocolate';
  if (n.includes('harina') && (n.includes('fuerza') || n.includes('0000') || n.includes('pan'))) return 'harina de fuerza o 0000';
  if (n.includes('harina')) return 'harina sin polvos de hornear';
  if (n.includes('margarina')) return 'margarina';
  if (n.includes('huevo')) return 'huevos';
  if (n.includes('nuez')) return 'nueces';
  if (n.includes('almendra')) return 'almendras';
  if (n.includes('cacao')) return 'cacao en polvo';
  if (n.includes('polvo')) return 'polvos de hornear';
  if (n.includes('bicarbonato')) return 'bicarbonato';
  if (n.includes('azucar')) return 'azúcar';
  if (n.includes('masa madre')) return 'masa madre';
  if (n.includes('agua')) return 'agua';
  if (n.includes('sal')) return 'sal';
  if (n.includes('bolsa')) return 'bolsas';
  if (n.includes('caja')) return 'cajas';
  if (n.includes('etiqueta')) return 'etiquetas';
  if (n.includes('gas')) return 'gas';
  if (n.includes('luz')) return 'luz';
  if (n.includes('delivery')) return 'delivery';
  return clean(value).toLowerCase();
}

function toNumber(value) {
  let s = clean(value).replace(/[$\s]/g, '').replace(/[^0-9,.-]/g, '');
  if (!s) return 0;

  const comma = s.lastIndexOf(',');
  const dot = s.lastIndexOf('.');

  if (comma >= 0 && dot >= 0) {
    if (comma > dot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (comma >= 0) {
    s = s.replace(',', '.');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function toBool(value, fallback = true) {
  const n = normalizeText(value);
  if (!n) return fallback;
  return !['no', 'false', 'falso', 'inactivo', '0'].includes(n);
}

function toDate(value) {
  const v = clean(value);
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);

  const spanish = normalizeText(v).match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
  if (spanish && MONTHS_ES[spanish[2]]) {
    return `${spanish[3]}-${MONTHS_ES[spanish[2]]}-${spanish[1].padStart(2, '0')}`;
  }

  const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return v;
}

function fileSheetName(file) {
  const base = path.basename(file).replace(/\.csv$/i, '');
  const parts = base.split(/\s+-\s+/g);
  return normalizeText(parts[parts.length - 1] || base);
}

function findCsvFile(candidates, keywords = []) {
  for (const name of candidates) {
    const full = path.join(INPUT_DIR, name);
    if (fs.existsSync(full)) return full;
  }
  const files = listCsvFiles(INPUT_DIR);
  const normalizedKeywords = keywords.map(normalizeText);

  const exactBySheet = files.find((file) => {
    const sheet = fileSheetName(file);
    return normalizedKeywords.some((kw) => sheet === kw);
  });
  if (exactBySheet) return exactBySheet;

  return files.find((file) => {
    const n = normalizeText(path.basename(file));
    return normalizedKeywords.every((kw) => n.includes(kw));
  }) || null;
}

function readCsv(candidates, keywords) {
  const file = findCsvFile(candidates, keywords);
  if (!file) return [];
  return parseCsv(readFileIfExists(file));
}

function transformProductos(rows) {
  return rows.map((r, idx) => {
    const nombre = r.nombre || r.producto || r.descripcion || '';
    const categoriaRaw = normalizeText(r.categoria || '');
    return {
      codigo: r.id || r.codigo || `producto_${idx + 1}`,
      nombre,
      nombre_normalizado: normalizeProductName(nombre),
      categoria: categoriaRaw.includes('pan') ? 'pan' : categoriaRaw.includes('otro') ? 'otro' : 'galleta',
      precio: Math.round(toNumber(r.precio || r.valor)),
      activo: toBool(r.activo || r.disponible || 'si', true),
      anticipacion_dias: Math.round(toNumber(r.anticipacion_dias || r.anticipaciondias || r.dias || 1)) || 1,
      descripcion: r.descripcion || '',
      orden: Math.round(toNumber(r.orden || idx + 1)) || idx + 1,
    };
  }).filter((p) => p.nombre);
}

function parseDetalleJson(raw) {
  if (!clean(raw)) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function splitProductosTexto(text) {
  const raw = clean(text);
  if (!raw) return [];
  return raw
    .split(/\n|;|\|/g)
    .map((x) => clean(x))
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)\s*×\s*(\d+)\s*=\s*\$?([0-9.,]+)/i)
        || line.match(/^(.*?)\s*x\s*(\d+)/i);
      const nombre = m ? clean(m[1]) : line;
      const cantidad = m ? Number(m[2]) || 1 : 1;
      const subtotal = m && m[3] ? Math.round(toNumber(m[3])) : 0;
      return {
        nombre_snapshot: nombre,
        nombre_normalizado: normalizeProductName(nombre),
        cantidad,
        precio_snapshot: subtotal && cantidad ? Math.round(subtotal / cantidad) : 0,
        subtotal,
        requiere_revision: !subtotal,
      };
    });
}

function transformPedidos(rows) {
  const clientesByPhone = new Map();
  const pedidos = [];
  const items = [];
  const warnings = [];

  rows.forEach((r, idx) => {
    const folio = r.foliopedido || r.folio_pedido || r.folio || r.numero_pedido || `MIG-${String(idx + 1).padStart(5, '0')}`;
    const nombre = r.nombrecliente || r.nombre_cliente || r.cliente || r.nombre || 'Cliente sin nombre';
    const telefono = r.telefonocliente || r.telefono_cliente || r.telefono || '';
    const phoneKey = normalizeText(telefono || nombre);
    if (!clientesByPhone.has(phoneKey)) {
      clientesByPhone.set(phoneKey, {
        nombre,
        telefono,
        telefono_normalizado: telefono.replace(/[^0-9+]/g, ''),
      });
    }

    const total = Math.round(toNumber(r.totalestimado || r.total_estimado || r.total || r.monto));
    const estadoRaw = r.estado || 'Pendiente';
    const estadoNorm = normalizeText(estadoRaw);
    const isCancelado = estadoNorm.includes('cancel') || estadoNorm.includes('anulad');
    const estado = isCancelado ? 'Cancelado' : normalizeEstado(estadoRaw);
    const estadoPago = normalizeEstadoPago(r.estadopago || r.estado_pago || 'Pendiente de comprobante');

    pedidos.push({
      folio,
      cliente_nombre: nombre,
      cliente_telefono: telefono,
      fecha_solicitada: toDate(r.fechasolicitada || r.fecha_solicitada || r.fecha || r.fecha_entrega),
      metodo_pago: r.metodopago || r.metodo_pago || 'Transferencia bancaria',
      estado,
      estado_pago: estadoPago,
      total_estimado: isCancelado ? 0 : total,
      total_estimado_original: total,
      observacion: r.observacion || r.obs || '',
      observacion_interna: r.observacioninterna || r.observacion_interna || '',
      origen: r.origen || 'Migracion Google Sheets',
    });

    const detalle = parseDetalleJson(r.productosdetallejson || r.productos_detalle_json || r.detallejson || r.detalle_json);
    if (Array.isArray(detalle) && detalle.length) {
      detalle.forEach((p) => {
        const cantidad = Number(p.cantidad) || 1;
        const subtotal = Math.round(Number(p.subtotal) || (Number(p.precio) || 0) * cantidad);
        items.push({
          folio,
          producto_id_origen: p.id || '',
          nombre_snapshot: p.nombre || '',
          nombre_normalizado: normalizeProductName(p.nombre || ''),
          categoria_snapshot: p.categoria || '',
          cantidad,
          precio_snapshot: Math.round(Number(p.precio) || (subtotal && cantidad ? subtotal / cantidad : 0)),
          subtotal,
          requiere_revision: !p.nombre || !subtotal,
        });
      });
    } else {
      const productosTexto = r.productostexto || r.productos_texto || r.productos || r.detalle || '';
      const parsed = splitProductosTexto(productosTexto);
      if (!parsed.length) warnings.push(`Pedido ${folio} sin detalle de productos parseable.`);
      parsed.forEach((item) => items.push({ folio, ...item }));
    }
  });

  return {
    clientes: Array.from(clientesByPhone.values()),
    pedidos,
    pedido_items: items,
    warnings,
  };
}

function normalizeEstado(value) {
  const n = normalizeText(value);
  if (n.includes('confirm')) return 'Confirmado';
  if (n.includes('prepar')) return 'En preparación';
  if (n.includes('listo')) return 'Listo para retiro/entrega';
  if (n.includes('entreg')) return 'Entregado';
  if (n.includes('cancel') || n.includes('anulad')) return 'Cancelado';
  return 'Pendiente';
}

function normalizeEstadoPago(value) {
  const n = normalizeText(value);
  if (n.includes('comprobante')) return 'Comprobante recibido';
  if (n.includes('pagado') || n === 'pagado') return 'Pagado';
  if (n.includes('retirar')) return 'Pago al retirar';
  return 'Pendiente de comprobante';
}

function toBaseUnit(unidad) {
  const u = normalizeText(unidad);
  if (u === 'kg') return 'g';
  if (u === 'l') return 'ml';
  if (['g', 'ml', 'unidad', 'pack', 'servicio'].includes(u)) return u;
  return u || 'unidad';
}

function toBaseQty(qty, unidad) {
  const u = normalizeText(unidad);
  if (u === 'kg' || u === 'l') return qty * 1000;
  return qty;
}

function transformCompras(rows) {
  return rows.map((r) => {
    const contenido = toNumber(r.contenido_por_envase || r.contenidoporenvase || r.contenido);
    const envases = toNumber(r.envases_comprados || r.envasescomprados || r.envases);
    const costoEnvase = Math.round(toNumber(r.costo_por_envase || r.costoporenvase || r.costo_envase));
    const cantidadTotal = toNumber(r.cantidad_total || r.cantidadtotal) || contenido * envases;
    const costoTotal = Math.round(toNumber(r.costo_total || r.costototal) || costoEnvase * envases);
    const unidad = r.unidad_stock || r.unidadstock || r.unidad || 'g';
    const insumoOriginal = r.insumo || r.item || r.material || '';
    return {
      fecha: toDate(r.fecha),
      categoria: r.categoria || 'Materia prima',
      insumo_original: insumoOriginal,
      insumo_normalizado: canonInsumo(insumoOriginal),
      unidad_stock: unidad,
      unidad_base: toBaseUnit(unidad),
      contenido_por_envase: contenido,
      envases_comprados: envases,
      costo_por_envase: costoEnvase,
      cantidad_total: cantidadTotal,
      cantidad_base: toBaseQty(cantidadTotal, unidad),
      costo_total: costoTotal,
      costo_base: cantidadTotal > 0 ? costoTotal / cantidadTotal : null,
      costo_base_unidad_base: toBaseQty(cantidadTotal, unidad) > 0 ? costoTotal / toBaseQty(cantidadTotal, unidad) : null,
      proveedor: r.proveedor || '',
      estado: r.estado || 'Disponible',
      observacion: r.observacion || r.obs || '',
      fecha_hora_registro: r.fecha_hora_registro || null,
    };
  }).filter((x) => x.insumo_original || x.insumo_normalizado);
}

function transformRecetas(rows) {
  return rows.map((r) => {
    const ingredientes = parseDetalleJson(r.ingredientesjson || r.ingredientes_json || r.ingredientes);
    return {
      producto: r.producto || '',
      producto_normalizado: normalizeProductName(r.producto || ''),
      rendimiento: toNumber(r.rendimiento),
      unidad_salida: r.unidad_salida || 'unidades',
      ingredientes: Array.isArray(ingredientes) ? ingredientes.map((i) => ({
        insumo_original: i.insumo || '',
        insumo_normalizado: canonInsumo(i.insumo || ''),
        cantidad: toNumber(i.cantidad),
        unidad: i.unidad || 'g',
      })) : [],
      fecha_hora_registro: r.fecha_hora_registro || null,
    };
  }).filter((x) => x.producto);
}

function transformDisponibilidad(rows) {
  return rows.map((r) => ({
    fecha: toDate(r.fecha),
    estado: r.estado || 'Abierto',
    cupo_maximo: toNumber(r.cupo_maximo || r.cupomaximo || r.cupo),
    nota: r.nota || '',
  })).filter((x) => x.fecha);
}

function transformProduccion(rows) {
  return rows.map((r) => ({
    id_produccion: r.id_produccion || '',
    fecha: toDate(r.fecha),
    producto: r.producto || '',
    producto_normalizado: normalizeProductName(r.producto || ''),
    lotes: toNumber(r.lotes),
    unidades_producidas: toNumber(r.unidades_producidas),
    costo_lote_total: Math.round(toNumber(r.costo_lote_total)),
    costo_unitario: toNumber(r.costo_unitario),
    observacion: r.observacion || '',
    fecha_hora_registro: r.fecha_hora_registro || null,
  })).filter((x) => x.producto || x.id_produccion);
}

function writeJson(name, data) {
  const out = path.join(OUTPUT_DIR, name);
  fs.writeFileSync(out, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`OK ${out} (${Array.isArray(data) ? data.length : Object.keys(data).length})`);
}

function main() {
  ensureDir(OUTPUT_DIR);

  const productosRows = readCsv(['Productos.csv', 'productos.csv', 'Catalogo.csv', 'catalogo.csv'], ['productos']);
  const pedidosRows = readCsv(['Pedidos.csv', 'pedidos.csv'], ['pedidos']);
  const comprasRows = readCsv(['Compras.csv', 'compras.csv', 'Insumos.csv', 'insumos.csv', 'Compras_Insumos.csv', 'ComprasInsumos.csv'], ['comprasinsumos']);
  const recetasRows = readCsv(['Recetas.csv', 'recetas.csv'], ['recetas']);
  const produccionRows = readCsv(['Produccion.csv', 'produccion.csv', 'Producción.csv'], ['produccion']);
  const disponibilidadRows = readCsv(['Disponibilidad.csv', 'disponibilidad.csv'], ['disponibilidad']);

  const productos = transformProductos(productosRows);
  const pedidoData = transformPedidos(pedidosRows);
  const compras = transformCompras(comprasRows);
  const recetas = transformRecetas(recetasRows);
  const produccion = transformProduccion(produccionRows);
  const disponibilidad = transformDisponibilidad(disponibilidadRows);

  writeJson('productos.json', productos);
  writeJson('clientes.json', pedidoData.clientes);
  writeJson('pedidos.json', pedidoData.pedidos);
  writeJson('pedido_items.json', pedidoData.pedido_items);
  writeJson('compras_insumos.json', compras);
  writeJson('recetas.json', recetas);
  writeJson('produccion.json', produccion);
  writeJson('disponibilidad.json', disponibilidad);

  const activePedidos = pedidoData.pedidos.filter((p) => p.estado !== 'Cancelado');
  const canceledPedidos = pedidoData.pedidos.filter((p) => p.estado === 'Cancelado');
  const report = {
    inputDir: INPUT_DIR,
    outputDir: OUTPUT_DIR,
    counts: {
      productos: productos.length,
      clientes: pedidoData.clientes.length,
      pedidos: pedidoData.pedidos.length,
      pedidos_activos: activePedidos.length,
      pedidos_cancelados: canceledPedidos.length,
      pedido_items: pedidoData.pedido_items.length,
      compras_insumos: compras.length,
      recetas: recetas.length,
      produccion: produccion.length,
      disponibilidad: disponibilidad.length,
    },
    totals: {
      ventas_activas: activePedidos.reduce((sum, p) => sum + (Number(p.total_estimado) || 0), 0),
      ventas_canceladas_originales: canceledPedidos.reduce((sum, p) => sum + (Number(p.total_estimado_original) || 0), 0),
      compras_total: compras.reduce((sum, c) => sum + (Number(c.costo_total) || 0), 0),
    },
    warnings: [
      ...pedidoData.warnings,
      'Revisar nombres de productos históricos con errores de tipeo: chip/chips, nuece/nueces, ma a/masa.',
      'Los pedidos cancelados se transforman con total_estimado 0 y conservan total_estimado_original.',
      'Las compras en kg/l incluyen cantidad_base convertida a g/ml para stock.',
      'Disponibilidad y producción no tienen registros si el CSV solo trae encabezados.',
    ],
  };
  writeJson('migration-report.json', report);
}

main();
