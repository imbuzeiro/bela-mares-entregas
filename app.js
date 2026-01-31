/* Costa Rica - Entregas (Prototype PWA) — v2 (iPhone fix)
   - Single-page prototype with localStorage persistence
   - Roles: qualidade, execucao, supervisor
   - States: pendente, feito, conferido, reprovado, reaberto
   Fixes:
   - Modal no longer "sticks" on iPhone (always closes on successful actions + forced close on navigation)
   - Added Home screen: choose Obra + "Atualizar obras"
*/
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));

const STORAGE_KEY = "cr_entregas_v17";

const ROLES = {
  qualidade: "Qualidade",
  execucao: "Execução",
  supervisor: "Supervisor Manutenção",
  coordenador: "Coordenador",
  engenheiro: "Engenheiro Geral",
  diretor: "Diretor (Visualização)"
};

const STATE_LABEL = {
  pendente: "Pendente",
  feito: "Feito",
  conferido: "Conferido",
  reprovado: "Reprovado",
  reaberto: "Reaberto"
};

function nowISO(){ return new Date().toISOString(); }
function fmtDT(iso){
  try{
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" });
  }catch(e){ return ""; }
}
function uid(prefix="id"){
  return prefix + "_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._tm);
  toast._tm = setTimeout(()=> t.hidden = true, 2200);
}

function openModal({title, bodyHTML, actions=[]}){
  const overlay = $("#modalOverlay");
  $("#modalTitle").textContent = title || "Ação";
  $("#modalBody").innerHTML = bodyHTML || "";
  const act = $("#modalActions");
  act.innerHTML = "";
  actions.forEach(a=>{
    const b = document.createElement("button");
    b.className = "btn " + (a.className||"");
    b.textContent = a.label;
    b.addEventListener("click", async ()=>{
      try{ await a.onClick?.(); }
      finally{
        if(a.close !== false) closeModal();
      }
    });
    act.appendChild(b);
  });
  overlay.hidden = false;
  overlay.style.display = "flex";
}

function closeModal(){
  const overlay = $("#modalOverlay");
  overlay.hidden = true;
  overlay.style.display = "none";
  $("#modalTitle").textContent = "";
  $("#modalBody").innerHTML = "";
  $("#modalActions").innerHTML = "";
}

$("#modalClose").addEventListener("click", closeModal);
$("#modalOverlay").addEventListener("click", (e)=>{ if(e.target.id==="modalOverlay") closeModal(); });

// Force-close any stuck modal (iOS) after DOM is ready
document.addEventListener("DOMContentLoaded", ()=>{
  try{ closeModal(); }catch(e){}
});

// Install prompt (works best in Safari)
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  $("#btnInstall").hidden = false;
});
$("#btnInstall").addEventListener("click", async ()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $("#btnInstall").hidden = true;
});

if("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}

function seedData(){
  // Obras iniciais
  const obraCR = createObraData({ obraId: "costa_rica", obraName: "Costa Rica - Entregas", numBlocks: 17, aptsPerBlock: 12 });
  const obraCB = createObraData({ obraId: "costa_brava", obraName: "Costa Brava - Entregas", numBlocks: 6, aptsPerBlock: 12 });

  // Exemplo de pendência (demonstração)
  try{
    const a = obraCR.blocks["B17"].apartments["204"];
    a.pendencias.push({
      id: uid("p"),
      title: "Rejunte falhando",
      category: "Revestimento",
      location: "Cozinha",
      state: "pendente",
      createdBy: { name:"Juliana", role:"qualidade" },
      createdAt: nowISO(),
      doneBy: null, doneAt: null,
      reviewedBy: null, reviewedAt: null,
      rejection: null,
      reopenedAt: null
    });
  }catch(e){}

  // Usuários (teste) — usuário + PIN
  const users = [
    { id: "supervisor_01", name: "Supervisor 01", role: "supervisor", pin: "3333", obraIds: ["*"], active: true },
    { id: "qualidade_01", name: "Qualidade 01", role: "qualidade", pin: "2222", obraIds: ["*"], active: true },
    { id: "exec_costa_rica", name: "Execução Costa Rica", role: "execucao", pin: "1234", obraIds: ["costa_rica"], active: true },
    { id: "exec_costa_brava", name: "Execução Costa Brava", role: "execucao", pin: "5678", obraIds: ["costa_brava"], active: true },
    { id: "coordenador", name: "Coordenador", role: "coordenador", pin: "7777", obraIds: ["*"], active: true },
    { id: "engenheiro", name: "Engenheiro Geral", role: "engenheiro", pin: "8888", obraIds: ["*"], active: true },
    { id: "diretor", name: "Diretor", role: "diretor", pin: "9999", obraIds: ["*"], active: true }
  ];

  return {
    version: 17,
    session: null, // { userId }
    users,
    obras: { costa_rica: obraCR, costa_brava: obraCB },
    obras_index: [
      { id: "costa_rica", name: obraCR.name, config: obraCR.config },
      { id: "costa_brava", name: obraCB.name, config: obraCB.config }
    ],
    last_obras_refresh: nowISO()
  };
}

function createObraData({obraId, obraName, numBlocks=17, aptsPerBlock=12}){
  // aptsPerBlock: 12 (101-104,201-204,301-304) or 16 (+401-404)
  const nums12 = [101,102,103,104, 201,202,203,204, 301,302,303,304];
  const nums16 = nums12.concat([401,402,403,404]);
  const nums = (Number(aptsPerBlock) === 16) ? nums16 : nums12;

  const blocos = {};
  for(let b=1; b<=numBlocks; b++){
    const blocoId = "B" + String(b).padStart(2,"0");
    const apts = {};
    nums.forEach(n=>{
      apts[String(n)] = { apto: String(n), pendencias: [], logs: [] };
    });
    blocos[blocoId] = { id: blocoId, name: "Bloco " + b, apartments: apts };
  }
  return {
    id: obraId,
    name: obraName,
    blocks: blocos,
    config: { numBlocks: Number(numBlocks)||0, aptsPerBlock: (Number(aptsPerBlock)===16?16:12) }
  };
}

function slugifyObraName(name){
  return name.toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g,"_")
    .replace(/^_+|_+$/g,"")
    .slice(0, 40) || ("obra_" + Math.random().toString(16).slice(2,8));
}


function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return seedData();
  try{
    const parsed = JSON.parse(raw);
    if(!parsed?.obras?.costa_rica) return seedData();
    return parsed;
  }catch(e){
    return seedData();
  }
}
function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

function currentUser(){
  const sid = state.session?.userId;
  if(!sid) return null;
  return (state.users||[]).find(u=>u.id===sid && u.active) || null;
}

function setSession(userId){
  state.session = userId ? { userId } : null;
  saveState();
  syncTopbar();
}

function syncTopbar(){
  const u = currentUser();
  $("#btnUser").hidden = !u;
  $("#btnBack").hidden = (router.stack.length <= 1);
  if(u) $("#btnUser").textContent = u.name + " • " + (ROLES[u.role] || u.role);
}

