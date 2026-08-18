function norm(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const pageText = () => document.body?.innerText || '';
function valueByLabel(labels) {
  const wanted = labels.map(value => norm(value).toLowerCase());
  const nodes = [...document.querySelectorAll('label, span, div, p')];
  for (const element of nodes) {
    const text = norm(element.textContent).toLowerCase();
    if (!wanted.some(value => text === value || text.startsWith(value))) continue;
    const forId = element.getAttribute('for');
    if (forId) { const input = document.getElementById(forId); const value = input?.value || input?.textContent; if (norm(value)) return norm(value); }
    let container = element;
    for (let i = 0; i < 4 && container; i++, container = container.parentElement) {
      const input = container.querySelector?.('input, textarea, [role="combobox"], [contenteditable="true"]');
      const value = input?.value || input?.getAttribute?.('value') || input?.textContent;
      if (norm(value) && norm(value).toLowerCase() !== text) return norm(value);
    }
  }
  return '';
}
function getTicketId() { return location.pathname.match(/\/tickets\/(\d+)/)?.[1] || pageText().match(/(?:Incidente|Ticket)\s*#?(\d+)/i)?.[1] || ''; }
function cleanDocumentNumber(value) { const digits = String(value ?? '').trim().replace(/[^0-9]/g, ''); return digits.length >= 4 && digits.length <= 20 ? digits : ''; }
function getDni() { return cleanDocumentNumber(valueByLabel(['DNI', 'DNI*'])) || cleanDocumentNumber(pageText().match(/\bDNI\s*\*?\s*[:\-]?\s*([0-9][0-9 .-]{2,24})/i)?.[1] || ''); }
function getAlumno() { const direct = valueByLabel(['Apellidos y Nombres', 'Apellidos y Nombres*']); if (direct) return direct; const match = pageText().match(/Apellidos y Nombres\s*\*?\s*[:\-]?\s*([^\n]+)/i); return match ? norm(match[1]) : ''; }
function fromComment(regex) { return norm(pageText().match(regex)?.[1] || ''); }
function getCampus() { return valueByLabel(['Campus', 'Campus*']) || fromComment(/Sede de Estudio\s*:\s*([^\n•]+)/i); }
function getTipoIngreso() { return valueByLabel(['Modalidad de ingreso', 'Modalidad de ingreso*']) || fromComment(/Modalidad(?: de ingreso)?\s*:\s*([^\n•]+)/i); }
function conversationContainers() {
  const selectors = ['section[role="feed"][data-test-id="omni-log-container"]','section[role="feed"][data-testid="omni-log-container"]','section[data-test-id="omni-log-container"]','section[data-testid="omni-log-container"]','[role="feed"][data-test-id="omni-log-container"]','[role="feed"][data-testid="omni-log-container"]'];
  const result = [], seen = new Set();
  for (const selector of selectors) document.querySelectorAll(selector).forEach(element => { if (!seen.has(element)) { seen.add(element); result.push(element); } });
  return result;
}
async function waitForConversationContainers(timeout = 20000) {
  const started = Date.now(); let lastContainers = [];
  while (Date.now() - started < timeout) { const containers = conversationContainers(); if (containers.length) { lastContainers = containers; if (containers.some(container => norm(container.innerText || container.textContent || '').length > 20)) return containers; } await sleep(500); }
  return lastContainers;
}
async function loadConversation(container) {
  if (!container) return;
  try { container.scrollTop = container.scrollHeight; await sleep(500); let previousHeight = -1, stable = 0; for (let i = 0; i < 24; i++) { container.scrollTop = 0; await sleep(350); const currentHeight = container.scrollHeight; stable = currentHeight === previousHeight ? stable + 1 : 0; previousHeight = currentHeight; if (stable >= 3) break; } container.scrollTop = container.scrollHeight; await sleep(300); } catch (_) {}
}
async function detectOrigin() {
  const containers = await waitForConversationContainers();
  if (!containers.length) return {origen:'REVISAR',origenDetectado:false,motivoOrigen:'No se encontró el historial de Zendesk'};
  for (const container of containers) await loadConversation(container);
  await sleep(700);
  const text = norm(containers.map(container => container.innerText || container.textContent || '').join(' ')).toUpperCase();
  const isPortal = /\bPORTAL\b/.test(text);
  return {origen:isPortal?'PORTAL':'ZENDESK',origenDetectado:true,motivoOrigen:isPortal?'Se encontró PORTAL dentro del historial':'Se revisó el historial y no se encontró PORTAL'};
}
function parseViewDate(value) {
  const raw = norm(value); if (!raw) return {iso:'',text:''}; const now = new Date(), result = new Date(now); result.setSeconds(0,0);
  const timeMatch = raw.match(/(\d{1,2}):(\d{2})/), hour = timeMatch ? Number(timeMatch[1]) : 12, minute = timeMatch ? Number(timeMatch[2]) : 0; const lower = norm(raw).toLowerCase();
  if (lower.startsWith('hoy')) result.setHours(hour,minute,0,0); else if (lower.startsWith('ayer')) { result.setDate(result.getDate()-1); result.setHours(hour,minute,0,0); }
  else { const weekdays={domingo:0,lunes:1,martes:2,miercoles:3,jueves:4,viernes:5,sabado:6}; const dayName=Object.keys(weekdays).find(name=>lower.startsWith(name)); if(dayName){const target=weekdays[dayName];let difference=(result.getDay()-target+7)%7;if(difference===0)difference=7;result.setDate(result.getDate()-difference);result.setHours(hour,minute,0,0);}else{const monthMap={ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sep:8,oct:9,nov:10,dic:11};const match=lower.match(/\b(\d{1,2})[\.\s\/-]+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\.?\b/);if(!match)return{iso:'',text:raw};result.setMonth(monthMap[match[2]],Number(match[1]));result.setHours(hour,minute,0,0);if(result>now)result.setFullYear(result.getFullYear()-1);}}
  return {iso:result.toISOString(),text:`${String(result.getDate()).padStart(2,'0')}/${String(result.getMonth()+1).padStart(2,'0')}/${result.getFullYear()}`};
}
async function extractTicket() {
  const originInfo = await detectOrigin();
  const data={idTicket:getTicketId(),dni:getDni(),alumno:getAlumno(),campus:getCampus(),tipoConvalidacion:'Expediente',tipoIngreso:getTipoIngreso(),origen:originInfo.origen,origenDetectado:originInfo.origenDetectado,motivoOrigen:originInfo.motivoOrigen,observacion:''};
  const issues=[];if(!data.idTicket)issues.push('ID no encontrado');if(!data.dni)issues.push('DNI no encontrado');if(!data.alumno)issues.push('Alumno no encontrado');if(!data.origenDetectado)issues.push('Origen por revisar');data.observacion=issues.join('; ');return data;
}
function normalizedHeader(value){return norm(value).toLowerCase();}
function findHeaderIndexes(row){const cells=[...row.querySelectorAll('th, td, [role="columnheader"], [role="cell"], [role="gridcell"]')],headers=cells.map(cell=>normalizedHeader(cell.innerText||cell.textContent||'')),indexes={};headers.forEach((header,index)=>{if(header==='id'||header.includes('id-ticket'))indexes.id=index;if(header==='dni')indexes.dni=index;if(header.includes('apellidos y nombres'))indexes.alumno=index;if(header==='campus')indexes.campus=index;if(header.startsWith('solicitado'))indexes.solicitado=index;if(header.startsWith('actualizacion'))indexes.actualizacion=index;});return Object.keys(indexes).length>=3?indexes:null;}
function findTableSchema(){for(const row of [...document.querySelectorAll('tr, [role="row"]')]){const text=normalizedHeader(row.innerText||row.textContent||'');if(text.includes('dni')&&text.includes('apellidos y nombres')&&text.includes('actualizacion')){const indexes=findHeaderIndexes(row);if(indexes)return indexes;}}return null;}
function getRowCells(row){return [...row.querySelectorAll('td, [role="cell"], [role="gridcell"]')].map(element=>norm(element.innerText||element.textContent||''));}
function rowDataFromElement(row,schema=null){const rawLines=String(row.innerText||row.textContent||'').split(/\n+/).map(norm).filter(Boolean),text=rawLines.join(' | '),cells=getRowCells(row);let id='',dni='',alumno='',campus='',actualizacion='';if(schema&&cells.length){id=cells[schema.id]?.match(/#?(\d{6,})/)?.[1]||'';dni=cleanDocumentNumber(cells[schema.dni]||'');alumno=cells[schema.alumno]||'';campus=cells[schema.campus]||'';actualizacion=cells[schema.actualizacion]||'';}if(!id)id=text.match(/#?(\d{6,})\b/)?.[1]||'';if(!id)return null;if(!dni)dni=rawLines.map(cleanDocumentNumber).find(value=>value&&value!==id)||'';if(!alumno&&dni){const dniIndex=rawLines.findIndex(value=>value===dni);if(dniIndex>=0)alumno=rawLines[dniIndex+1]||'';}if(!actualizacion){const dateCandidates=rawLines.filter(value=>/^(?:\d{1,2}[\.\s\/-]+[a-záéíóú]{3,}\.?|ayer|hoy|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)/i.test(value));actualizacion=dateCandidates.at(-1)||'';}const parsedDate=parseViewDate(actualizacion);return{idTicket:id,dni,alumno,campusVista:campus,fechaActualizacionVista:actualizacion,fechaInicio:parsedDate.iso,fechaInicioTexto:parsedDate.text};}
function currentViewRows(){const map=new Map(),schema=findTableSchema(),candidates=[...document.querySelectorAll('tr'),...document.querySelectorAll('[role="row"]')];for(const row of candidates){const data=rowDataFromElement(row,schema);if(data?.idTicket){const previous=map.get(data.idTicket)||{};map.set(data.idTicket,{...previous,...Object.fromEntries(Object.entries(data).filter(([,value])=>value!==''))});}}document.querySelectorAll('a[href*="/agent/tickets/"]').forEach(link=>{const id=link.href.match(/\/agent\/tickets\/(\d+)/)?.[1];if(!id)return;const row=link.closest('tr, [role="row"]'),data=row?rowDataFromElement(row,schema):{idTicket:id},previous=map.get(id)||{};map.set(id,{...previous,...data});});return[...map.values()];}
function mergeTicketRows(target,items){for(const item of items||[]){if(!item?.idTicket)continue;const previous=target.get(item.idTicket)||{};target.set(item.idTicket,{...previous,...Object.fromEntries(Object.entries(item).filter(([,value])=>value!==''))});}}
function paginationInfo(){const text=norm(pageText()),pageMatch=text.match(/Pagina\s+(\d+)\s+de\s+(\d+)/i),totalMatch=text.match(/([\d.,]+)\s+tickets?\s*\(\s*Pagina\s+\d+\s+de\s+\d+\s*\)/i);return{current:pageMatch?Number(pageMatch[1]):1,total:pageMatch?Number(pageMatch[2]):1,expected:totalMatch?Number(totalMatch[1].replace(/[^0-9]/g,'')):0};}
function controlText(element){return norm([element?.innerText,element?.textContent,element?.getAttribute?.('aria-label'),element?.getAttribute?.('title')].filter(Boolean).join(' ')).toLowerCase();}
function findPaginationControl(label){const wanted=norm(label).toLowerCase();return [...document.querySelectorAll('button, a, [role="button"]')].find(element=>{const text=controlText(element);return text===wanted||text.startsWith(`${wanted} `);})||null;}
function controlDisabled(element){if(!element)return true;return Boolean(element.disabled||element.getAttribute('disabled')!==null||element.getAttribute('aria-disabled')==='true'||/disabled|is-disabled/.test(String(element.className||'').toLowerCase()));}
function visibleTicketSignature(){return currentViewRows().map(item=>String(item.idTicket)).sort().join('|');}
async function waitForViewReady(timeout=25000){const started=Date.now();let lastSignature='',stable=0;while(Date.now()-started<timeout){const signature=visibleTicketSignature();if(signature){stable=signature===lastSignature?stable+1:0;lastSignature=signature;if(stable>=2)return;}await sleep(450);}}
async function waitForPageChange(previousPage,previousSignature,timeout=30000){const started=Date.now();while(Date.now()-started<timeout){const info=paginationInfo(),signature=visibleTicketSignature();if((info.current&&info.current!==previousPage)||(signature&&signature!==previousSignature)){await waitForViewReady();return;}await sleep(450);}throw new Error('Zendesk no terminó de cargar la página siguiente');}
function findViewScroller(){const candidates=[...document.querySelectorAll('*')].filter(element=>{const style=getComputedStyle(element);return/(auto|scroll)/.test(style.overflowY)&&element.scrollHeight>element.clientHeight+80;}).map(element=>{const ticketLinks=element.querySelectorAll?.('a[href*="/agent/tickets/"]').length||0,headerText=normalizedHeader(element.innerText||element.textContent||''),hasViewHeaders=headerText.includes('dni')&&headerText.includes('apellidos y nombres'),score=ticketLinks*10000+(hasViewHeaders?5000:0)+element.clientHeight;return{element,score};}).sort((a,b)=>b.score-a.score);return candidates[0]?.element||document.scrollingElement;}
async function collectCurrentPageRows(){const map=new Map(),scroller=findViewScroller();if(!scroller){mergeTicketRows(map,currentViewRows());return[...map.values()];}const start=scroller.scrollTop;scroller.scrollTop=0;await sleep(300);let last=-1,stable=0;for(let i=0;i<80;i++){mergeTicketRows(map,currentViewRows());const nextTop=Math.min(scroller.scrollTop+Math.max(450,scroller.clientHeight*.82),scroller.scrollHeight);scroller.scrollTop=nextTop;await sleep(300);stable=scroller.scrollTop===last?stable+1:0;last=scroller.scrollTop;if(stable>=2||scroller.scrollTop+scroller.clientHeight>=scroller.scrollHeight-4)break;}mergeTicketRows(map,currentViewRows());scroller.scrollTop=start;return[...map.values()];}
function emitScanProgress(data){chrome.runtime.sendMessage({type:'VIEW_SCAN_PROGRESS',...data}).catch(()=>{});}
async function goToFirstPage(){let info=paginationInfo();if(info.current<=1)return;const first=findPaginationControl('Primera');if(first&&!controlDisabled(first)){const signature=visibleTicketSignature();first.click();await waitForPageChange(info.current,signature);return;}for(let i=0;i<100;i++){info=paginationInfo();if(info.current<=1)return;const previous=findPaginationControl('Anterior');if(!previous||controlDisabled(previous))return;const signature=visibleTicketSignature();previous.click();await waitForPageChange(info.current,signature);}}
async function allViewRows(){const allRows=new Map();await waitForViewReady();await goToFirstPage();await waitForViewReady();let pagesRead=0,lastPage=0,lastSignature='';for(let safety=0;safety<100;safety++){const info=paginationInfo(),pageNumber=info.current||pagesRead+1,signature=visibleTicketSignature();if(pageNumber===lastPage&&signature===lastSignature)break;const rows=await collectCurrentPageRows();mergeTicketRows(allRows,rows);pagesRead++;lastPage=pageNumber;lastSignature=signature;emitScanProgress({currentPage:pageNumber,totalPages:info.total||pageNumber,detected:allRows.size,expected:info.expected||0});const next=findPaginationControl('Siguiente'),reachedLastPage=(info.total>0&&pageNumber>=info.total)||!next||controlDisabled(next);if(reachedLastPage)break;next.click();await waitForPageChange(pageNumber,signature);}try{await goToFirstPage();}catch(_){}const finalInfo=paginationInfo();emitScanProgress({currentPage:pagesRead,totalPages:pagesRead,detected:allRows.size,expected:finalInfo.expected||allRows.size,finished:true});return{items:[...allRows.values()],pagesRead,expected:finalInfo.expected||0};}
chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{if(message?.type==='EXTRACT_TICKET'){extractTicket().then(data=>sendResponse({ok:true,data})).catch(error=>sendResponse({ok:false,message:error.message}));return true;}if(message?.type==='EXTRACT_VIEW_ROWS'){allViewRows().then(result=>sendResponse({ok:true,...result})).catch(error=>sendResponse({ok:false,message:error.message}));return true;}});