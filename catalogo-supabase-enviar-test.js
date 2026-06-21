// Tu Dulce Dia - envio de prueba Apps Script para catalogo Supabase test
// Este archivo solo se usa en catalogo-supabase-form-test.html.
// No modifica index.html ni el flujo productivo.

(function () {
  const API_FORMAL = 'https://script.google.com/macros/s/AKfycbzmPICimq95KQ4GLloWbgeoonhTWBjzUM7J7kMbz32r9qiooqzC_MY4e2IADroA8Rnl/exec';
  const WA_NUMBER = '56930210411';
  const money = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

  function q(selector) {
    return document.querySelector(selector);
  }

  function setMsg(text, type) {
    const msg = q('#msg');
    if (!msg) return;
    msg.style.display = 'block';
    msg.className = 'msg ' + (type === 'err' ? 'err' : 'ok');
    msg.textContent = text;
  }

  function validate(payload) {
    if (!payload.productosSeleccionados || !payload.productosSeleccionados.length) return 'Selecciona al menos un producto.';
    if (!payload.nombreCliente || payload.nombreCliente.length < 2) return 'Ingresa el nombre.';
    if (!payload.fechaSolicitada) return 'Selecciona fecha.';
    if (!q('#consent') || !q('#consent').checked) return 'Debes aceptar contacto por WhatsApp.';
    return '';
  }

  function jsonpRegistrar(payload) {
    return new Promise(function (resolve, reject) {
      const cb = 'tdPedido_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
      const script = document.createElement('script');
      const timer = setTimeout(function () {
        cleanup();
        reject(new Error('No hubo respuesta del servidor.'));
      }, 15000);

      function cleanup() {
        clearTimeout(timer);
        delete window[cb];
        script.remove();
      }

      window[cb] = function (data) {
        cleanup();
        resolve(data);
      };

      script.onerror = function () {
        cleanup();
        reject(new Error('No se pudo conectar con el servidor.'));
      };

      const params = new URLSearchParams({
        action: 'registrarPedido',
        callback: cb,
        payload: JSON.stringify(payload),
      });

      script.src = API_FORMAL + '?' + params.toString();
      document.body.appendChild(script);
    });
  }

  function buildItemsText(payload) {
    const items = payload.productosSeleccionados || [];
    if (!items.length) return '';
    return items.map(function (item) {
      return '- ' + item.nombre + ' x ' + item.cantidad + ' = ' + money.format(item.subtotal || 0);
    }).join('\n');
  }

  function buildWhatsappUrl(folio, payload) {
    const lines = [
      'Hola Tu Dulce Día 😊',
      'Hice un pedido desde el catálogo.',
      'Folio: ' + folio,
      'Nombre: ' + payload.nombreCliente,
      'Total estimado: ' + money.format(payload.totalEstimado),
      'Fecha solicitada: ' + payload.fechaSolicitada,
      '',
      'Detalle:',
      buildItemsText(payload),
      '',
      'Quedo atento/a a la confirmación de disponibilidad y pago.'
    ];
    if (payload.observacion) {
      lines.splice(lines.length - 1, 0, 'Observación: ' + payload.observacion, '');
    }
    return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(lines.join('\n'));
  }

  function showFinal(data, payload) {
    const folio = data && (data.folio || data.numeroPedido || (data.pedido && data.pedido.folio)) || 'Pedido recibido';
    const url = buildWhatsappUrl(folio, payload);
    const payloadBox = q('#payload');
    if (payloadBox) {
      payloadBox.style.display = 'block';
      payloadBox.textContent = JSON.stringify({ respuestaServidor: data, payload }, null, 2);
    }
    setMsg('Pedido enviado correctamente. Folio: ' + folio + '\nPuedes abrir WhatsApp para avisar al negocio.', 'ok');
    const actions = document.querySelector('.actions');
    if (actions && !q('#waFinalBtn')) {
      const a = document.createElement('a');
      a.id = 'waFinalBtn';
      a.className = 'btn green';
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Abrir WhatsApp';
      actions.prepend(a);
    }
  }

  function overrideSubmit() {
    const form = q('#form');
    const btn = form && form.querySelector('button[type="submit"]');
    if (!form || !btn || !window.buildPayload) return false;

    btn.textContent = 'Enviar pedido real de prueba';
    form.onsubmit = async function (event) {
      event.preventDefault();
      const payload = window.buildPayload();
      const err = validate(payload);
      const payloadBox = q('#payload');
      if (payloadBox) {
        payloadBox.style.display = 'block';
        payloadBox.textContent = JSON.stringify(payload, null, 2);
      }
      if (err) {
        setMsg(err, 'err');
        return;
      }
      btn.disabled = true;
      setMsg('Enviando pedido real de prueba a Apps Script...', 'ok');
      try {
        const data = await jsonpRegistrar(payload);
        if (data && data.ok === false) throw new Error(data.error || 'El servidor no pudo registrar el pedido.');
        showFinal(data, payload);
      } catch (error) {
        setMsg(error.message || 'No se pudo registrar el pedido.', 'err');
      } finally {
        btn.disabled = false;
      }
    };
    return true;
  }

  function boot() {
    if (!overrideSubmit()) {
      setTimeout(boot, 300);
    }
  }

  boot();
})();