$("#btnUser").addEventListener("click", ()=>{
  const u = currentUser();
  if(!u || !canAddObra(u)) return;
  openModal({
    title: "Conta",
    bodyHTML: `
      <div class="small">Você está logado como:</div>
      <div style="margin-top:6px;font-weight:950;font-size:16px">${escapeHTML(u.name)}</div>
      <div class="small" style="margin-top:2px">${escapeHTML(ROLES[u.role] || u.role)}</div>
      <hr class="hr">
      <button class="btn btn--danger" id="logoutBtn">Sair</button>
    `,
    actions: [{ label:"Fechar", className:"", onClick: ()=>{} }]
  });
  $("#logoutBtn").addEventListener("click", ()=>{
    setSession(null);
    closeModal();
    forceNav("login");
    toast("Você saiu.");
  });
});



function forceNav(route, params={}){
  router.stack = [{ route, params }];
  setTimeout(()=>safeRender(), 0);
}

function safeRender(){
  try{ render(); }
  catch(e){
    console.error(e);
    try{
      const pre = document.createElement("pre");
      pre.style.position="fixed";
      pre.style.left="10px"; pre.style.right="10px";
      pre.style.top="70px"; pre.style.bottom="10px";
      pre.style.padding="12px";
      pre.style.background="#111";
      pre.style.color="#fff";
      pre.style.border="1px solid rgba(255,255,255,.2)";
      pre.style.borderRadius="14px";
      pre.style.overflow="auto";
      pre.style.zIndex="99999";
      pre.style.fontSize="12px";
      pre.textContent = "Erro ao renderizar (v17)

" + (e && (e.stack||e.message||String(e)) );
      document.body.appendChild(pre);
    }catch(_){}
  }
}

const router = {
  stack: [],
  go(route, params={}){
    this.stack.push({route, params});
    render();
  },
  back(){
    if(this.stack.length>1) this.stack.pop();
    render();
  },
  current(){ return this.stack[this.stack.length-1] || {route:"login", params:{}}; }
};

$("#btnBack").addEventListener("click", ()=> router.back());

function requireLogin(){
  if(!currentUser()){
    forceNav("login");
    return false;
  }
  return true;
}

function setSubtitle(text){ $("#subtitle").textContent = text || "Checklist de obra"; }

function getApartment(obraId, blocoId, apto){
  return state.obras[obraId].blocks[blocoId].apartments[String(apto)];
}

function logAction(apt, msg){
  const u = currentUser();
  apt.logs.unshift({
    id: uid("l"),
    at: nowISO(),
    who: u ? `${u.name} (${ROLES[u.role]})` : "Sistema",
    action: msg
  });
  apt.logs = apt.logs.slice(0, 80);
}

function aptStatus(apt){
  const items = apt.pendencias;
  if(items.length === 0) return "liberado";
  const bad = items.some(p => ["pendente","reprovado","reaberto"].includes(p.state));
  if(bad) return "pendente";
  const waiting = items.some(p => p.state === "feito");
  if(waiting) return "aguardando";
  return "liberado";
}

function statusDotClass(st){
  if(st==="pendente") return "statusDot statusDot--red";
  if(st==="aguardando") return "statusDot statusDot--yellow";
  if(st==="liberado") return "statusDot statusDot--green";
  return "statusDot";
}
function openCountForApt(apt){ return apt.pendencias.filter(p => p.state !== "conferido").length; }
function statusBadge(st, openCount){
  if(st==="pendente") return `<span class="badge badge--red">🔴 ${openCount}</span>`;
  if(st==="aguardando") return `<span class="badge badge--yellow">🟡 ${openCount}</span>`;
  return `<span class="badge badge--green">✅ ${openCount}</span>`;
}

function canCreate(user){ return ["qualidade","supervisor"].includes(user.role); }
function canMarkDone(user){ return user.role === "execucao"; }
function canReview(user){ return user.role === "supervisor"; }
function canReopen(user){ return ["qualidade","supervisor"].includes(user.role); }
function canDeleteObra(user){ return user?.role === "supervisor"; }

function renderLogin(){
  setSubtitle("Entrar");
  const v = $("#view");
  v.innerHTML = `
    <div class="card">
      <h1 class="card__title" style="font-size:18px;margin:0 0 6px">Entrar</h1>
      <div class="card__meta">Acesso por <b>usuário</b> + <b>PIN</b>. (Protótipo)</div>
      <hr class="hr">
      <label class="small">Usuário</label>
      <input id="userId" class="input" placeholder="Ex.: exec_costa_rica" autocomplete="username">
      <div style="height:10px"></div>
      <label class="small">PIN</label>
      <input id="pin" class="input" placeholder="4 dígitos" inputmode="numeric" autocomplete="current-password">
      <div class="rowActions" style="margin-top:14px">
        <button id="btnEnter" class="btn btn--green">Entrar</button>
        <button id="btnReset" class="btn btn--danger">Zerar dados (teste)</button>
      </div>
      <div class="small" style="margin-top:12px">
        <b>Logins de teste:</b><br>
        supervisor_01 (3333) • qualidade_01 (2222)<br>
        exec_costa_rica (1234) • exec_costa_brava (5678)<br>
        coordenador (7777) • engenheiro (8888) • diretor (9999)
      </div>
    </div>
  `;

  $("#btnEnter").addEventListener("click", ()=>{
    const id = $("#userId").value.trim();
    const pin = $("#pin").value.trim();
    const u = (state.users||[]).find(x=>x.id===id && x.active);
    if(!u){ toast("Usuário inválido."); return; }
    if(u.pin !== pin){ toast("PIN incorreto."); return; }
    setSession(u.id);
    toast("Bem-vindo, " + u.name + "!");
    if(u.role === "execucao"){
      const obraId = (u.obraIds||[])[0];
      router.go("obra", { obraId });
    }else if(canViewOnly(u)){
      router.go("dash");
    }else{
      router.go("home");
    }
    // ensure navigation renders on all browsers
    setTimeout(()=>{ try{ render(); }catch(e){} }, 0);
  });

  $("#btnReset").addEventListener("click", ()=>{
    openModal({
      title: "Zerar dados?",
      bodyHTML: `<div class="small">Isso apaga tudo que você marcou nesse protótipo (inclui usuários e obras).</div>`,
      actions: [
        { label:"Cancelar", className:"", onClick: ()=>{} },
        { label:"Zerar", className:"btn--danger", onClick: ()=>{
            state = seedData();
            saveState();
            toast("Dados zerados.");
            forceNav("login");
          }
        }
      ]
    });
  });
}


function upsertObraIndex(entry){
  const idx = state.obras_index || [];
  const i = idx.findIndex(x=>x.id===entry.id);
  if(i>=0) idx[i] = entry;
  else idx.unshift(entry);
  state.obras_index = idx;
}

