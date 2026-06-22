// Supabase Edge Function: enviar-correo-pedido
// Requiere secretos configurados en Supabase:
// RESEND_API_KEY
// MAIL_FROM
// MAIL_TO

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type Item = {
  nombre?: string;
  nombre_snapshot?: string;
  cantidad?: number;
  precio?: number;
  precio_snapshot?: number;
  subtotal?: number;
};

function money(n: unknown) {
  const v = Number(n || 0);
  return '$' + v.toLocaleString('es-CL');
}

function safe(v: unknown) {
  return String(v ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] || c));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo no permitido' }), { status: 405, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const items: Item[] = Array.isArray(payload.items) ? payload.items : [];

    const folio = payload.folio || payload.pedido_folio || 'Pedido web';
    const cliente = payload.cliente_nombre || payload.nombre || '';
    const telefono = payload.cliente_telefono || payload.telefono || '';
    const fecha = payload.fecha_solicitada || payload.fecha || '';
    const total = payload.total_estimado || payload.total || 0;
    const observacion = payload.observacion || '';

    const itemRows = items.map((it) => {
      const nombre = it.nombre || it.nombre_snapshot || '';
      const cantidad = Number(it.cantidad || 0);
      const precio = it.precio || it.precio_snapshot || 0;
      const subtotal = it.subtotal || cantidad * Number(precio || 0);
      return `<tr><td>${safe(nombre)}</td><td align="center">${cantidad}</td><td align="right">${money(precio)}</td><td align="right">${money(subtotal)}</td></tr>`;
    }).join('');

    const html = `
      <div style="font-family:Arial,sans-serif;color:#563820;max-width:680px;margin:auto">
        <h1>Nuevo pedido Tu Dulce Día</h1>
        <p><b>Folio:</b> ${safe(folio)}</p>
        <p><b>Cliente:</b> ${safe(cliente)}</p>
        <p><b>Teléfono:</b> ${safe(telefono)}</p>
        <p><b>Fecha solicitada:</b> ${safe(fecha)}</p>
        <table width="100%" cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#ead8bd">
          <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <h2>Total estimado: ${money(total)}</h2>
        <p><b>Observación:</b> ${safe(observacion)}</p>
      </div>
    `;

    const text = [
      `Nuevo pedido Tu Dulce Día`,
      `Folio: ${folio}`,
      `Cliente: ${cliente}`,
      `Teléfono: ${telefono}`,
      `Fecha solicitada: ${fecha}`,
      `Productos:`,
      ...items.map((it) => `- ${it.nombre || it.nombre_snapshot}: ${it.cantidad} x ${money(it.precio || it.precio_snapshot)} = ${money(it.subtotal)}`),
      `Total estimado: ${money(total)}`,
      `Observación: ${observacion}`
    ].join('\n');

    const apiKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('MAIL_FROM');
    const to = Deno.env.get('MAIL_TO');

    if (!apiKey || !from || !to) {
      throw new Error('Faltan secretos RESEND_API_KEY, MAIL_FROM o MAIL_TO');
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Nuevo pedido ${safe(folio)} - Tu Dulce Día`,
        html,
        text
      })
    });

    const body = await res.text();
    if (!res.ok) {
      throw new Error(body);
    }

    return new Response(JSON.stringify({ ok: true, provider: 'resend', response: body }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error?.message || error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
