
/** Bela Mares — STABLE LOCAL (sem Firebase)
 *  - Login por PIN (localStorage)
 *  - Obras com 12 ou 16 aptos por bloco
 *  - Blocos em ordem numérica
 *  - Checklist simples (pendência -> feito -> aprovado)
 */
const LS = "bm_stable_v0";
const DEFAULT_PINS = {
  qualidade: "1111",
  execucao: "2222",
  supervisor: "3333",
  coordenador: "4444",
  engenheiro: "5555",
  diretor: "6666"
};

function load(){
  try { return JSON.parse(localStorage.getItem(LS)) || null; }
  catch(e){ return null; }
}
function save(data){
  localStorage.setItem(LS, JSON.stringify(data));
}
function now(){
  const d = new Date();
  return d.toLocaleString("pt-BR");
}
function ensureData(){
  let data = load();
  if(!data){
    data = { session: null, obras: [] };
    save(data);
  }
  return data;
}
function setSession(user){
  const data = ensureData();
  data.session = user;
  save(data);
}
function getSession(){
  return ensureData().session;
}
function resetAll(){
  localStorage.removeItem(LS);
}

function aptosFor(aptsPorBloco){
  if(aptsPorBloco===16){
    return ["101","102","103","104","201","202","203","204","301","302","303","304","401","402","403","404"];
  }
  return ["101","102","103","104","201","202","203","204","301","302","303","304"];
}
function makeObra(nome, numBlocos, aptsPorBloco){
  const blocks = Array.from({length:numBlocos}, (_,i)=> String(i+1));
  const aptos = aptosFor(aptsPorBloco);
  const obra = {
    id: "obra_"+Math.random().toString(16).slice(2),
    nome,
    numBlocos,
    aptsPorBloco,
    blocks: blocks.map(b=>({
      id: b,
      aptos: aptos.map(a=>({
        id: a,
        pendencias: [],
        feito: false,
        aprovado: false
      }))
    }))
  };
  return obra;
}

function screen(id){
  ["login","obras","obra","apto"].forEach(s=>{
    document.getElementById(s).style.display = (s===id) ? "" : "none";
  });
}

function renderWho(){
  const s = getSession();
  const who = document.getElementById("who");
  who.textContent = s ? `${s.name} — ${s.role}` : "";
}

function canEdit(role){
  return role==="qualidade" || role==="supervisor";
}
function canExec(role){
  return role==="execucao";
}
function isView(role){
  return role==="coordenador" || role==="engenheiro" || role==="diretor";
}

let state = {
  activeObraId: null,
  activeBlockId: null,
  activeAptoId: null
};

function getData(){ return ensureData(); }
function updateData(fn){
  const d = ensureData();
  fn(d);
  save(d);
}

function findObra(id){
  const d = getData();
  return d.obras.find(o=>o.id===id) || null;
}

function counts(obra){
  let pend=0, aguard=0, ok=0;
  for(const bl of obra.blocks){
    for(const ap of bl.aptos){
      if(ap.aprovado) ok++;
      else if(ap.feito) aguard++;
      else if(ap.pendencias.length>0) pend++;
    }
  }
  return {pend,aguard,ok};
}

function renderLogin(){
  renderWho();
  screen("login");
  document.getElementById("msg").textContent="";
  document.getElementById("btnEnter").onclick = ()=>{
    const name = document.getElementById("name").value.trim();
    const role = document.getElementById("role").value;
    const pin = document.getElementById("pin").value.trim();
    if(!name){ document.getElementById("msg").textContent="Digite seu nome."; return; }
    if(!pin){ document.getElementById("msg").textContent="Digite o PIN."; return; }
    if(pin !== DEFAULT_PINS[role]){
      document.getElementById("msg").textContent="PIN inválido.";
      return;
    }
    setSession({name,role});
    renderObras();
  };
  document.getElementById("btnReset").onclick = ()=>{
    if(confirm("Isso apaga TUDO. Confirmar?")){
      resetAll();
      location.reload();
    }
  };
}

