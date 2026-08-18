importScripts('background_v12.js');

/* V12.0.5 - corrección de clasificación BASE_TICKETS */
try {
  analyzeAgainstBase = function(row,base){
    let dni=String(row?.dni||'').trim();
    const id=String(row?.idTicket||'').trim();
    const exact=base?.ticketRows?.[id]||null;
    if(!dni&&exact?.dni)dni=String(exact.dni).trim();

    const analysis=dni?(base?.dniAnalysis?.[dni]||null):null;
    const history=Array.isArray(base?.dniHistory?.[dni])?base.dniHistory[dni]:[];
    const ticketList=Array.isArray(base?.tickets)?base.tickets.map(String):[];
    const exists=Boolean(exact)||ticketList.includes(id);

    let antecedent=analysis?.antecedente||null;
    if(!antecedent&&history.length){
      antecedent=history.find(x=>String(x?.idTicket||'')!==id)||history[history.length-1]||null;
    }
    if(!antecedent&&exact)antecedent=exact;

    const total=Number(analysis?.totalRegistros||history.length||0);
    const has=Boolean(antecedent)||total>0;
    const platform=String(row?.platform||row?.fuente||'ZENDESK').toUpperCase();

    let origen='REVISAR';
    if(platform==='DYNAMIC')origen='DYNAMIC';
    else if(has)origen='ZENDESK';
    else {
      const detected=String(row?.origen||'').toUpperCase();
      origen=['PORTAL','ZENDESK'].includes(detected)?detected:'REVISAR';
    }
    if(row?.origenManual&&platform!=='DYNAMIC'&&!has){
      const manual=String(row?.origen||'').toUpperCase();
      origen=['PORTAL','ZENDESK'].includes(manual)?manual:'REVISAR';
    }

    const enriched={
      ...row,
      idTicket:id,
      dni,
      ticketExists:exists,
      hasAntecedent:has,
      totalRegistros:total,
      antecedente:antecedent,
      tipoTicket:normalizeType(analysis?.tipoTicket||antecedent?.tipoTicket||exact?.tipoTicket),
      origen,
      platform,
      detalleActual:exact?.detalle||antecedent?.detalle||'',
      fechaInicioBase:exact?.fechaInicio||antecedent?.fechaInicio||analysis?.fechaInicio||'',
      responsableAnterior:antecedent?.responsable||'',
      ticketAnterior:antecedent?.idTicket||'',
      previousTickets:base?.dniTickets?.[dni]||[]
    };

    return computeStatus({...enriched,tipoTicket:resolveType(enriched)});
  };

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
      await patch({phase:'analysis',processed:i+1,results:rows,error:''});
      await sleep(80);
    }

    await patch({active:false,paused:false,phase:'ready',results:rows,finishedAt:new Date().toISOString(),error:''});
  };
}catch(e){
  console.error('No se pudo aplicar el parche BASE_TICKETS V12.0.5',e);
}

chrome.storage.local.get('ticketAnalysis').then(data=>{
  const s=data.ticketAnalysis||{};
  if(s.error==='antecedente is not defined'||String(s.error||'').includes('antecedente is not defined')){
    chrome.storage.local.set({ticketAnalysis:{...s,active:false,paused:false,phase:'ready',error:'',cancelled:false}}).catch(()=>{});
  }
}).catch(()=>{});