function removeObra(obraId){
  delete state.obras[obraId];
  state.obras_index = (state.obras_index||[]).filter(x=>x.id!==obraId);
  saveState();
}

function rebuildObraKeepingData(obraId, { numBlocks, aptsPerBlock }){
  const old = state.obras[obraId];
  if(!old) return;
  const name = old.name;
  const fresh = createObraData({ obraId, obraName: name, numBlocks, aptsPerBlock });

  // Preserve data where possible (same bloco + same apt number)
  Object.values(fresh.blocks).forEach(nb=>{
    const ob = old.blocks?.[nb.id];
    if(!ob) return;
    Object.keys(nb.apartments).forEach(apNum=>{
      const oa = ob.apartments?.[apNum];
      if(oa){
        nb.apartments[apNum].pendencias = oa.pendencias || [];
        nb.apartments[apNum].logs = oa.logs || [];
      }
    });
  });

  state.obras[obraId] = fresh;
  upsertObraIndex({ id: obraId, name: fresh.name, config: fresh.config });
  saveState();
}

function refreshObrasIndex(){
  state.last_obras_refresh = nowISO();
  saveState();
}


function openAddObraModal(){
  const u = currentUser();
  if(!u) return;

  openModal({
    title: "Adicionar obra",
    bodyHTML: `
      <label class="small">Nome da obra</label>
      <input id="obraName" class="input" placeholder="Ex.: Costa Brava - Entregas">
      <div style="height:10px"></div>
      <div class="formRow">
        <div>
          <label class="small">Quantidade de blocos</label>
          <input id="obraBlocks" class="input" inputmode="numeric" placeholder="Ex.: 17" value="17">
        </div>
        <div>
          <label class="small">Aptos por bloco</label>
          <select id="obraApts" class="input">
            <option value="12">12 (até 304)</option>
            <option value="16">16 (até 404)</option>
          </select>
        </div>
      </div>
      <div class="small" style="margin-top:10px">Obs.: você pode ajustar depois em <b>Configurar</b>.</div>
    `,
    actions: [
      { label:"Cancelar", className:"", onClick: ()=>{} },
      { label:"Adicionar", className:"btn--green", onClick: ()=>{
          const name = $("#obraName").value.trim();
          if(!name){ toast("Informe o nome da obra."); return; }
          const obraId = slugifyObraName(name);
          const numBlocks = Math.max(1, parseInt($("#obraBlocks").value || "17", 10));
          const aptsPerBlock = parseInt($("#obraApts").value || "12", 10);

          if(state.obras[obraId]){
            toast("Já existe uma obra com esse identificador. Tente outro nome.");
            return;
          }

          const obra = createObraData({ obraId, obraName: name, numBlocks, aptsPerBlock });
          state.obras[obraId] = obra;
          upsertObraIndex({ id: obraId, name: obra.name, config: obra.config });
          state.last_obras_refresh = nowISO();
          saveState();
          toast("Obra adicionada.");
          closeModal();
          render();
        } }
    ]
  });
}

function openEditObraModal(obraId){
  const u = currentUser();
  if(!u || u.role !== "supervisor") return; // only supervisor manages
  const obra = state.obras[obraId];
  if(!obra){ toast("Obra não encontrada."); return; }

  const cfg = obra.config || {};
  openModal({
    title: "Configurar obra",
    bodyHTML: `
      <div class="small">Obra: <b>${escapeHTML(obra.name)}</b></div>
      <div style="height:10px"></div>
      <div class="formRow">
        <div>
          <label class="small">Quantidade de blocos</label>
          <input id="edBlocks" class="input" inputmode="numeric" value="${escapeAttr(String(cfg.numBlocks || 17))}">
        </div>
        <div>
          <label class="small">Aptos por bloco</label>
          <select id="edApts" class="input">
            <option value="12">12 (até 304)</option>
            <option value="16">16 (até 404)</option>
          </select>
        </div>
      </div>
      <div class="small" style="margin-top:10px">
        Ao mudar para <b>12</b>, os aptos 401–404 (se existirem) serão removidos do bloco (pendências desses aptos não serão mantidas).
      </div>
    `,
    actions: [
      { label:"Cancelar", className:"", onClick: ()=>{} },
      { label:"Salvar", className:"btn--green", onClick: ()=>{
          const numBlocks = Math.max(1, parseInt($("#edBlocks").value || "17", 10));
          const aptsPerBlock = parseInt($("#edApts").value || "12", 10);

          const oldCfg = obra.config || {};
          const needWarnDrop = (Number(oldCfg.aptsPerBlock) === 16 && Number(aptsPerBlock) === 12);

          const doSave = ()=>{
            rebuildObraKeepingData(obraId, { numBlocks, aptsPerBlock });
            toast("Configuração salva.");
            closeModal();
            render();
          };

          if(needWarnDrop){
            openModal({
              title: "Confirmar redução",
              bodyHTML: `<div class="small">Você está mudando de 16 para 12 aptos/bloco. Os aptos <b>401–404</b> serão removidos.</div>`,
              actions: [
                { label:"Cancelar", className:"", onClick: ()=>{} },
                { label:"Confirmar", className:"btn--danger", onClick: doSave }
              ]
            });
            return;
          }

          doSave();
        } }
    ]
  });
  setTimeout(()=>{ try{ $("#edApts").value = String(cfg.aptsPerBlock || 12); }catch(e){} }, 0);
}

function confirmDeleteObra(obraId){
  const u = currentUser();
  if(!u || u.role !== "supervisor") return; // only supervisor deletes
  const obra = state.obras[obraId];
  if(!obra){ toast("Obra não encontrada."); return; }

  openModal({
    title: "Remover obra",
    bodyHTML: `
      <div class="small">Tem certeza que deseja remover:</div>
      <div style="margin-top:6px;font-weight:950;font-size:16px">${escapeHTML(obra.name)}</div>
      <div class="small" style="margin-top:8px;color:#FFD6D6">Essa ação apaga os dados dessa obra neste aparelho.</div>
    `,
    actions: [
      { label:"Cancelar", className:"", onClick: ()=>{} },
      { label:"Remover", className:"btn--danger", onClick: ()=>{
          removeObra(obraId);
          toast("Obra removida.");
          closeModal();
          render();
        } }
    ]
  });
}

