const dynamicFixSleep=ms=>new Promise(r=>setTimeout(r,ms));
function dynamicFixIsActive(){return document.getElementById('tabDynamic')?.classList.contains('active');}
function dynamicFixMessage(text){const el=document.getElementById('message');if(el)el.textContent=text;}
async function dynamicFixFindTab(){
  const tabs=await chrome.tabs.query({});
  return tabs.find(t=>/^https:\/\/[^/]*\.dynamics\.com\//i.test(String(t.url||'')))||null;
}
async function dynamicFixExtract(tab){
  try{
    const r=await chrome.tabs.sendMessage(tab.id,{type:'EXTRACT_DYNAMIC_VIEW'});
    if(r?.ok)return r;
  }catch(_){ }
  dynamicFixMessage('Conectando el lector con DYNAMIC...');
  await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content_dynamic.js']});
  await dynamicFixSleep(900);
  return chrome.tabs.sendMessage(tab.id,{type:'EXTRACT_DYNAMIC_VIEW'});
}
async function dynamicFixRun(){
  try{
    const tab=await dynamicFixFindTab();
    if(!tab)throw new Error('No encuentro una pestaña de DYNAMIC. Abre “Mis casos activos” en Dynamics y vuelve a intentar.');
    dynamicFixMessage('DYNAMIC detectado. Leyendo “Mis casos activos”...');
    let r;
    try{r=await dynamicFixExtract(tab);}catch(e){
      throw new Error('DYNAMIC está abierto, pero el lector no pudo conectarse. Recarga la pestaña de Dynamics una vez y vuelve a pulsar Analizar DYNAMIC.');
    }
    if(!r?.ok)throw new Error(r?.message||'No se pudo leer DYNAMIC.');
    if(!Array.isArray(r.items)||!r.items.length)throw new Error('DYNAMIC fue detectado, pero no encontré casos CAS-... en la vista actual. Confirma que estás en “Mis casos activos”.');
    dynamicFixMessage(`DYNAMIC detectado: ${r.items.length} caso(s). Preparando análisis...`);
    const start=await chrome.runtime.sendMessage({type:'START_DYNAMIC',items:r.items,tabId:tab.id});
    if(start&&start.ok===false)throw new Error(start.message||'No se pudo iniciar el análisis DYNAMIC.');
  }catch(e){dynamicFixMessage(e?.message||String(e));}
}

document.getElementById('analyze')?.addEventListener('click',e=>{
  if(!dynamicFixIsActive())return;
  e.preventDefault();
  e.stopImmediatePropagation();
  dynamicFixRun();
},true);

async function dynamicFixHideForeignState(){
  if(!dynamicFixIsActive())return;
  try{
    const r=await chrome.runtime.sendMessage({type:'GET_STATE'});
    const state=r?.state||{};
    if(String(state.source||'').toUpperCase()==='DYNAMIC')return;
    ['total','new','reassigned','reevaluated','attention','waiting','detailGroupsTotal'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent='0';});
    const rows=document.getElementById('rows');if(rows)rows.innerHTML='';
    const groups=document.getElementById('detailGroups');if(groups)groups.innerHTML='<div class="detailEmpty">Sin resultados DYNAMIC</div>';
    const bar=document.getElementById('bar');if(bar)bar.style.width='0%';
  }catch(_){ }
}
setInterval(dynamicFixHideForeignState,1200);
