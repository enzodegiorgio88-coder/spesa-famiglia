// ======================================================
//  UI.JS — INTERFACCIA GRAFICA DELLA LISTA SPESA
// ======================================================

import { 
  data, emptyRow, ensureRows, saveToFirebase, 
  handlePhoto, addRow, clearDone, buildListText,
  inviaNotificaUrgente
} from "./app.js";

export let currentTab = 0;
export let currentView = 'tab';

// ------------------------------------------------------
// RENDER COMPLETO
// ------------------------------------------------------
window.renderAll = function () {
  for (let c = 0; c < 3; c++) {
    renderCol(c, 'list-' + c);
    renderCol(c, 'all-' + c);
  }
  updateStats();
};

// ------------------------------------------------------
// RENDER COLONNA
// ------------------------------------------------------
function renderCol(col, listId) {
  const ul = document.getElementById(listId);
  if (!ul) return;

  ul.innerHTML = '';
  const isAllView = listId.startsWith('all-');
  let emptyCount = 0;

  data[col].forEach((item, i) => {
    if (isAllView && !item.text.trim() && !item.photo) return;

    if (!isAllView) {
      if (!item.text && !item.photo) {
        emptyCount++;
        if (emptyCount > 5) return;
      } else emptyCount = 0;
    }

    ul.appendChild(makeRow(col, i, item));
  });
}

// ------------------------------------------------------
// COSTRUZIONE RIGA
// ------------------------------------------------------
function makeRow(col, i, item) {
  const li = document.createElement('li');
  li.className = 'item-row' + (item.urgent && !item.done ? ' urgent' : '');

  // ---------------------------
  // RIGA PRINCIPALE
  // ---------------------------
  const inner = document.createElement('div');
  inner.className = 'item-inner';

  // CHECKBOX
  const chk = document.createElement('button');
  chk.className = 'chk' + (item.done ? ' done-' + col : '');
  chk.textContent = item.done ? '✓' : '';
  chk.onclick = () => {
    item.done = !item.done;

    if (!item.actions) item.actions = [];
    const label = (item.done ? 'spuntato' : 'despuntato') + ' da ' + item.author;
    if (!item.actions.length || item.actions[item.actions.length - 1] !== label)
      item.actions.push(label);

    item.lastAction = item.actions.join(' · ');
    saveToFirebase();
    renderAll();
  };

  // FOTO
  const photoWrap = document.createElement('div');
  photoWrap.style.flexShrink = '0';

  if (item.photo) {
    const box = document.createElement('div');
    box.className = 'photo-box';

    const img = document.createElement('img');
    img.src = item.photo;
    img.onclick = () => openZoom(item.photo);

    const del = document.createElement('button');
    del.className = 'photo-del';
    del.textContent = '✕';
    del.onclick = e => {
      e.stopPropagation();
      item.photo = null;
      saveToFirebase();
      renderAll();
    };

    box.appendChild(img);
    box.appendChild(del);
    photoWrap.appendChild(box);

  } else {
    const label = document.createElement('label');
    const ph = document.createElement('div');
    ph.className = 'photo-placeholder';
    ph.innerHTML = '<span>📷</span><span>foto</span>';

    const fi = document.createElement('input');
    fi.type = 'file';
    fi.accept = 'image/*';
    fi.style.display = 'none';
    fi.onchange = e => handlePhoto(col, i, e);

    label.appendChild(ph);
    label.appendChild(fi);
    photoWrap.appendChild(label);
  }

  // INPUT TESTO
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'item-input' + (item.done ? ' done' : '');
  inp.value = item.text;
  inp.placeholder = 'Articolo ' + (i + 1) + '...';

  let typingLogged = false;
  const wasNew = !item.text.trim();

  inp.oninput = () => {
    item.text = inp.value;

    if (!typingLogged) {
      typingLogged = true;

      if (!item.actions) item.actions = [];
      const label = wasNew ? 'aggiunto da ' + item.author : 'modificato da ' + item.author;

      if (wasNew) item.author = item.author;
      if (!item.actions.length || item.actions[item.actions.length - 1] !== label)
        item.actions.push(label);

      item.lastAction = item.actions.join(' · ');
    }

    let authDiv = li.querySelector('.item-author');
    if (!authDiv) {
      authDiv = document.createElement('div');
      authDiv.className = 'item-author';
      li.appendChild(authDiv);
    }
    authDiv.textContent = item.lastAction || '';

    saveToFirebase();
    updateStats();
  };

  inp.onkeydown = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const rows = Array.from(document.querySelectorAll('#list-' + col + ' .item-input'));
      const idx = rows.indexOf(inp);
      if (idx < rows.length - 1) rows[idx + 1].focus();
      else addRow(col);
    }
  };

  // DELETE
  const del = document.createElement('button');
  del.className = 'del-btn';
  del.textContent = '✕';
  del.onclick = () => {
    data[col].splice(i, 1);
    ensureRows(col);
    saveToFirebase();
    renderAll();
  };

  inner.appendChild(chk);
  inner.appendChild(photoWrap);
  inner.appendChild(inp);
  inner.appendChild(del);

  // ---------------------------
  // EXTRA (QTY, URGENTE, PREZZO)
  // ---------------------------
  const extra = document.createElement('div');
  extra.className = 'item-extra';

  // QTY
  const qWrap = document.createElement('div');
  qWrap.className = 'qty-wrap';

  const qm = document.createElement('button');
  qm.className = 'qty-btn';
  qm.textContent = '−';
  qm.onclick = () => {
    if (item.qty > 1) {
      item.qty--;
      saveToFirebase();
      renderAll();
    }
  };

  const qv = document.createElement('span');
  qv.className = 'qty-val';
  qv.textContent = 'x' + item.qty;

  const qp = document.createElement('button');
  qp.className = 'qty-btn';
  qp.textContent = '+';
  qp.onclick = () => {
    item.qty++;
    saveToFirebase();
    renderAll();
  };

  qWrap.appendChild(qm);
  qWrap.appendChild(qv);
  qWrap.appendChild(qp);

  // URGENTE
  const prBtn = document.createElement('button');
  prBtn.className = 'priority-btn' + (item.urgent ? ' urgent' : '');
  prBtn.textContent = item.urgent ? '🔴 Urgente' : '⚪ Normale';

  prBtn.onclick = () => {
    item.urgent = !item.urgent;

    if (item.urgent && item.text.trim())
      inviaNotificaUrgente(item.text, item.author);

    saveToFirebase();
    renderAll();
  };

  extra.appendChild(qWrap);
  extra.appendChild(prBtn);

  // PREZZO (solo dopo release)
  const NOVITA_RELEASE = new Date('2026-07-01T00:00:00');
  if (new Date() >= NOVITA_RELEASE) {
    const pWrap = document.createElement('div');
    pWrap.className = 'price-wrap';

    const pIcon = document.createElement('span');
    pIcon.className = 'price-icon';
    pIcon.textContent = '€';

    const pInp = document.createElement('input');
    pInp.type = 'number';
    pInp.className = 'price-input';
    pInp.placeholder = '0.00';
    pInp.step = '0.01';
    pInp.min = '0';
    pInp.value = item.price || '';

    pInp.oninput = () => {
      item.price = pInp.value;
      saveToFirebase();
      updateStats();
    };

    pWrap.appendChild(pIcon);
    pWrap.appendChild(pInp);

    if (item.price && item.qty > 1) {
      const pLine = document.createElement('span');
      pLine.className = 'price-line';
      pLine.textContent = '= €' + (parseFloat(item.price) * item.qty).toFixed(2);
      pWrap.appendChild(pLine);
    }

    extra.appendChild(pWrap);
  }

  li.appendChild(inner);
  li.appendChild(extra);

  // AUTORE
  if (item.lastAction) {
    const auth = document.createElement('div');
    auth.className = 'item-author';
    auth.textContent = item.lastAction;
    li.appendChild(auth);
  }

  return li;
}