function renderUsers(){
  if(!requireLogin()) return;
  const u = currentUser();
  if(!canManageUsers(u)){ router.go("home"); return; }
  setSubtitle("Usuários e Acessos");

  const v = $("#view");
  v.innerHTML = `
    <div class="card">
      <div class="sectionTitle" style="margin-top:0">
        <h2>Usuários</h2>
        <div class="hint">Qualidade e Supervisor criam acessos • Remover (Qualidade/Execução) só Supervisor</div>
      </div>
      <div class="rowActions">
        <button id="btnAddUser" class="btn btn--green">+ Adicionar usuário</button>
      </div>
      <hr class="hr">
      <div class="list" id="usersList"></div>
    </div>
  `;

  $("#btnAddUser").addEventListener("click", ()=> openAddUserModal());

  const list = $("#usersList");
  const users = (state.users||[]).slice().sort((a,b)=> (a.role||"").localeCompare(b.role||"") || (a.name||"").localeCompare(b.name||""));
  users.forEach(us=>{
    const canDel = canDeleteUser(u, us.role);
    const obraTxt = (us.obraIds||[]).includes("*") ? "todas" : (us.obraIds||[]).join(", ");
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="item__top">
        <div>
          <div class="item__title">${escapeHTML(us.name)} <span class="small">(${escapeHTML(us.id)})</span></div>
          <div class="item__meta">Perfil: <b>${escapeHTML(ROLES[us.role]||us.role)}</b> • Obras: <b>${escapeHTML(obraTxt)}</b></div>
        </div>
        <div class="item__tags">
          <span class="tag tag--cat">${us.active ? "✅ ativo" : "⛔ inativo"}</span>
        </div>
      </div>
      <div class="rowActions">
        <button class="btn" data-act="pin" data-id="${escapeAttr(us.id)}">Trocar PIN</button>
        <button class="btn" data-act="toggle" data-id="${escapeAttr(us.id)}">${us.active ? "Desativar" : "Ativar"}</button>
        ${canDel ? `<button class="btn btn--danger" data-act="del" data-id="${escapeAttr(us.id)}">Remover</button>` : ``}
      </div>
    `;
    list.appendChild(item);
  });

  list.addEventListener("click", (ev)=>{
    const btn = ev.target.closest("button[data-act]");
    if(!btn) return;
    const act = btn.getAttribute("data-act");
    const id = btn.getAttribute("data-id");
    const target = (state.users||[]).find(x=>x.id===id);
    if(!target) return;

    if(act==="pin") return openSetPinModal(target);
    if(act==="toggle") return toggleUserActive(target);
    if(act==="del") return confirmDeleteUser(target);
  });
}

function openAddUserModal(){
  const u = currentUser();
  if(!canManageUsers(u)) return;

  const obraOptions = (state.obras_index||[]).map(o=>`<option value="${escapeAttr(o.id)}">${escapeHTML(o.name)}</option>`).join("");
  openModal({
    title: "Adicionar usuário",
    bodyHTML: `
      <label class="small">Usuário (login)</label>
      <input id="nuId" class="input" placeholder="Ex.: exec_costa_rica">
      <div style="height:10px"></div>
      <label class="small">Nome</label>
      <input id="nuName" class="input" placeholder="Ex.: Execução Costa Rica">
      <div style="height:10px"></div>
      <div class="formRow">
        <div>
          <label class="small">Perfil</label>
          <select id="nuRole" class="input">
            <option value="execucao">Execução</option>
            <option value="qualidade">Qualidade</option>
            <option value="supervisor">Supervisor Manutenção</option>
            <option value="coordenador">Coordenador</option>
            <option value="engenheiro">Engenheiro Geral</option>
            <option value="diretor">Diretor</option>
          </select>
        </div>
        <div>
          <label class="small">PIN</label>
          <input id="nuPin" class="input" placeholder="4 dígitos" inputmode="numeric">
        </div>
      </div>
      <div style="height:10px"></div>
      <div id="nuObraWrap">
        <label class="small">Obra (para Execução: obrigatório / 1 obra)</label>
        <select id="nuObra" class="input">${obraOptions}</select>
      </div>
      <div class="small" style="margin-top:10px">Coordenador/Engenheiro/Diretor ficam em <b>visualização</b> (sem botões de ação).</div>
    `,
    actions: [
      { label:"Cancelar", className:"", onClick: ()=>{} },
      { label:"Criar", className:"btn--green", onClick: ()=>{
          const id = $("#nuId").value.trim();
          const name = $("#nuName").value.trim();
          const role = $("#nuRole").value;
          const pin = $("#nuPin").value.trim();
          if(!id || !name){ toast("Preencha usuário e nome."); return; }
          if((state.users||[]).some(x=>x.id===id)){ toast("Usuário já existe."); return; }
          if(!pin || pin.length < 4){ toast("PIN mínimo 4 dígitos."); return; }

          let obraIds = ["*"];
          if(role === "execucao"){
            const obraId = $("#nuObra").value;
            if(!obraId){ toast("Selecione a obra da Execução."); return; }
            obraIds = [obraId];
          }else{
            obraIds = ["*"];
          }

          (state.users||[]).push({ id, name, role, pin, obraIds, active:true });
          saveState();
          toast("Usuário criado.");
          closeModal();
          render();
        } }
    ]
  });

  const roleEl = $("#nuRole");
  const wrap = $("#nuObraWrap");
  const sync = ()=>{ wrap.style.display = (roleEl.value==="execucao") ? "block" : "none"; };
  roleEl.addEventListener("change", sync);
  sync();
}

function openSetPinModal(target){
  const u = currentUser();
  if(!canManageUsers(u)) return;
  openModal({
    title: "Trocar PIN",
    bodyHTML: `
      <div class="small">Usuário: <b>${escapeHTML(target.name)}</b> (${escapeHTML(target.id)})</div>
      <div style="height:10px"></div>
      <label class="small">Novo PIN</label>
      <input id="newPin" class="input" placeholder="4 dígitos" inputmode="numeric">
    `,
    actions: [
      { label:"Cancelar", className:"", onClick: ()=>{} },
      { label:"Salvar", className:"btn--green", onClick: ()=>{
          const p = $("#newPin").value.trim();
          if(!p || p.length<4){ toast("PIN mínimo 4 dígitos."); return; }
          target.pin = p;
          saveState();
          toast("PIN atualizado.");
          closeModal();
          render();
        } }
    ]
  });
}

function toggleUserActive(target){
  const u = currentUser();
  if(!canManageUsers(u)) return;
  if(target.id === state.session?.userId){ toast("Não é possível desativar seu próprio acesso."); return; }
  target.active = !target.active;
  saveState();
  toast(target.active ? "Usuário ativado." : "Usuário desativado.");
  render();
}

function confirmDeleteUser(target){
  const u = currentUser();
  if(!canDeleteUser(u, target.role)){ toast("Apenas Supervisor remove Qualidade/Execução."); return; }
  if(target.id === state.session?.userId){ toast("Não é possível remover seu próprio acesso."); return; }
  openModal({
    title: "Remover usuário",
    bodyHTML: `
      <div class="small">Remover acesso de:</div>
      <div style="margin-top:6px;font-weight:950;font-size:16px">${escapeHTML(target.name)}</div>
      <div class="small" style="margin-top:4px">${escapeHTML(target.id)} • ${escapeHTML(ROLES[target.role]||target.role)}</div>
      <div class="small" style="margin-top:8px;color:#FFD6D6">Essa ação apaga o usuário deste aparelho.</div>
    `,
    actions: [
      { label:"Cancelar", className:"", onClick: ()=>{} },
      { label:"Remover", className:"btn--danger", onClick: ()=>{
          state.users = (state.users||[]).filter(x=>x.id!==target.id);
          saveState();
          toast("Usuário removido.");
          closeModal();
          render();
        } }
    ]
  });
}


function calcObraStats(obraId){
  const obra = state.obras[obraId];
  if(!obra) return null;
  let totalApt=0, liberados=0, aguardando=0, pendentes=0;
  Object.values(obra.blocks||{}).forEach(b=>{
    Object.values(b.apartments||{}).forEach(a=>{
      totalApt++;
      const ps = a.pendencias || [];
      const hasPendente = ps.some(p=>p.state==="pendente" || p.state==="reprovado");
      const hasAguard = ps.some(p=>p.state==="feito");
      const allDone = (ps.length>0) && ps.every(p=>p.state==="conferido");
      if(allDone) liberados++;
      else if(hasPendente) pendentes++;
      else if(hasAguard) aguardando++;
      // else: sem pendências cadastradas ainda (fica fora dos 3 indicadores)
    });
  });
  return { obraId, name: obra.name, totalApt, liberados, aguardando, pendentes };
}

function renderDashboard(){
  if(!requireLogin()) return;
  const u = currentUser();
  setSubtitle("Visão Geral");

  const v = $("#view");
  const stats = (state.obras_index||[]).map(o=>calcObraStats(o.id)).filter(Boolean);

  const tot = stats.reduce((acc,s)=>({
    totalApt: acc.totalApt + s.totalApt,
    liberados: acc.liberados + s.liberados,
    aguardando: acc.aguardando + s.aguardando,
    pendentes: acc.pendentes + s.pendentes
  }), {totalApt:0, liberados:0, aguardando:0, pendentes:0});

  const rows = stats.map(s=>`
    <tr>
      <td style="padding:10px 8px"><b>${escapeHTML(s.name)}</b><div class="small">Total: ${s.totalApt}</div></td>
      <td style="padding:10px 8px;text-align:center"><b>${s.liberados}</b></td>
      <td style="padding:10px 8px;text-align:center"><b>${s.aguardando}</b></td>
      <td style="padding:10px 8px;text-align:center"><b>${s.pendentes}</b></td>
      <td style="padding:10px 8px;text-align:right"><button class="btn" data-open="${escapeAttr(s.obraId)}">Abrir</button></td>
    </tr>
  `).join("");

  v.innerHTML = `
    <div class="card">
      <div class="sectionTitle" style="margin-top:0">
        <h2>Resumo geral</h2>
        <div class="hint">Diretor/Engenheiro/Coordenador: somente visualização</div>
      </div>

      <div class="kpis">
        <div class="kpi">
          <div class="kpi__v">${tot.liberados}</div>
          <div class="kpi__l">Concluídos (conferidos)</div>
        </div>
        <div class="kpi">
          <div class="kpi__v">${tot.aguardando}</div>
          <div class="kpi__l">Aguardando conferência</div>
        </div>
        <div class="kpi">
          <div class="kpi__v">${tot.pendentes}</div>
          <div class="kpi__l">Com pendência</div>
        </div>
      </div>

      <div class="small" style="margin-top:10px">Total de apartamentos cadastrados: <b>${tot.totalApt}</b></div>

      <hr class="hr">

      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px" class="small">Obra</th>
            <th style="text-align:center;padding:8px" class="small">Concluídos</th>
            <th style="text-align:center;padding:8px" class="small">Aguardando</th>
            <th style="text-align:center;padding:8px" class="small">Pendência</th>
            <th style="text-align:right;padding:8px" class="small"></th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="5" class="small" style="padding:10px">Nenhuma obra cadastrada.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  v.querySelectorAll("button[data-open]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const obraId = btn.getAttribute("data-open");
      router.go("obra", { obraId });
    });
  });
}