function renderObras(){
  renderWho();
  screen("obras");
  const sess = getSession();
  if(!sess){ renderLogin(); return; }

  document.getElementById("btnLogout").onclick = ()=>{
    setSession(null);
    renderLogin();
  };

  const btnAdd = document.getElementById("btnAddObra");
  btnAdd.style.display = (sess.role==="qualidade" || sess.role==="supervisor") ? "" : "none";
  btnAdd.onclick = ()=>{
    const nome = prompt("Nome da obra (ex.: Costa Rica)");
    if(!nome) return;
    const nb = parseInt(prompt("Quantidade de blocos (ex.: 17)"),10);
    if(!nb || nb<1) return;
    const ap = parseInt(prompt("Apartamentos por bloco? (12 ou 16)"),10);
    if(ap!==12 && ap!==16) return;

    updateData(d=>{
      d.obras.push(makeObra(nome, nb, ap));
    });
    renderObras();
  };

  const list = document.getElementById("obraList");
  list.innerHTML = "";
  const d = getData();
  if(d.obras.length===0){
    const div = document.createElement("div");
    div.className="small";
    div.textContent="Nenhuma obra cadastrada.";
    list.appendChild(div);
    return;
  }
  for(const o of d.obras){
    const c = counts(o);
    const item = document.createElement("div");
    item.className="item";
    item.innerHTML = `
      <div>
        <div style="font-weight:900">${o.nome}</div>
        <div class="small">${o.numBlocos} blocos • ${o.aptsPorBloco} aptos/bloco</div>
      </div>
      <div class="badge">Pend: ${c.pend} • Agu: ${c.aguard} • OK: ${c.ok}</div>
    `;
    item.onclick = ()=>{
      state.activeObraId = o.id;
      renderObra();
    };
    list.appendChild(item);
  }
}

function renderObra(){
  renderWho();
  screen("obra");
  const sess = getSession();
  if(!sess){ renderLogin(); return; }
  const obra = findObra(state.activeObraId);
  if(!obra){ renderObras(); return; }

  document.getElementById("obraTitle").textContent = obra.nome;
  document.getElementById("obraMeta").textContent = `${obra.numBlocos} blocos • ${obra.aptsPorBloco} aptos/bloco`;

  const c = counts(obra);
  document.getElementById("sPend").textContent = c.pend;
  document.getElementById("sAguard").textContent = c.aguard;
  document.getElementById("sOk").textContent = c.ok;

  document.getElementById("btnBack").onclick = ()=> renderObras();

  const btnDel = document.getElementById("btnDelObra");
  btnDel.style.display = (sess.role==="supervisor") ? "" : "none";
  btnDel.onclick = ()=>{
    if(!confirm("Excluir obra e apagar dados?")) return;
    updateData(d=>{
      d.obras = d.obras.filter(x=>x.id!==obra.id);
    });
    renderObras();
  };

  const grid = document.getElementById("blockGrid");
  grid.innerHTML = "";
  const sortedBlocks = [...obra.blocks].sort((a,b)=> parseInt(a.id,10)-parseInt(b.id,10));
  for(const bl of sortedBlocks){
    const div = document.createElement("div");
    div.className="block";
    const done = bl.aptos.filter(a=>a.aprovado).length;
    div.innerHTML = `<div class="n">Bloco ${bl.id}</div><div class="small">${done}/${bl.aptos.length} OK</div>`;
    div.onclick = ()=>{
      state.activeBlockId = bl.id;
      // abre lista de aptos dentro do bloco: reaproveitar tela Apto escolhendo primeiro e navegando
      // aqui vamos abrir o primeiro apto e permitir trocar na lista
      renderAptoPicker(bl.id);
    };
    grid.appendChild(div);
  }
}

// Simple apto picker inside the same "apto" screen (list)
function renderAptoPicker(blockId){
  renderWho();
  screen("apto");
  const sess = getSession();
  const obra = findObra(state.activeObraId);
  const bl = obra.blocks.find(b=>b.id===blockId);
  const aptos = [...bl.aptos].sort((a,b)=> parseInt(a.id,10)-parseInt(b.id,10));

  document.getElementById("aptoTitle").textContent = `Bloco ${blockId} — Selecionar Apto`;
  document.getElementById("aptoStatus").textContent = "Toque em um apartamento para abrir.";

  document.getElementById("btnBackApto").onclick = ()=> renderObra();
  document.getElementById("btnAddPend").style.display="none";

  const list = document.getElementById("pendList");
  list.innerHTML = "";
  for(const ap of aptos){
    const st = ap.aprovado ? "✅ Liberado" : ap.feito ? "🟡 Aguardando" : ap.pendencias.length>0 ? "🔴 Pendência" : "⚪ Vazio";
    const div = document.createElement("div");
    div.className="item";
    div.innerHTML = `<div><div style="font-weight:900">Apto ${ap.id}</div><div class="small">${st}</div></div>
                     <div class="badge">${ap.pendencias.length} itens</div>`;
    div.onclick = ()=>{
      state.activeAptoId = ap.id;
      renderApto();
    };
    list.appendChild(div);
  }
}