// ------------------------------------------------------
// STATISTICHE
// ------------------------------------------------------
function updateStats() {
  const all = data.flat().filter(r => r.text.trim() || r.photo);
  const done = all.filter(r => r.done);
  const urg = all.filter(r => r.urgent && !r.done);

  const pct = all.length ? Math.round(done.length / all.length * 100) : 0;

  document.getElementById('progFill').style.width = pct + '%';
  document.getElementById('doneCount').textContent = done.length;
  document.getElementById('urgCount').textContent = urg.length;
  document.getElementById('totCount').textContent = all.length;

  for (let c = 0; c < 3; c++) {
    document.getElementById('b' + c).textContent =
      data[c].filter(r => r.text.trim() || r.photo).length;
  }

  // Totale prezzi
  let totale = 0;
  let conPrezzo = 0;

  data.flat().forEach(r => {
    if (r.price && parseFloat(r.price) > 0) {
      totale += parseFloat(r.price) * (r.qty || 1);
      conPrezzo++;
    }
  });

  const afterRelease = new Date() >= new Date('2026-07-01T00:00:00');
  document.getElementById('totaleBar').style.display = afterRelease ? 'flex' : 'none';

  document.getElementById('totaleAmount').textContent =
    totale.toFixed(2).replace('.', ',');

  document.getElementById('totaleDetail').textContent =
    conPrezzo + (conPrezzo === 1 ? ' articolo con prezzo' : ' articoli con prezzo');

  // Bottone urgenti
  const urgBtn = document.getElementById('btnUrgenti');
  const urgBtnCount = document.getElementById('urgBtnCount');

  if (urg.length > 0) {
    urgBtn.style.display = 'flex';
    urgBtnCount.textContent = urg.length;
  } else {
    urgBtn.style.display = 'none';
  }
}

// ------------------------------------------------------
// ZOOM FOTO
// ------------------------------------------------------
window.openZoom = src => {
  document.getElementById('zoomImg').src = src;
  document.getElementById('zoom').classList.add('show');
};

window.closeZoom = () => {
  document.getElementById('zoom').classList.remove('show');
};