function renderHome(){
  if(!requireLogin()) return;
  setSubtitle("Obras");
  const v = $("#view");
  const last = state.last_obras_refresh ? fmtDT(state.last_obras_refresh) : "—";

  v.innerHTML = `
    <div class="card">
      <div class="sectionTitle" style="margin-top:0">
        <h2>Selecione a obra</h2>
        <span class="badge badge--orange">Atualizado: ${escapeHTML(last)}</span>
      </div>
      <div class="rowActions">
        <button id="btnRefreshObras" class="btn btn--orange">Atualizar obras</button>
        ${(currentUser() && currentUser().role!== "execucao") ? `<button id="btnDash" class="btn">Visão Geral</button>` : ``}
        ${canAddObra(currentUser()) ? `<button id="btnAddObra" class="btn btn--green">+ Adicionar obra</button>` : ``}
        ${canManageUsers(currentUser()) ? `<button id="btnUsers" class="btn">Usuários</button>` : ``}
      </div>
      <hr class="hr">
      <div class="grid" id="obrasList"></div>
    </div>
  `;

  $("#btnRefreshObras").addEventListener("click", ()=>{
    refreshObrasIndex();
    toast("Obras atualizadas.");
    render();
  });

  if($("#btnAddObra")) $("#btnAddObra").addEventListener("click", ()=> openAddObraModal());
  if($("#btnUsers")) $("#btnUsers").addEventListener("click", ()=> router.go("users"));
  if($("#btnDash")) $("#btnDash").addEventListener("click", ()=> router.go("dash"));

  const list = $("#obrasList");

  function removeObra(obraId){
    const u = currentUser();
    if(!canDeleteObra(u)){
      toast("Apenas Supervisor pode remover obra.");
      return;
    }
    openModal({
      title: "Remover obra?",
      bodyHTML: `<div class="small">Isso apagará a obra e todas as pendências dela no protótipo.</div>`,
      actions: [
        { label:"Cancelar", className:"", onClick: ()=>{} },
        { label:"Remover", className:"btn--danger", onClick: ()=>{
            delete state.obras[obraId];
            state.obras_index = state.obras_index.filter(x=>x.id !== obraId);
            saveState();
            toast("Obra removida.");
            closeModal();
            render();
          } }
      ]
    });
  }

  list.addEventListener("click", (e)=>{
    const openBtn = e.target.closest("button[data-open-obra]");
    const delBtn = e.target.closest("button[data-del-obra]");
    if(openBtn){
      const id = openBtn.getAttribute("data-open-obra");
      router.go("obra", { obraId:id });
      return;
    }
    if(delBtn){
      const id = delBtn.getAttribute("data-del-obra");
      removeObra(id);
      return;
    }
  });

  ( (function(){ const u=currentUser(); const idx=state.obras_index||[]; if(!u) return idx; if(u.role==='execucao') return idx.filter(x=>(u.obraIds||[]).includes(x.id)); return idx; })() ).forEach(o=>{
    const el = document.createElement("div");
    el.className = "card";
    el.style.cursor = "pointer";

    const cfg = o.config || state.obras?.[o.id]?.config || {};
    const blocks = cfg.numBlocks ?? 17;
    const aptsPerBlock = cfg.aptsPerBlock ?? 12;

    const u = currentUser();
    const canDelete = (u && u.role === "supervisor");

    el.innerHTML = `
      <div class="sectionTitle" style="margin:0 0 6px">
        <h2 style="font-size:16px">${escapeHTML(o.name)}</h2>
        <span class="badge badge--green">PWA</span>
      </div>
      <div class="small">Blocos: <b>${blocks}</b> • Aptos/Bloco: <b>${aptsPerBlock}</b></div>
      ${canDelete ? `
        <div class="rowActions" style="margin-top:10px">
          <button class="btn" data-act="editObra" data-obra="${escapeAttr(o.id)}">Configurar</button>
          <button class="btn btn--danger" data-act="delObra" data-obra="${escapeAttr(o.id)}">Remover</button>
        </div>
      ` : `<div class="small" style="margin-top:8px">Toque para abrir</div>`}
    `;

    // click to open only when not clicking buttons
    el.addEventListener("click", (ev)=>{
      const btn = ev.target.closest("button[data-act]");
      if(btn) return;
      router.go("obra", { obraId:o.id });
    });

    list.appendChild(el);
  });
}