function renderApto(){
  renderWho();
  screen("apto");
  const sess = getSession();
  const obra = findObra(state.activeObraId);
  const bl = obra.blocks.find(b=>b.id===state.activeBlockId);
  const ap = bl.aptos.find(a=>a.id===state.activeAptoId);

  const st = ap.aprovado ? "✅ Liberado" : ap.feito ? "🟡 Aguardando conferência" : ap.pendencias.length>0 ? "🔴 Com pendências" : "⚪ Sem pendências";
  document.getElementById("aptoTitle").textContent = `Bloco ${state.activeBlockId} — Apto ${ap.id}`;
  document.getElementById("aptoStatus").textContent = st + " • " + now();

  document.getElementById("btnBackApto").onclick = ()=> renderAptoPicker(state.activeBlockId);

  const btnAdd = document.getElementById("btnAddPend");
  btnAdd.style.display = canEdit(sess.role) ? "" : "none";
  btnAdd.onclick = ()=>{
    const t = prompt("Pendência:");
    if(!t) return;
    updateData(d=>{
      const o = d.obras.find(x=>x.id===obra.id);
      const b = o.blocks.find(x=>x.id===bl.id);
      const a = b.aptos.find(x=>x.id===ap.id);
      a.pendencias.push({id:"p_"+Math.random().toString(16).slice(2), text:t, by:sess.role, at:now(), done:false});
      a.feito=false; a.aprovado=false;
    });
    renderApto();
  };

  const list = document.getElementById("pendList");
  list.innerHTML="";

  // actions for exec/supervisor
  const actions = document.createElement("div");
  actions.className="item";
  actions.style.flexDirection="column";
  actions.style.alignItems="stretch";
  actions.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;">
    <div style="font-weight:900">Ações</div>
    <div class="badge">${sess.role}</div>
  </div>`;
  const actRow = document.createElement("div");
  actRow.className="row";
  actRow.style.marginTop="10px";

  const btnFeito = document.createElement("button");
  btnFeito.className="btn";
  btnFeito.textContent = ap.feito ? "Desfazer Feito" : "Marcar Feito";
  btnFeito.disabled = !canExec(sess.role);
  btnFeito.onclick = ()=>{
    updateData(d=>{
      const o = d.obras.find(x=>x.id===obra.id);
      const b = o.blocks.find(x=>x.id===bl.id);
      const a = b.aptos.find(x=>x.id===ap.id);
      a.feito = !a.feito;
      if(!a.feito){ a.aprovado=false; }
    });
    renderApto();
  };

  const btnAprovar = document.createElement("button");
  btnAprovar.className="btn primary";
  btnAprovar.textContent="Aprovar";
  btnAprovar.disabled = !(sess.role==="supervisor");
  btnAprovar.onclick = ()=>{
    updateData(d=>{
      const o=d.obras.find(x=>x.id===obra.id);
      const b=o.blocks.find(x=>x.id===bl.id);
      const a=b.aptos.find(x=>x.id===ap.id);
      a.aprovado=true;
    });
    renderApto();
  };

  const btnReprovar = document.createElement("button");
  btnReprovar.className="btn danger";
  btnReprovar.textContent="Reprovar";
  btnReprovar.disabled = !(sess.role==="supervisor");
  btnReprovar.onclick = ()=>{
    updateData(d=>{
      const o=d.obras.find(x=>x.id===obra.id);
      const b=o.blocks.find(x=>x.id===bl.id);
      const a=b.aptos.find(x=>x.id===ap.id);
      a.aprovado=false;
      a.feito=false;
    });
    renderApto();
  };

  actRow.appendChild(btnFeito);
  actRow.appendChild(btnAprovar);
  actRow.appendChild(btnReprovar);
  actions.appendChild(actRow);
  list.appendChild(actions);

  if(ap.pendencias.length===0){
    const empty = document.createElement("div");
    empty.className="small";
    empty.style.marginTop="12px";
    empty.textContent="Sem pendências cadastradas.";
    list.appendChild(empty);
    return;
  }

  for(const p of ap.pendencias){
    const div = document.createElement("div");
    div.className="item";
    div.innerHTML = `<div>
      <div style="font-weight:900">${p.text}</div>
      <div class="small">Criado por ${p.by} • ${p.at}</div>
    </div>
    <div class="badge">${p.done ? "✅" : "⏳"}</div>`;
    list.appendChild(div);
  }
}

function boot(){
  ensureData();
  const sess = getSession();
  if(sess) renderObras();
  else renderLogin();
}

boot();
