// Tu Dulce Dia - flujo controlado catalogo Supabase
// Este archivo solo se usa en catalogo-supabase-form-test.html.
// No modifica index.html ni el flujo productivo actual.

(function () {
  const API_FORMAL = 'https://script.google.com/macros/s/AKfycbzmPICimq95KQ4GLloWbgeoonhTWBjzUM7J7kMbz32r9qiooqzC_MY4e2IADroA8Rnl/exec';
  const WA_NUMBER = '56930210411';
  const money = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

  function q(selector) { return document.querySelector(selector); }
  function all(selector) { return Array.from(document.querySelectorAll(selector)); }

  function productSection() { return q('section.box'); }
  function formSection() { return q('aside.box'); }

  function selectedCount() {
    return all('.product.selected').reduce(function (sum, card) {
      const qty = parseInt((card.querySelector('.qty') || {}).value || '1', 10) || 1;
      return sum + qty;
    }, 0);
  }

  function activeStep(n) {
    all('.td-step').forEach(function (step, idx) {
      step.classList.toggle('active', idx === n - 1);
    });
  }

  function showStep(n) {
    const p = productSection();
    const f = formSection();
    const r = q('#tdResultSection');
    if (p) p.classList.toggle('td-hidden', n !== 1);
    if (f) f.classList.toggle('td-hidden', n !== 2);
    if (r) r.classList.toggle('td-hidden', n !== 3);
    document.body.dataset.tdCurrentStep = String(n);
    activeStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function addSteps() {
    if (q('#tdSteps')) return;
    const wrap = q('.wrap');
    if (!wrap) return;
    const steps = document.createElement('div');
    steps.id = 'tdSteps';
    steps.className = 'td-steps';
    steps.innerHTML = '<span class="td-step active">1. Productos</span><span class="td-step">2. Datos</span><span class="td-step">3. Resultado</span>';
    const grid = q('.grid');
    wrap.insertBefore(steps, grid || wrap.firstChild);
  }

  function addProductActions() {
    const p = productSection();
    if (!p || q('#tdGoForm')) return;
    const box = document.createElement('div');
    box.className = 'td-section-actions';
    box.innerHTML = '<button id="tdGoForm" type="button" class="primary">Continuar con mis datos</button>';
    p.appendChild(box);
    q('#tdGoForm').onclick = function () {
      if (selectedCount() < 1) {
        const status = q('#status');
        if (status) {
          status.className = 'msg err';
          status.textContent = 'Selecciona al menos un producto para continuar.';
        }
        return;
      }
      showStep(2);
    };
  }

  function addFormActions() {
    const f = formSection();
    if (!f || q('#tdBackProducts')) return;
    const h = f.querySelector('h2');
    const back = document.createElement('div');
    back.className = 'td-section-actions td-top-actions';
    back.innerHTML = '<button id="tdBackProducts" type="button" class="secondary">← Volver a productos</button>';
    if (h) h.insertAdjacentElement('afterend', back);
    else f.insertAdjacentElement('afterbegin', back);
    q('#tdBackProducts').onclick = function () { showStep(1); };
  }

  function ensureResultSection() {
    if (q('#tdResultSection')) return q('#tdResultSection');
    const wrap = q('.wrap');
    const result = document.createElement('section');
    result.id = 'tdResultSection';
    result.className = 'td-result-card td-hidden';
    result.innerHTML = '<h2>Pedido recibido</h2><p>Estamos preparando el resultado de tu pedido.</p>';
    const grid = q('.grid');
    if (wrap && grid) wrap.insertBefore(result, grid.nextSibling);
    else document.body.appendChild(result);
    return result;
  }

  function applyVisualLayer() {
    if (!q('#tdVisualLayer')) {
      const style = document.createElement('style');
      style.id = 'tdVisualLayer';
      style.textContent = `
        .wrap{width:min(1180px,calc(100% - 48px))!important;padding-top:22px!important}
        h1{font-size:clamp(2rem,4vw,2.8rem)!important;margin-bottom:2px!important}.lead{margin-bottom:12px!important;font-size:1rem!important}.notice{margin-bottom:14px!important;padding:11px 13px!important;border-radius:16px!important}
        .grid{grid-template-columns:1fr!important;gap:16px!important;align-items:start!important;justify-content:center!important}
        .box{border-radius:22px!important;padding:16px!important;width:100%!important;margin:0 auto!important}
        body[data-td-current-step="1"] section.box{width:min(1180px,100%)!important}
        body[data-td-current-step="2"] aside.box{width:min(620px,100%)!important}
        .products{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:12px!important}
        .product{padding:13px!important;border-radius:18px!important}.product h3{font-size:.96rem!important}.desc{font-size:.84rem!important}.price{font-size:1.22rem!important}.payload{display:none!important}#status.ok{font-size:.9rem!important;padding:10px 12px!important}button[type="submit"]{width:100%!important;margin-top:4px!important}
        .td-hidden{display:none!important}.td-steps{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:10px auto 16px;width:min(760px,100%)}.td-step{border:1px solid #ead8bd;background:#fffdf8;color:#7d5b3f;border-radius:999px;padding:8px 12px;font-weight:950}.td-step.active{background:#48663f;color:#fff}.td-section-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.td-section-actions button,.td-section-actions a{flex:1;min-width:180px}.td-top-actions{margin-top:0;margin-bottom:12px}.td-result-card{width:min(620px,100%);margin:0 auto;background:#fffdf8;border:1px solid #ead8bd;border-radius:22px;padding:24px;box-shadow:0 14px 34px #56382022;text-align:center}.td-result-card h2{font-size:2rem;margin:0 0 8px}.td-result-card p{color:#7d5b3f;font-weight:850}.td-folio{display:inline-flex;background:#fff3df;border:1px solid #ead8bd;border-radius:999px;padding:10px 16px;font-weight:1000;margin:8px 0 12px}.td-result-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:16px}.td-result-actions a{min-width:210px}
        @media(max-width:1120px){.wrap{width:min(900px,calc(100% - 32px))!important}.products{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
        @media(max-width:640px){.wrap{width:calc(100% - 22px)!important;padding-top:14px!important}.products{grid-template-columns:1fr!important}.phone{grid-template-columns:1fr!important}.td-result-actions a{width:100%}}
      `;
      document.head.appendChild(style);
    }

    document.title = 'Tu Dulce Día | Catálogo';
    const h1 = q('h1'); if (h1) h1.textContent = 'Tu Dulce Día';
    const lead = q('.lead'); if (lead) lead.textContent = 'Catálogo de pedidos';
    const notice = q('.notice'); if (notice) notice.textContent = 'Galletas con 1 día de anticipación. Pan de masa madre con 3 días de anticipación.';
    const productsTitle = q('section.box h2'); if (productsTitle) productsTitle.textContent = '1. Elige tus productos';
    const orderTitle = q('aside.box h2'); if (orderTitle) orderTitle.textContent = '2. Datos del pedido';

    addSteps();
    addProductActions();
    addFormActions();
    ensureResultSection();
    if (!document.body.dataset.tdFlowStarted) {
      document.body.dataset.tdFlowStarted = '1';
      showStep(1);
    }
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
      const timer = setTimeout(function () { cleanup(); reject(new Error('No hubo respuesta del servidor.')); }, 15000);
      function cleanup() { clearTimeout(timer); delete window[cb]; script.remove(); }
      window[cb] = function (data) { cleanup(); resolve(data); };
      script.onerror = function () { cleanup(); reject(new Error('No se pudo conectar con el servidor.')); };
      const params = new URLSearchParams({ action: 'registrarPedido', callback: cb, payload: JSON.stringify(payload) });
      script.src = API_FORMAL + '?' + params.toString();
      document.body.appendChild(script);
    });
  }

  function buildItemsText(payload) {
    const items = payload.productosSeleccionados || [];
    if (!items.length) return '';
    return items.map(function (item) { return '- ' + item.nombre + ' x ' + item.cantidad + ' = ' + money.format(item.subtotal || 0); }).join('\n');
  }

  function buildWhatsappUrl(folio, payload) {
    const lines = ['Hola Tu Dulce Día 😊','Hice un pedido desde el catálogo.','Folio: ' + folio,'Nombre: ' + payload.nombreCliente,'Total estimado: ' + money.format(payload.totalEstimado),'Fecha solicitada: ' + payload.fechaSolicitada,'','Detalle:',buildItemsText(payload),'','Quedo atento/a a la confirmación de disponibilidad y pago.'];
    if (payload.observacion) lines.splice(lines.length - 1, 0, 'Observación: ' + payload.observacion, '');
    return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(lines.join('\n'));
  }

  function showFinal(data, payload) {
    const folio = data && (data.folio || data.numeroPedido || (data.pedido && data.pedido.folio)) || 'Pedido recibido';
    const url = buildWhatsappUrl(folio, payload);
    const payloadBox = q('#payload');
    if (payloadBox) { payloadBox.style.display = 'none'; payloadBox.textContent = ''; }
    const result = ensureResultSection();
    result.innerHTML = '<h2>Pedido recibido</h2><p>Tu pedido fue registrado correctamente.</p><div class="td-folio">Folio: ' + folio + '</div><p>Total estimado: ' + money.format(payload.totalEstimado) + '</p><p>Fecha solicitada: ' + payload.fechaSolicitada + '</p><div class="td-result-actions"><a class="btn green" target="_blank" rel="noopener" href="' + url + '">Enviar WhatsApp</a><a class="btn secondary" href="./">Volver al catálogo</a></div>';
    showStep(3);
  }

  function overrideSubmit() {
    applyVisualLayer();
    const form = q('#form');
    const btn = form && form.querySelector('button[type="submit"]');
    if (!form || !btn || !window.buildPayload) return false;
    btn.textContent = 'Enviar pedido';
    form.onsubmit = async function (event) {
      event.preventDefault();
      const payload = window.buildPayload();
      const err = validate(payload);
      const payloadBox = q('#payload');
      if (payloadBox) { payloadBox.style.display = 'none'; payloadBox.textContent = ''; }
      if (err) { setMsg(err, 'err'); return; }
      btn.disabled = true;
      setMsg('Enviando pedido...', 'ok');
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
    applyVisualLayer();
    if (!overrideSubmit()) setTimeout(boot, 300);
  }

  boot();
})();