function renderObra({obraId}){
  if(!requireLogin()) return;
  const obra = state.obras[obraId];
  setSubtitle("Obra • " + obra.name);

  const blocks = Object.values(obra.blocks);
  let totalApt=0, liberados=0, aguardando=0, pendentes=0;
  blocks.forEach(b=>{
    Object.values(b.apartments).forEach(a=>{
      totalApt++;
      const st = aptStatus(a);
      if(st==="liberado") liberados++;
      else if(st==="aguardando") aguardando++;
      else pendentes++;
    });
  });

  const v = $("#view");
  v.innerHTML = `
    <div class="card">
      <div class="sectionTitle">
        <h2>${escapeHTML(obra.name)} — Blocos</h2>
        <div class="hint">Blocos 1 a 17</div>
      </div>
      <div class="kpis">
        <div class="kpi">
          <div class="kpi__v">${liberados}</div>
          <div class="kpi__l">Concluídos (conferidos)</div>
        </div>
        <div class="kpi">
          <div class="kpi__v">${aguardando}</div>
          <div class="kpi__l">Aguardando conferência</div>
        </div>
        <div class="kpi">
          <div class="kpi__v">${pendentes}</div>
          <div class="kpi__l">Com pendência</div>
        </div>
      </div>
      <div class="small" style="margin-top:8px">Total de aptos: <b>${totalApt}</b></div>
      <hr class="hr">
      <div class="grid" id="blocks"></div>
    </div>
  `;

  const list = $("#blocks");
  blocks.forEach((b)=>{
    let bTotal=0, bOk=0, bWait=0, bBad=0;
    Object.values(b.apartments).forEach(a=>{
      bTotal++;
      const st = aptStatus(a);
      if(st==="liberado") bOk++;
      else if(st==="aguardando") bWait++;
      else bBad++;
    });

    const el = document.createElement("div");
    el.className = "card";
    el.style.cursor = "default";
    el.innerHTML = `
      <div class="sectionTitle" style="margin:0 0 6px">
        <h2 style="font-size:16px">${escapeHTML(b.name)}</h2>
        <span class="badge badge--green">✅ ${bOk}</span>
      </div>
      <div class="small">Aptos: ${bTotal} • 🟡 ${bWait} • 🔴 ${bBad}</div>
      <div class="small" style="margin-top:8px">Toque para abrir</div>
    `;
    el.addEventListener("click", ()=> router.go("bloco", { obraId, blocoId: b.id }));
    list.appendChild(el);
  });
}

function renderBloco({obraId, blocoId}){
  if(!requireLogin()) return;
  const obra = state.obras[obraId];
  const bloco = obra.blocks[blocoId];
  setSubtitle(`Obra • ${obra.name} • ${bloco.name}`);

  const cfg = obra.config || { aptsPerBlock: 12 };
  const levels = [
    { label:"Térreo", nums:[101,102,103,104] },
    { label:"1º pav", nums:[201,202,203,204] },
    { label:"2º pav", nums:[301,302,303,304] }
  ];
  if(Number(cfg.aptsPerBlock) === 16){
    levels.push({ label:"3º pav", nums:[401,402,403,404] });
  }

  const v = $("#view");
  v.innerHTML = `
    <div class="card">
      <div class="sectionTitle">
        <h2>${escapeHTML(bloco.name)}</h2>
        <div class="hint">12 aptos • toque para abrir</div>
      </div>
      <div id="levels"></div>
      <hr class="hr">
      <div class="small">Legenda: 🔴 pendente • 🟡 aguardando vistoria • ✅ liberado</div>
    </div>
  `;

  const wrap = $("#levels");
  levels.forEach(l=>{
    const row = document.createElement("div");
    row.innerHTML = `<div class="aptRowTitle">${escapeHTML(l.label)}</div><div class="aptGrid"></div>`;
    const grid = row.querySelector(".aptGrid");
    l.nums.forEach(n=>{
      const apt = bloco.apartments[String(n)];
      const st = aptStatus(apt);
      const openCount = openCountForApt(apt);
      const el = document.createElement("div");
      el.className = "aptCard";
      el.innerHTML = `
        <div class="aptTop">
          <div class="aptNum">${n}</div>
          <div class="${statusDotClass(st)}"></div>
        </div>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px">
          ${statusBadge(st, openCount)}
          <span class="badge badge--orange">📋 ${apt.pendencias.length}</span>
        </div>
      `;
      el.addEventListener("click", ()=> router.go("apto", { obraId, blocoId, apto: String(n) }));
      grid.appendChild(el);
    });
    wrap.appendChild(row);
  });
}

function stateTag(p){
  if(p.state==="pendente") return `<span class="tag tag--state-red">🔴 ${STATE_LABEL[p.state]}</span>`;
  if(p.state==="feito") return `<span class="tag tag--state-yellow">🟡 ${STATE_LABEL[p.state]}</span>`;
  if(p.state==="conferido") return `<span class="tag tag--state-green">✅ ${STATE_LABEL[p.state]}</span>`;
  if(p.state==="reprovado") return `<span class="tag tag--state-red">❌ ${STATE_LABEL[p.state]}</span>`;
  if(p.state==="reaberto") return `<span class="tag tag--state-orange">♻️ ${STATE_LABEL[p.state]}</span>`;
  return `<span class="tag">${escapeHTML(p.state)}</span>`;
}

