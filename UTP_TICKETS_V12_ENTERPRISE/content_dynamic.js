(() => {
  'use strict';

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

  function cleanDocument(value) {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits.length >= 4 && digits.length <= 20 ? digits : '';
  }

  function parseCaseTitle(value) {
    const text = norm(value);
    const match = text.match(/^(CAS-[A-Z0-9-]+)\s*-\s*(U\d+)\s*-?\s*(.+)$/i);
    if (!match) return null;
    return {
      idTicket: `${match[1].toUpperCase()} - ${match[2].toUpperCase()}`,
      alumno: norm(match[3]).replace(/^[-–—]\s*/, ''),
      rawTitle: text
    };
  }

  function getGridRoot() {
    const roots = [...document.querySelectorAll('[role="grid"], [role="treegrid"], .ag-root, .ag-root-wrapper, table')];
    return roots.find(root => /CAS-|Titulo de caso|Título de caso|Numero de caso|Número de caso/i.test(root.innerText || '')) || document.body;
  }

  function getHeaders(root) {
    const cells = [...root.querySelectorAll('[role="columnheader"], th')];
    const headers = [];
    for (const cell of cells) {
      const text = norm(cell.innerText || cell.textContent || cell.getAttribute('aria-label'));
      if (text && !headers.includes(text)) headers.push(text);
    }
    return headers;
  }

  function rowCells(row) {
    return [...row.querySelectorAll('[role="gridcell"], [role="cell"], td')]
      .map(cell => norm(cell.innerText || cell.textContent || cell.getAttribute('aria-label')));
  }

  function registrationFrom(cells, headers) {
    const index = headers.findIndex(h => /fecha de registro|fecha registro/i.test(h));
    if (index >= 0 && cells[index]) return cells[index];
    return cells.find(value => /\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/.test(value)) || '';
  }

  function caseUrlFromRow(row) {
    const links = [...row.querySelectorAll('a[href]')];
    const direct = links.find(link => /CAS-/i.test(link.innerText || link.textContent || '')) || links[0];
    if (direct?.href) return direct.href;
    const clickable = row.querySelector('[data-id*="case" i], [data-lp-id*="case" i]');
    return clickable?.href || '';
  }

  function extractVisibleRows() {
    const root = getGridRoot();
    const headers = getHeaders(root);
    const map = new Map();
    const rows = [...root.querySelectorAll('[role="row"], tbody tr, .ag-row')];

    for (const row of rows) {
      const cells = rowCells(row);
      const text = norm(row.innerText || row.textContent || cells.join(' '));
      if (!/CAS-/i.test(text)) continue;

      const candidates = [...cells, ...text.split(/\n+/)].map(norm).filter(Boolean);
      let parsed = null;
      for (const candidate of candidates) {
        parsed = parseCaseTitle(candidate);
        if (parsed) break;
      }
      if (!parsed) {
        const match = text.match(/CAS-[A-Z0-9-]+\s*-\s*U\d+\s*-?\s*[^|]+/i);
        parsed = match ? parseCaseTitle(match[0]) : null;
      }
      if (!parsed?.idTicket) continue;

      const item = {
        ...parsed,
        dni: '',
        registro: registrationFrom(cells, headers),
        registroTexto: registrationFrom(cells, headers),
        caseUrl: caseUrlFromRow(row),
        origen: 'DYNAMIC',
        platform: 'DYNAMIC'
      };
      const previous = map.get(item.idTicket) || {};
      map.set(item.idTicket, {...previous, ...Object.fromEntries(Object.entries(item).filter(([,v]) => v !== ''))});
    }
    return [...map.values()];
  }

  function findScroller() {
    const candidates = [...document.querySelectorAll('.ag-body-viewport, .ag-center-cols-viewport, [role="grid"], div, section')]
      .filter(el => {
        const style = getComputedStyle(el);
        return /(auto|scroll)/.test(`${style.overflowY} ${style.overflow}`) && el.scrollHeight > el.clientHeight + 80;
      })
      .map(el => ({el, score: (el.querySelectorAll?.('.ag-row,[role="row"]')?.length || 0) * 10000 + el.clientHeight}))
      .sort((a,b) => b.score - a.score);
    return candidates[0]?.el || document.scrollingElement;
  }

  async function collectAllRows() {
    const map = new Map();
    const scroller = findScroller();
    const start = scroller?.scrollTop || 0;
    if (scroller) scroller.scrollTop = 0;
    await sleep(500);
    let stable = 0;
    let lastSize = -1;
    let lastTop = -1;

    for (let i = 0; i < 160; i++) {
      for (const item of extractVisibleRows()) {
        const previous = map.get(item.idTicket) || {};
        map.set(item.idTicket, {...previous, ...Object.fromEntries(Object.entries(item).filter(([,v]) => v !== ''))});
      }
      stable = map.size === lastSize ? stable + 1 : 0;
      lastSize = map.size;
      if (!scroller || stable >= 10) break;
      const next = Math.min(scroller.scrollTop + Math.max(350, Math.floor(scroller.clientHeight * .78)), scroller.scrollHeight);
      scroller.scrollTop = next;
      await sleep(420);
      if (scroller.scrollTop === lastTop && stable >= 3) break;
      lastTop = scroller.scrollTop;
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 3) {
        for (const item of extractVisibleRows()) map.set(item.idTicket, {...(map.get(item.idTicket)||{}), ...item});
        break;
      }
    }
    if (scroller) scroller.scrollTop = start;
    return [...map.values()];
  }

  function valueNearLabel(labels) {
    const wanted = labels.map(x => norm(x).toLowerCase());
    const nodes = [...document.querySelectorAll('label, span, div')];
    for (const node of nodes) {
      const text = norm(node.textContent).toLowerCase();
      if (!wanted.some(label => text === label || text.startsWith(label))) continue;
      const forId = node.getAttribute('for');
      if (forId) {
        const target = document.getElementById(forId);
        const value = target?.value || target?.getAttribute?.('value') || target?.textContent;
        if (cleanDocument(value)) return cleanDocument(value);
      }
      let container = node;
      for (let level = 0; level < 5 && container; level++, container = container.parentElement) {
        const target = container.querySelector?.('input, textarea, [role="textbox"], [data-id*="documento" i], [aria-label*="documento" i]');
        const value = target?.value || target?.getAttribute?.('value') || target?.innerText || target?.textContent;
        if (cleanDocument(value)) return cleanDocument(value);
        const textContainer = norm(container.innerText || container.textContent || '');
        const match = textContainer.match(/Nro\.?\s*documento\s*[:\-]?\s*([0-9][0-9 .-]{3,24})/i);
        if (match && cleanDocument(match[1])) return cleanDocument(match[1]);
      }
    }
    return '';
  }

  function currentCaseData() {
    const body = norm(document.body?.innerText || '');
    const titleMatch = body.match(/CAS-[A-Z0-9-]+\s*-\s*U\d+\s*-?\s*[^\n|]+/i);
    const parsed = titleMatch ? parseCaseTitle(titleMatch[0]) : null;
    const dni = valueNearLabel(['Nro. documento', 'Nro documento', 'Numero de documento', 'Número de documento']) ||
      cleanDocument(body.match(/Nro\.?\s*documento\s*[:\-]?\s*([0-9][0-9 .-]{3,24})/i)?.[1] || '');
    return {
      idTicket: parsed?.idTicket || '',
      alumno: parsed?.alumno || '',
      dni,
      origen: 'DYNAMIC',
      platform: 'DYNAMIC',
      caseUrl: location.href
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'DYNAMIC_EXTRACT_VIEW_ROWS') {
      collectAllRows().then(items => sendResponse({ok:true, items, total:items.length}))
        .catch(error => sendResponse({ok:false, message:error.message}));
      return true;
    }
    if (message?.type === 'DYNAMIC_EXTRACT_CASE') {
      const started = Date.now();
      (async () => {
        let data = currentCaseData();
        while (!data.dni && Date.now() - started < 18000) {
          await sleep(600);
          data = currentCaseData();
        }
        sendResponse({ok:Boolean(data.dni || data.idTicket), data});
      })().catch(error => sendResponse({ok:false, message:error.message}));
      return true;
    }
  });
})();