// ------------------------------------------------------
// TABS
// ------------------------------------------------------
window.showTab = i => {
  currentTab = i;

  document.querySelectorAll('.tab').forEach((t, ti) =>
    t.classList.toggle('active', ti === i)
  );

  document.querySelectorAll('.panel').forEach((p, pi) =>
    p.classList.toggle('active', pi === i)
  );
};

// ------------------------------------------------------
// VISTA TUTTO / PER CATEGORIA
// ------------------------------------------------------
window.setView = v => {
  currentView = v;
  const isTab = v === 'tab';

  document.getElementById('tabsBar').style.display = isTab ? 'flex' : 'none';
  document.querySelectorAll('.panel').forEach(p => p.style.display = isTab ? '' : 'none');
  document.getElementById('allView').style.display = isTab ? 'none' : 'block';

  document.getElementById('btnTab').classList.toggle('active', isTab);
  document.getElementById('btnAll').classList.toggle('active', !isTab);

  if (isTab) showTab(currentTab);
};

// ------------------------------------------------------
// MODALE URGENTI
// ------------------------------------------------------
window.openUrgentiModal = () => {
  const body = document.getElementById('urgentiBody');
  body.innerHTML = '';

  let totalUrg = 0;

  const LABELS_URGENTI = ['🏠 Casa', '👤 Persona', '🛒 Alimentari'];
  const COLORS_URGENTI = ['#FF6B6B', '#4ECDC4', '#45B7D1'];

  for (let c = 0; c < 3; c++) {
    const items = data[c].filter(r => r.urgent && !r.done && r.text.trim());
    if (!items.length) continue;

    totalUrg += items.length;

    const cat = document.createElement('div');
    cat.className = 'urg-category';

    const title = document.createElement('div');
    title.className = 'urg-cat-title';

    const dot = document.createElement('span');
    dot.style.cssText = `
      width:10px;height:10px;border-radius:50%;
      background:${COLORS_URGENTI[c]};
      flex-shrink:0;display:inline-block;
    `;

    title.appendChild(dot);
    title.appendChild(document.createTextNode(' ' + LABELS_URGENTI[c]));
    cat.appendChild(title);

    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'urg-item';

      const txt = document.createElement('span');
      txt.className = 'urg-item-text';
      txt.textContent = item.text;
      row.appendChild(txt);

      if (item.qty > 1) {
        const qty = document.createElement('span');
        qty.className = 'urg-item-qty';
        qty.textContent = 'x' + item.qty;
        row.appendChild(qty);
      }

      if (item.price && parseFloat(item.price) > 0) {
        const totPrice = parseFloat(item.price) * (item.qty || 1);
        const priceSpan = document.createElement('span');
        priceSpan.className = 'urg-item-price';
        priceSpan.textContent = '€ ' + totPrice.toFixed(2).replace('.', ',');
        row.appendChild(priceSpan);
      }

      cat.appendChild(row);
    });

    body.appendChild(cat);
  }

  if (totalUrg === 0) {
    body.innerHTML = `
      <div class="urg-empty">
        🎉 Nessun articolo urgente!
        <br><span style="font-size:13px;font-weight:600;">Tutto sotto controllo.</span>
      </div>`;
  }

  document.getElementById('urgModalSub').textContent =
    totalUrg > 0
      ? totalUrg + (totalUrg === 1 ? ' articolo da prendere' : ' articoli da prendere')
      : 'Nessun urgente';

  document.getElementById('urgentiModal').classList.add('show');
};

window.closeUrgentiModal = e => {
  if (!e || e.target === document.getElementById('urgentiModal'))
    document.getElementById('urgentiModal').classList.remove('show');
};

// ------------------------------------------------------
// MODALE COPIA LISTA
// ------------------------------------------------------
window.openCopyModal = () => {
  const text = buildListText();
  if (!text) return showToast('⚠️ La lista è vuota!');

  document.getElementById('copyPreview').textContent = text;
  document.getElementById('copyModal').classList.add('show');
};

window.closeCopyModal = e => {
  if (!e || e.target === document.getElementById('copyModal'))
    document.getElementById('copyModal').classList.remove('show');
};

window.doCopy = () => {
  const text = document.getElementById('copyPreview').textContent;

  const done = () => {
    document.getElementById('copyModal').classList.remove('show');
    showToast('✅ Lista copiata!');
  };

  if (navigator.clipboard)
    navigator.clipboard.writeText(text).then(done).catch(() => fbCopy(text, done));
  else fbCopy(text, done);
};

function fbCopy(text, cb) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  cb();
}

// ------------------------------------------------------
// TOAST
// ------------------------------------------------------
window.showToast = function (msg, dur) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur || 2500);
};

// ------------------------------------------------------
// COUNTDOWN POPUP
// ------------------------------------------------------
window.toggleCountdownPopup = function () {
  const popup = document.getElementById('countdownPopup');
  if (!popup) return;

  const isOpen = popup.style.display !== 'none';
  popup.style.display = isOpen ? 'none' : 'flex';

  if (!isOpen) aggiornaCountdown2();
};

// ------------------------------------------------------
// COUNTDOWN
// ------------------------------------------------------
const TARGET_DATE = new Date('202