function renderApto({obraId, blocoId, apto}){
  if(!requireLogin()) return;
  const obra = state.obras[obraId];
  const bloco = obra.blocks[blocoId];
  const apt = bloco.apartments[String(apto)];
  const u = currentUser();

  const st = aptStatus(apt);
  const stLabel = st==="liberado" ? "✅ LIBERADO" : (st==="aguardando" ? "🟡 AGUARDANDO VISTORIA" : "🔴 PENDENTE");

  setSubtitle(`Obra • ${obra.name} • ${bloco.name} • Apto ${apto}`);

  const v = $("#view");
  v.innerHTML = `
    <div class="card">
      <div class="sectionTitle">
        <h2>${escapeHTML(bloco.name)} — Apto ${escapeHTML(apto)}</h2>
        <span class="badge ${st==="liberado" ? "badge--green" : (st==="aguardando" ? "badge--yellow" : "badge--red")}">${stLabel}</span>
      </div>

      <div class="rowActions">
        ${canCreate(u) ? `<button id="btnAdd" class="btn btn--orange">+ Nova pendência</button>` : ``}
        <button id="btnLogs" class="btn">Histórico</button>
      </div>

      <hr class="hr">

      <div class="sectionTitle" style="margin-top:0">
        <h2>Pendências</h2>
        <div class="hint">${apt.pendencias.length} item(ns)</div>
      </div>

      <div id="list" class="list"></div>
      ${apt.pendencias.length===0 ? `<div class="small">Sem pendências cadastradas. ${canCreate(u) ? "Clique em <b>Nova pendência</b> para adicionar." : ""}</div>` : ``}
    </div>
  `;

  if(canCreate(u)) $("#btnAdd").addEventListener("click", ()=> openAddPendencia({obraId, blocoId, apto}));
  $("#btnLogs").addEventListener("click", ()=> openLogs(apt));

  const list = $("#list");
  apt.pendencias
    .slice()
    .sort((a,b)=> {
      const order = { pendente:0, reprovado:1, reaberto:2, feito:3, conferido:4 };
      return (order[a.state] ?? 99) - (order[b.state] ?? 99);
    })
    .forEach(p=>{
      const el = document.createElement("div");
      el.className = "item";

      const created = `${p.createdBy?.name || "—"} • ${fmtDT(p.createdAt)}`;
      const done = p.doneAt ? `${p.doneBy?.name || "—"} • ${fmtDT(p.doneAt)}` : "—";
      const reviewed = p.reviewedAt ? `${p.reviewedBy?.name || "—"} • ${fmtDT(p.reviewedAt)}` : "—";

      const rejectionBlock = p.rejection ? `
        <div style="margin-top:10px">
          <div class="small" style="color:#FFD6D6;font-weight:900">Reprovação</div>
          <div class="small">Motivo: <b>${escapeHTML(p.rejection.reason)}</b></div>
          ${p.rejection.note ? `<div class="small">Obs.: ${escapeHTML(p.rejection.note)}</div>` : ``}
          <div class="small">Por: ${escapeHTML(p.rejection.by)} • ${fmtDT(p.rejection.at)}</div>
        </div>
      ` : ``;

      el.innerHTML = `
        <div class="item__top">
          <div>
            <div class="item__title">${escapeHTML(p.title)}</div>
            <div class="item__meta">Criado: ${escapeHTML(created)}</div>
          </div>
          <div class="item__tags">
            ${stateTag(p)}
          </div>
        </div>

        <div class="item__tags">
          <span class="tag tag--cat">🏷 ${escapeHTML(p.category || "Sem categoria")}</span>
          <span class="tag tag--loc">📍 ${escapeHTML(p.location || "Sem local")}</span>
        </div>

        <div class="small" style="margin-top:8px">
          <div>Feito: <b>${escapeHTML(done)}</b></div>
          <div>Conferido: <b>${escapeHTML(reviewed)}</b></div>
        </div>

        ${rejectionBlock}

        <div class="rowActions">
          ${renderItemActions(u, p)}
        </div>
      `;
      list.appendChild(el);
    });

  attachItemActionHandlers(); // safe to call
}

function renderItemActions(u, p){
  const parts = [];
  if(canMarkDone(u) && ["pendente","reprovado","reaberto"].includes(p.state)){
    parts.push(`<button class="btn btn--green" data-act="done" data-id="${p.id}">Marcar FEITO</button>`);
  }
  if(canReview(u) && p.state === "feito"){
    parts.push(`<button class="btn btn--green" data-act="approve" data-id="${p.id}">CONFERIR</button>`);
    parts.push(`<button class="btn btn--danger" data-act="reject" data-id="${p.id}">REPROVAR</button>`);
  }
  if(canReopen(u) && ["conferido","feito"].includes(p.state)){
    parts.push(`<button class="btn btn--orange" data-act="reopen" data-id="${p.id}">REABRIR</button>`);
  }
  if(canCreate(u)){
    parts.push(`<button class="btn" data-act="edit" data-id="${p.id}">Editar</button>`);
  }
  return parts.join("") || `<span class="small">Sem ações para seu perfil.</span>`;
}

// Delegated click handler (one-time)
let delegatedReady = false;
function attachItemActionHandlers(){
  const v = $("#view");
  if(delegatedReady || !v) return;
  delegatedReady = true;

  v.addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-act]");
    if(!btn) return;
    const act = btn.getAttribute("data-act");
    const id = btn.getAttribute("data-id");

    const cur = router.current();
    const {obraId, blocoId, apto} = cur.params || {};
    if(!obraId || !blocoId || !apto) return;

    const aptObj = getApartment(obraId, blocoId, apto);
    const p = aptObj.pendencias.find(x=>x.id===id);
    if(!p) return;

    if(act==="done") return actionDone(aptObj, p);
    if(act==="approve") return actionApprove(aptObj, p);
    if(act==="reject") return actionReject(aptObj, p);
    if(act==="reopen") return actionReopen(aptObj, p);
    if(act==="edit") return actionEdit(aptObj, p);
  }, { passive:true });
}

function actionDone(apt, p){
  const u = currentUser();
  if(!canMarkDone(u)) return;
  p.state = "feito";
  p.doneBy = { name: u.name, role: u.role };
  p.doneAt = nowISO();
  p.rejection = null;
  logAction(apt, `Marcou FEITO: ${p.title}`);
  saveState();
  toast("Marcado como FEITO.");
  render();
}

function actionApprove(apt, p){
  const u = currentUser();
  if(!canReview(u)) return;
  p.state = "conferido";
  p.reviewedBy = { name: u.name, role: u.role };
  p.reviewedAt = nowISO();
  p.rejection = null;
  logAction(apt, `Conferiu (APROVADO): ${p.title}`);
  saveState();
  toast("Conferido ✅");
  render();
}

