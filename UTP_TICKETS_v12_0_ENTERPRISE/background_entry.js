importScripts('background_v12.js');

/*
 * V12.0.4
 * La clasificación histórica oficial se basa en BASE_TICKETS por DNI.
 * No se consulta el historial remoto del solicitante de Zendesk antes de
 * avanzar cada ticket, porque esa consulta podía quedarse esperando y dejar
 * la pantalla en "procesados 0 de N".
 */
try {
  zendeskHistory = async function(){
    return {checked:false,hasPrevious:false,previousTickets:[]};
  };

  analyzeZendesk = async function(items,g){
    const base=await queryExisting();
    let rows=(items||[]).map(x=>({...x,idTicket:String(x.idTicket||''),platform:'ZENDESK',status:'VERIFICANDO',selected:false}));
    await patch({active:true,paused:false,phase:'checking',source:'ZENDESK',total:rows.length,processed:0,results:rows,error:'',cancelled:false});

    for(let i=0;i<rows.length;i++){
      if(cancelled(g))return;
      if(!(await waitWhilePaused(g)))return;

      let row=analyzeAgainstBase(rows[i],base);

      // Si BASE_TICKETS no tiene antecedente y el origen no está definido,
      // abrimos únicamente ese ticket para detectar PORTAL/ZENDESK.
      if(!row.hasAntecedent&&!['PORTAL','ZENDESK'].includes(String(row.origen||'').toUpperCase())){
        let tab;
        try{
          tab=await chrome.tabs.create({url:ZENDESK_TICKET_URL+encodeURIComponent(row.idTicket),active:false});
          await waitTab(tab.id);
          const inside=await readZendeskTicket(tab.id);
          row=analyzeAgainstBase({...row,...inside,platform:'ZENDESK'},base);
        }catch(e){
          row={...row,status:'ERROR',selected:false,message:e.message};
        }finally{
          if(tab?.id)chrome.tabs.remove(tab.id).catch(()=>{});
        }
      }

      rows[i]=row;
      await patch({phase:'analysis',processed:i+1,results:rows});
      await sleep(80);
    }

    await patch({active:false,paused:false,phase:'ready',results:rows,finishedAt:new Date().toISOString(),error:''});
  };
}catch(e){
  console.error('No se pudo aplicar el parche Zendesk V12.0.4',e);
}

// Evita que una ejecución que quedó marcada como activa en una versión
// anterior mantenga la interfaz congelada al actualizar la extensión.
chrome.storage.local.get('ticketAnalysis').then(data=>{
  const s=data.ticketAnalysis||{};
  if(s.active&&Number(s.processed||0)===0){
    chrome.storage.local.set({ticketAnalysis:{...s,active:false,paused:false,phase:'ready',error:'',cancelled:false}}).catch(()=>{});
  }
}).catch(()=>{});