function actionReject(apt, p){
  const u = currentUser();
  if(!canReview(u)) return;

  openModal({
    title: "Reprovar pendência",
    bodyHTML: `
      <div class="small">Pendência: <b>${escapeHTML(p.title)}</b></div>
      <div style="height:10px"></div>
      <label class="small">Motivo (obrigatório)</label>
      <input id="rejReason" class="input" placeholder="Ex.: ainda com vazamento">
      <div style="height:10px"></div>
      <label class="small">Observação (opcional)</label>
      <textarea id="rejNote" class="input" placeholder="Detalhe o que precisa ser corrigido..."></textarea>
      <div class="small" style="margin-top:8px">Ao reprovar, o item volta a exigir ação da Execução.</div>
    `,
    actions: [
      { label:"Cancelar", className:"", onClick: ()=>{} },
      { label:"Reprovar", className:"btn--danger", onClick: ()=>{
          const reason = $("#rejReason").value.trim();
          const note = $("#rejNote").value.trim();
          if(!reason){ toast("Informe o motivo."); return; }

          p.state = "reprovado";
          p.rejection = { reason, note, by: `${u.name}`, at: nowISO() };
          p.reviewedBy = { name: u.name, role: u.role };
          p.reviewedAt = nowISO();

          logAction(apt, `Reprovou: ${p.title} • Motivo: ${reason}`);
          saveState();
          toast("Reprovado ❌");
          // Close modal explicitly before rerender (iPhone)
          closeModal();
          render();
        } }
    ]
  });
}

function actionReopen(apt, p){
  const u = currentUser();
  if(!canReopen(u)) return;
  p.state = "reaberto";
  p.reopenedAt = nowISO();
  p.rejection = null;
  logAction(apt, `Reabriu: ${p.title}`);
  saveState();
  toast("Reaberto ♻️");
  render();
}

function actionEdit(apt, p){
  const u = currentUser();
  if(!canCreate(u)) return;
  openModal({
    title: "Editar pendência",
    bodyHTML: `
      <label class="small">Título</label>
      <input id="edTitle" class="input" value="${escapeAttr(p.title)}">
      <div style="height:10px"></div>
      <div class="formRow">
        <div>
          <label class="small">Categoria</label>
          <input id="edCat" class="input" value="${escapeAttr(p.category||"")}">
        </div>
        <div>
          <label class="small">Local</label>
          <input id="edLoc" class="input" value="${escapeAttr(p.location||"")}">
        </div>
      </div>
      <div class="small" style="margin-top:8px">A edição fica registrada no histórico.</div>
    `,
    actions: [
      { label:"Cancelar", className:"", onClick: ()=>{} },
      { label:"Salvar", className:"btn--green", onClick: ()=>{
          const t = $("#edTitle").value.trim();
          if(!t){ toast("Título obrigatório."); return; }
          p.title = t;
          p.category = $("#edCat").value.trim();
          p.location = $("#edLoc").value.trim();
          logAction(apt, `Editou: ${p.title}`);
          saveState();
          toast("Salvo.");
          closeModal();
          render();
        } }
    ]
  });
}

function openAddPendencia({obraId, blocoId, apto}){
  const u = currentUser();
  if(!canCreate(u)) return;

  openModal({
    title: "Nova pendência",
    bodyHTML: `
      <div class="small">Apto <b>${escapeHTML(apto)}</b> — ${escapeHTML(state.obras[obraId].blocks[blocoId].name)}</div>
      <div style="height:10px"></div>
      <label class="small">Título (obrigatório)</label>
      <input id="pTitle" class="input" placeholder="Ex.: Vazamento no registro do banho">
      <div style="height:10px"></div>
      <div class="formRow">
        <div>
          <label class="small">Categoria</label>
          <input id="pCat" class="input" placeholder="Ex.: Hidráulica">
        </div>
        <div>
          <label class="small">Local</label>
          <input id="pLoc" class="input" placeholder="Ex.: Banheiro">
        </div>
      </div>
      <div class="small" style="margin-top:8px">Criado por: <b>${escapeHTML(u.name)} (${escapeHTML(ROLES[u.role])})</b></div>
    `,
    actions: [
      { label:"Cancelar", className:"", onClick: ()=>{} },
      { label:"Adicionar", className:"btn--orange", onClick: ()=>{
          const title = $("#pTitle").value.trim();
          if(!title){ toast("Título obrigatório."); return; }
          const aptObj = getApartment(obraId, blocoId, apto);
          const p = {
            id: uid("p"),
            title,
            category: $("#pCat").value.trim(),
            location: $("#pLoc").value.trim(),
            state: "pendente",
            createdBy: { name: u.name, role: u.role },
            createdAt: nowISO(),
            doneBy: null, doneAt: null,
            reviewedBy: null, reviewedAt: null,
            rejection: null,
            reopenedAt: null
          };
          aptObj.pendencias.unshift(p);
          logAction(aptObj, `Criou pendência: ${title}`);
          saveState();
          toast("Pendência adicionada.");
          closeModal();
          render();
        } }
    ]
  });
}

function openLogs(apt){
  const logs = apt.logs || [];
  const html = logs.length ? logs.map(l=>`
    <div class="item" style="box-shadow:none">
      <div style="font-weight:900">${escapeHTML(l.who)}</div>
      <div class="small">${fmtDT(l.at)}</div>
      <div style="margin-top:6px">${escapeHTML(l.action)}</div>
    </div>
  `).join("") : `<div class="small">Sem histórico ainda.</div>`;

  openModal({
    title: "Histórico do apartamento",
    bodyHTML: `<div class="list">${html}</div>`,
    actions: [{ label:"Fechar", className:"", onClick: ()=>{} }]
  });
}

function escapeHTML(s){
  return String(s ?? "").replace(/[&<>"']/g, (c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function escapeAttr(s){ return escapeHTML(s).replace(/"/g,"&quot;"); }

function render(){
  // Hard stop for stuck overlays on iPhone: close any modal on navigation
  closeModal();

  syncTopbar();
  const cur = router.current();
  delegatedReady = false; // re-attach delegation per view safely

  if(cur.route === "login") return renderLogin();
  if(cur.route === "home") return renderHome();
  if(cur.route === "users") return renderUsers();
  if(cur.route === "dash") return renderDashboard();
  if(cur.route === "obra") return renderObra(cur.params);
  if(cur.route === "bloco") return renderBloco(cur.params);
  if(cur.route === "apto") return renderApto(cur.params);
  return renderLogin();
}

// Boot

// iOS safety: always re-render after navigation
const _routerGo = router.go.bind(router);
router.go = (route, params={})=>{
  _routerGo(route, params);
  setTimeout(()=>safeRender(), 0);
};

(function boot(){
  const start = ()=>{
    router.stack = [];
    const u = currentUser();
    if(u){
      if(u.role === "execucao"){
        const obraId = (u.obraIds||[])[0];
        forceNav("obra",{obraId});
    }else if(typeof canViewOnly === "function" && canViewOnly(u)){
      forceNav("dash");
    }else{
      forceNav("home");
    }
  }else{
    forceNav("login");
  }
    setTimeout(()=>safeRender(), 0);
  };
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", start, { once:true });
  }else{
    start();
  }
})();
