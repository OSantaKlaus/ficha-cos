/* ============================================================
   FICHA DE D&D 5e — script.js
   Lógica e interatividade — suporte a múltiplos personagens

   ÍNDICE:
   1.  Configuração: Atributos e Perícias
   2.  Funções de mecânica D&D (modificadores, etc.)
   3.  Atualização central (atualizarTudo)
   4.  Cálculo de CA (Defesa)
   5.  Barra de PV
   6.  Render de Saves e Perícias
   7.  Render de Espaços de Magia
   8.  Ataques e Munições (linhas dinâmicas)
   9.  Cards expansíveis (Habilidades e Magias)
   10. Tags (Línguas e Talentos)
   11. Imagem do personagem
   12. Controle de Abas
   13. Salvar ficha (localStorage)
   14. Carregar ficha (localStorage)
   15. Inicialização (window.onload)
============================================================ */

/* ============================================================
   0. IDENTIFICAÇÃO DO PERSONAGEM (multi-personagem)
   ── O ID vem da URL: ficha.html?id=gasphar
   ── Todas as chaves do localStorage são prefixadas
      com esse ID para isolar os dados de cada personagem.
============================================================ */

const personagemId = new URLSearchParams(location.search).get('id') || 'personagem'

// Helper: acessa o localStorage sempre com prefixo do personagem
const ls = {
    get: k   => localStorage.getItem(personagemId + ':' + k),
    set: (k, v) => localStorage.setItem(personagemId + ':' + k, v),
    del: k   => localStorage.removeItem(personagemId + ':' + k),
}

/* ============================================================
   1. CONFIGURAÇÃO: ATRIBUTOS E PERÍCIAS
   ── Para adicionar um novo atributo, adicione aqui
      e crie o HTML correspondente com o mesmo id.
   ── Para adicionar uma perícia, adicione um objeto
      { nome: 'Nome', attr: 'id-do-atributo' } na lista.
============================================================ */

// IDs dos seis atributos base
const ATTRS = ['for', 'des', 'con', 'int', 'sab', 'car']

// Nomes completos para exibição nos Saves
const ATTR_NOMES = {
    for: 'Força',
    des: 'Destreza',
    con: 'Constituição',
    int: 'Inteligência',
    sab: 'Sabedoria',
    car: 'Carisma'
}

// Lista completa de perícias com seu atributo base
// Para adicionar uma perícia: { nome: 'Nome', attr: 'id-atributo' }
const PERICIAS = [
    { nome: 'Acrobacia', attr: 'des' },
    { nome: 'Arcanismo', attr: 'int' },
    { nome: 'Atletismo', attr: 'for' },
    { nome: 'Atuação', attr: 'car' },
    { nome: 'Enganação', attr: 'car' },
    { nome: 'Furtividade', attr: 'des' },
    { nome: 'História', attr: 'int' },
    { nome: 'Intimidação', attr: 'car' },
    { nome: 'Intuição', attr: 'sab' },
    { nome: 'Investigação', attr: 'int' },
    { nome: 'Lidar c/ Animais', attr: 'sab' },
    { nome: 'Medicina', attr: 'sab' },
    { nome: 'Natureza', attr: 'int' },
    { nome: 'Percepção', attr: 'sab' },
    { nome: 'Persuasão', attr: 'car' },
    { nome: 'Prestidigitação', attr: 'des' },
    { nome: 'Religião', attr: 'int' },
    { nome: 'Sobrevivência', attr: 'sab' },
]


/* ============================================================
   2. FUNÇÕES DE MECÂNICA D&D
   ── calcMod: fórmula oficial — floor((valor - 10) / 2)
      Ex: valor 16 → mod +3 | valor 8 → mod -1
   ── fmtMod: formata o número com sinal ("+3", "-1", "+0")
============================================================ */

function calcMod(v) {
    const n = parseInt(v) || 10
    return Math.floor((n - 10) / 2)
}

function fmtMod(n) {
    return (n >= 0 ? '+' : '') + n
}

// Atalhos para pegar valores dos elementos HTML
const g = id => document.getElementById(id)                    // elemento pelo id
const gV = id => g(id)?.value || ''                             // valor como texto
const gN = id => parseInt(g(id)?.value) || 0                    // valor como número inteiro
const gA = id => parseInt(g(id)?.value) || 10                   // valor de atributo (padrão 10)
const gP = () => parseInt(g('proficiencia')?.value) || 2       // bônus de proficiência


/* ============================================================
   3. ATUALIZAÇÃO CENTRAL
   ── Chamada sempre que um atributo ou proficiência muda.
      Recalcula: modificadores, saves, perícias, iniciativa
      e sabedoria passiva de uma vez.
============================================================ */

function atualizarTudo() {
    const prof = gP()

    // Atualiza os modificadores de todos os atributos
    ATTRS.forEach(id => {
        g(id + '-mod').textContent = fmtMod(calcMod(gA(id)))
    })

    // Atualiza os bônus dos testes de resistência
    ATTRS.forEach(id => {
        const on = g('save-dot-' + id)?.classList.contains('on') // proficiente?
        const b = calcMod(gA(id)) + (on ? prof : 0)
        const el = g('save-bonus-' + id)
        if (el) el.textContent = fmtMod(b)
    })

    // Atualiza os bônus das perícias
    PERICIAS.forEach(p => {
        const sid = skillId(p.nome)
        const cb = g(sid)                    // checkbox de proficiência
        const b = calcMod(gA(p.attr)) + (cb?.checked ? prof : 0)
        const bel = g(sid + '-bonus')
        if (bel) bel.textContent = fmtMod(b)
    })

    // Iniciativa = mod Destreza (mas só se o jogador não digitou manualmente)
    const iniEl = g('iniciativa')
    if (iniEl && iniEl.dataset.manual !== 'true')
        iniEl.value = fmtMod(calcMod(gA('des')))

    // Sabedoria Passiva = 10 + mod SAB + bônus prof (se proficiente em Percepção)
    const sp = g('sab-passiva')
    if (sp) {
        const percId = skillId('Percepção')
        const proficientePerc = g(percId)?.checked || false
        const prof = gN('proficiencia') || 2
        sp.value = 10 + calcMod(gA('sab')) + (proficientePerc ? prof : 0)
    }

    calcularCA()
    atualizarPVBar()
    sincronizarProfNivel()  // nível → proficiência automático
    // Atualiza pontos de magia se o painel estiver ativo
    if (g('spell-points-panel')?.style.display !== 'none') atualizarSpellPoints()
}

/* Tabela oficial D&D 5e: nível → bônus de proficiência
   Nível 1-4: +2 | 5-8: +3 | 9-12: +4 | 13-16: +5 | 17-20: +6  */
function sincronizarProfNivel() {
    const nivel = gN('nivel')
    if (!nivel) return
    const prof = nivel <= 4 ? 2 : nivel <= 8 ? 3 : nivel <= 12 ? 4 : nivel <= 16 ? 5 : 6
    const el = g('proficiencia')
    if (el && el.dataset.manual !== 'true') {
        el.value = prof
    }
}

// Quando o jogador edita a proficiência manualmente, para de recalcular pelo nível
// Quando o jogador edita a iniciativa manualmente, para de recalcular
g('iniciativa').addEventListener('input', function () {
    this.dataset.manual = 'true'
})

g('proficiencia').addEventListener('input', function () {
    this.dataset.manual = 'true'  // para de sincronizar com nível se editado manualmente
})


/* ============================================================
   4. CÁLCULO DE CA (DEFESA)
   ── Fórmula: CA Base + mod Des (com limite) + atributo extra
              + escudo (+2) + bônus extra + def. temporária
   ── Chamado sempre que armadura ou atributos mudam.
============================================================ */

function calcularCA() {
    // CA base da armadura
    const base = gN('arm-ca')

    // Modificador de Destreza (com limite opcional)
    const limite = gV('arm-des-limite')
    let desMod = calcMod(gA('des'))
    if (limite === 'none') desMod = 0              // armadura pesada: não soma Des
    else if (limite === '1') desMod = Math.min(1, desMod) // limite +1
    else if (limite === '2') desMod = Math.min(2, desMod) // limite +2
    // limite === 'full': usa desMod sem restrição

    // Atributo extra (ex: Carisma para Paladino sem armadura)
    const attrExtra = gV('arm-attr-extra')
    const extraMod = attrExtra !== 'none' ? calcMod(gA(attrExtra)) : 0

    // Escudo: +2 se marcado
    const escudo = g('escudo')?.checked ? 2 : 0

    // Bônus extra (magias, talentos, itens mágicos)
    const bonus = gN('arm-bonus')

    // Defesa temporária (ex: Escudo Arcano)
    const temp = gN('ca-temp')

    const total = base + desMod + extraMod + escudo + bonus + temp

    const el = g('ca-total')
    if (el) el.value = total
}


/* ============================================================
   5. BARRA DE PONTOS DE VIDA
   ── Atualiza visualmente a barra vermelha de PV.
      Fica 100% quando PV atual = PV máximo.
============================================================ */

function atualizarPVBar() {
    const max = Math.max(1, gN('pv-max'))
    const cur = gN('pv-atual')
    const pvTemp = parseInt(g('pv-temp')?.value) || 0   // declarado ANTES de usar
    const pct = Math.max(0, Math.min(100, (cur / max) * 100))

    // ── Barra principal de vida ──
    const bar = g('pv-bar')
    if (bar) {
        bar.style.width = pct + '%'
        bar.classList.remove('pv-high', 'pv-medium', 'pv-critical', 'pv-dead')
        if (cur <= 0) bar.classList.add('pv-dead')
        else if (pct <= 25) bar.classList.add('pv-critical')
        else if (pct <= 60) bar.classList.add('pv-medium')
        else bar.classList.add('pv-high')
    }

    // ── Barra de PV temporário sobreposta (dourada) ──
    const tempBar = g('pv-bar-temp')
    if (tempBar) {
        if (pvTemp > 0) {
            const pctTemp = Math.min(100, ((cur + pvTemp) / max) * 100)
            tempBar.style.width = Math.max(pct, pctTemp) + '%'
        } else {
            tempBar.style.width = '0%'
        }
    }

    // ── Texto da barra ──
    const txt = g('pv-bar-text')
    if (txt) txt.textContent = pvTemp > 0 ? cur + ' (+' + pvTemp + ') / ' + max : cur + ' / ' + max

    // ── Coração pulsante (HP crítico) ──
    const heart = g('pv-heart')
    if (heart) heart.style.display = (cur > 0 && pct <= 25) ? 'inline' : 'none'
}


/* ============================================================
   6. RENDER DE SAVES E PERÍCIAS
   ── Gera o HTML das listas dinamicamente a partir dos arrays.
      Os dados salvos são passados para marcar checkboxes.
============================================================ */

// Converte nome de perícia em id HTML válido
// Ex: "Lidar c/ Animais" → "skill-lidar-c-animais"
function skillId(nome) {
    return 'skill-' + nome.toLowerCase().replace(/\s/g, '-').replace(/[^\w-]/g, '')
}

function renderSaves(ss) {
    ss = ss || {}
    g('saves-list').innerHTML = ATTRS.map(id => {
        const on = ss[id] || false
        return `<div class="save-row">
      <div class="save-dot ${on ? 'on' : ''}" id="save-dot-${id}" onclick="toggleSave('${id}')"></div>
      <span>${ATTR_NOMES[id]}</span>
      <span class="save-bonus" id="save-bonus-${id}">+0</span>
    </div>`
    }).join('')
}

function toggleSave(id) {
    g('save-dot-' + id).classList.toggle('on')
    atualizarTudo()
}

function renderPericias(sp) {
    sp = sp || {}
    g('pericias-lista').innerHTML = PERICIAS.map(p => {
        const sid = skillId(p.nome)
        const attrCls = 'attr-' + p.attr.toLowerCase()
        return `<div class="skill-row">
      <input type="checkbox" class="skill-check" id="${sid}" ${sp[sid] ? 'checked' : ''} onchange="atualizarTudo()">
      <span class="skill-name">${p.nome}</span>
      <span class="skill-attr ${attrCls}">${p.attr.toUpperCase()}</span>
      <span class="skill-val" id="${sid}-bonus">+0</span>
    </div>`
    }).join('')
}


/* ============================================================
   7. ESPAÇOS DE MAGIA (Slots por nível)
   ── Gera as pílulas de slot de magia (NV 1 a NV 9).
      Para remover um nível: retire-o do array [1..9].
============================================================ */

function renderSpellSlots(slots) {
    slots = slots || {}
    g('spell-slots').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n =>
        `<div class="slot-pill">
      <label>NV ${n}</label>
      <input type="text" id="slot-${n}" value="${slots[n] || '—'}">
    </div>`
    ).join('')
}


/* ============================================================
   8. ATAQUES E MUNIÇÕES (linhas dinâmicas)
   ── addAtaqueRow: adiciona uma linha na tabela de ataques.
   ── addMunicaoRow: adiciona uma linha na tabela de munições.
   ── Cada linha tem um botão ✕ para remover.
============================================================ */

function addAtaqueRow(nome = '', atk = '', dano = '', tipo = '', notas = '') {
    const tr = document.createElement('tr')
    tr.innerHTML = `
    <td style="width:22%"><input type="text" value="${nome}"></td>
    <td style="width:14%"><input type="text" value="${atk}"></td>
    <td style="width:22%"><input type="text" value="${dano}"></td>
    <td style="width:22%"><input type="text" value="${tipo}"></td>
    <td class="rm"><button class="btn-remove" onclick="this.closest('tr').remove()" title="Remover ataque">✕</button></td>`
    g('attacks-body').appendChild(tr)
}

function addMunicaoRow(tipo = '', qtd = '') {
    const tr = document.createElement('tr')
    tr.innerHTML = `
    <td><input type="text"   value="${tipo}" placeholder="ex: Flechas"></td>
    <td><input type="number" value="${qtd}"  placeholder="0" style="width:80px;"></td>
    <td class="rm"><button class="btn-remove" onclick="this.closest('tr').remove()" title="Remover munição">✕</button></td>`
    g('mun-body').appendChild(tr)
}


/* ============================================================
   9. CARDS EXPANSÍVEIS
   ── addSpellCard: cria um card de truque ou magia.
      withLevel=true: inclui campo de nível e checkbox de preparada.
   ── addHabilidade: cria um card de habilidade de classe/traço.
   ── toggleCard: abre/fecha o corpo do card.
   ── atualizarBadge: atualiza o badge de nível ao digitar.
============================================================ */

let cardCounter = 0 // contador para IDs únicos dos cards

// Cores dos badges por nível de magia (D&D 5e inspirado)
const SPELL_LEVEL_COLORS = {
    0: '#6b7280',   // cinza — truques
    1: '#c0392b',   // vermelho
    2: '#d35400',   // laranja escuro
    3: '#e67e22',   // laranja
    4: '#f39c12',   // amarelo-laranja
    5: '#27ae60',   // verde
    6: '#16a085',   // verde-azulado
    7: '#2980b9',   // azul
    8: '#8e44ad',   // roxo
    9: '#7c4a00',   // dourado escuro épico — nível 9
}

function addSpellCard(listaId, withLevel, data = {}) {
    cardCounter++
    const id = 'card-' + cardCounter
    const div = document.createElement('div')
    div.className = 'exp-card'
    div.id = id

    const nivel = parseInt(data.nivel) || (withLevel ? 1 : 0)
    const cor = SPELL_LEVEL_COLORS[nivel] || SPELL_LEVEL_COLORS[1]

    // Checkbox de "preparada" — onclick para NÃO expandir o card
    const prepCheck = withLevel
        ? `<input type="checkbox" ${data.prep ? 'checked' : ''} title="Magia preparada" onclick="event.stopPropagation()" style="accent-color:var(--gold);flex-shrink:0;">`
        : ''

    // Badge de nível com cor dinâmica
    const badge = withLevel
        ? `<span class="spell-level-badge" id="badge-${id}" style="background:${cor};">NV ${nivel}</span>`
        : ''

    div.innerHTML = `
    <div class="exp-header" onclick="toggleCard('${id}')">
      ${prepCheck}
      ${badge}
      <input type="text" value="${data.nome || ''}"
        class="exp-title-input" id="title-${id}"
        oninput="atualizarBadge('${id}', ${withLevel})"
        onclick="event.stopPropagation()">
      <span class="exp-arrow" id="arr-${id}">▼</span>
      <button class="btn-remove" onclick="event.stopPropagation();document.getElementById('${id}').remove()" title="Remover">✕</button>
    </div>
    <div class="exp-body" id="body-${id}">
      <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:8px;">
        ${withLevel ? `<div class="card-field"><label>NÍVEL</label><input type="number" min="1" max="9" value="${nivel}" id="nivel-${id}" oninput="atualizarBadge('${id}', true)" style="width:50px;"></div>` : ''}
        <div class="card-field"><label>TEMPO DE CONJURAÇÃO</label><input type="text" value="${data.tempo || ''}" style="width:110px;"></div>
        <div class="card-field"><label>ALCANCE</label><input type="text" value="${data.alcance || ''}" style="width:80px;"></div>
        <div class="card-field"><label>COMPONENTES</label><input type="text" value="${data.comp || ''}" style="width:80px;"></div>
        <div class="card-field"><label>DURAÇÃO</label><input type="text" value="${data.dur || ''}" style="width:110px;"></div>
      </div>
      ${data.comp && data.comp.includes('M') || true ? `<div class="card-field" style="margin-bottom:8px;"><label>MATERIAL</label><input type="text" value="${data.material || ''}" style="width:100%;flex:1;"></div>` : ''}
      <span class="card-sublabel">DESCRIÇÃO</span>
      <textarea class="note" style="min-height:70px;">${data.desc || ''}</textarea>
    </div>`
    g(listaId).appendChild(div)
}

// Atualiza o badge "NV X" quando o jogador muda o nível da magia
function atualizarBadge(id, withLevel) {
    if (!withLevel) return
    const nivel = parseInt(g('nivel-' + id)?.value) || 1
    const badge = g('badge-' + id)
    if (badge) {
        badge.textContent = 'NV ' + nivel
        badge.style.background = SPELL_LEVEL_COLORS[nivel] || SPELL_LEVEL_COLORS[1]
    }
}

function addHabilidade(data = {}) {
    cardCounter++
    const id = 'card-' + cardCounter
    const div = document.createElement('div')
    div.className = 'exp-card'
    div.id = id

    const cargas = parseInt(data.cargas) || 0
    const usadas = parseInt(data.cargasUsadas) || 0
    // Mostra badge de cargas no header se tiver cargas
    const cargasBadge = cargas > 0
        ? `<span class="cargas-badge" id="cbadge-${id}">${cargas - usadas}/${cargas}</span>`
        : `<span class="cargas-badge" id="cbadge-${id}" style="display:none;">0/0</span>`

    div.innerHTML = `
    <div class="exp-header" onclick="toggleCard('${id}')">
      <input type="text" value="${data.titulo || ''}"
        class="exp-title-input" onclick="event.stopPropagation()">
      ${cargasBadge}
      <span class="exp-arrow" id="arr-${id}">▼</span>
      <button class="btn-remove" onclick="event.stopPropagation();document.getElementById('${id}').remove()" title="Remover">✕</button>
    </div>
    <div class="exp-body" id="body-${id}">
      <div style="display:flex;flex-wrap:wrap;gap:0.75rem;margin-bottom:8px;align-items:flex-end;">
        <div class="card-field">
          <label>CARGAS TOTAIS</label>
          <input type="number" min="0" value="${cargas}" oninput="atualizarCargasBadge('${id}')">
        </div>
        <div class="card-field">
          <label>USADAS</label>
          <input type="number" min="0" value="${usadas}" oninput="atualizarCargasBadge('${id}')">
        </div>
        <div class="card-field">
          <label>RECUPERA POR</label>
          <select>
            <option ${(data.recupera || '') === 'Descanso Curto' ? 'selected' : ''}>Descanso Curto</option>
            <option ${(data.recupera || '') === 'Descanso Longo' ? 'selected' : ''}>Descanso Longo</option>
            <option ${(data.recupera || '') === 'Ao Amanhecer' ? 'selected' : ''}>Ao Amanhecer</option>
            <option ${(data.recupera || 'N/A') === 'N/A' ? 'selected' : ''}>N/A</option>
          </select>
        </div>
      </div>
      <span class="card-sublabel">DESCRIÇÃO</span>
      <textarea class="note" style="min-height:60px;margin-top:4px;">${data.desc || ''}</textarea>
    </div>`
    g('habilidades-lista').appendChild(div)
}

function atualizarCargasBadge(id) {
    const card = g(id)
    const inputs = card.querySelectorAll('.exp-body input[type=number]')
    const total = parseInt(inputs[0]?.value) || 0
    const usadas = parseInt(inputs[1]?.value) || 0
    const badge = g('cbadge-' + id)
    if (!badge) return
    if (total > 0) {
        badge.style.display = ''
        badge.textContent = (total - usadas) + '/' + total
        badge.className = 'cargas-badge' + (total - usadas === 0 ? ' cargas-esgotadas' : '')
    } else {
        badge.style.display = 'none'
    }
}

// Abre/fecha o corpo de um card
function toggleCard(id) {
    g('body-' + id).classList.toggle('open')
    g('arr-' + id).classList.toggle('open')
}


/* ============================================================
   10. TAGS (LÍNGUAS E TALENTOS)
   ── addTag: adiciona uma nova tag ao container.
      tipo = 'lingua' ou 'talento'
      valor = (opcional) valor pré-definido (usado ao carregar)
   ── coletarTags: coleta todos os textos das tags de um container.
============================================================ */

function addTag(tipo, valor) {
    const inputId = tipo === 'lingua' ? 'lingua-input' : 'talento-input'
    const contId = tipo === 'lingua' ? 'linguas-tags' : 'talentos-tags'
    const val = valor || g(inputId).value.trim()
    if (!val) return

    const tag = document.createElement('div')
    tag.className = 'prof-tag'
    tag.innerHTML = `<span>${val}</span><button onclick="this.parentElement.remove()" title="Remover">×</button>`
    g(contId).appendChild(tag)

    if (!valor) g(inputId).value = '' // limpa o input após adicionar
}

function coletarTags(cid) {
    return Array.from(document.querySelectorAll('#' + cid + ' .prof-tag span')).map(s => s.textContent)
}


/* ============================================================
   11. IMAGEM DO PERSONAGEM
   ── Carrega uma imagem do computador e salva em base64
      no localStorage separadamente (pode ser grande).
============================================================ */

function carregarImagem(event) {
    const file = event.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
        mostrarImagem(e.target.result)
        ls.set('ficha-dnd-img', e.target.result) // salva a imagem separada
    }
    reader.readAsDataURL(file)
}

function mostrarImagem(src) {
    const wrap = g('char-img-wrap')
    const ph = g('img-placeholder')
    let img = wrap.querySelector('img')
    if (!img) {
        img = document.createElement('img')
        wrap.appendChild(img)
    }
    img.src = src
    if (ph) ph.style.display = 'none' // oculta o placeholder
}


/* ============================================================
   12. CONTROLE DE ABAS
   ── Mostra o painel da aba clicada e oculta os demais.
      btn = o botão que foi clicado (passado pelo onclick).
============================================================ */

function showTab(name, btn) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
    g('tab-' + name).classList.add('active')
    btn.classList.add('active')
}


/* ============================================================
   13. SALVAR FICHA (localStorage)
   ── Coleta todos os valores da ficha em um objeto JavaScript
      e o converte para JSON (texto) para salvar no navegador.
   ── Os dados ficam guardados mesmo fechando o navegador.
   ── Para adicionar um novo campo ao salvamento:
      1. Adicione na função salvar() abaixo
      2. Adicione na função carregar() na seção 14
============================================================ */

// Coleta os dados de todas as habilidades
function coletarHabilidades() {
    return Array.from(document.querySelectorAll('#habilidades-lista .exp-card')).map(c => ({
        titulo: c.querySelector('.exp-title-input').value,
        cargas: c.querySelectorAll('input[type=number]')[0]?.value || 0,
        cargasUsadas: c.querySelectorAll('input[type=number]')[1]?.value || 0,
        recupera: c.querySelector('select')?.value || 'N/A',
        desc: c.querySelector('textarea')?.value || '',
    }))
}

// Coleta os dados de truques ou magias
function coletarMagias(listaId, withLevel) {
    return Array.from(document.querySelectorAll('#' + listaId + ' .exp-card')).map(c => {
        const tInputs = c.querySelectorAll('.exp-body input[type=text]')
        const nInput = c.querySelector('.exp-body input[type=number]')
        return {
            prep: c.querySelector('input[type=checkbox]')?.checked || false,
            nome: c.querySelector('.exp-title-input').value,
            nivel: withLevel ? (nInput?.value || 1) : 0,
            tempo: tInputs[0]?.value || '',
            alcance: tInputs[1]?.value || '',
            comp: tInputs[2]?.value || '',
            dur: tInputs[3]?.value || '',
            material: tInputs[4]?.value || '',
            desc: c.querySelector('textarea')?.value || '',
        }
    })
}

function salvar() {
    // Coleta saves (testes de resistência)
    const saves = {}
    ATTRS.forEach(id => { saves[id] = g('save-dot-' + id)?.classList.contains('on') || false })

    // Coleta perícias marcadas
    const pericias = {}
    PERICIAS.forEach(p => { const sid = skillId(p.nome); pericias[sid] = g(sid)?.checked || false })

    // Coleta slots de magia
    const spellSlots = {}
    for (let i = 1; i <= 9; i++) spellSlots[i] = gV('slot-' + i)

    // Objeto principal com todos os dados da ficha
    const dados = {
        // ── Cabeçalho ──
        nome: g('nome-personagem').textContent,
        classe: gV('classe'),
        nivel: gV('nivel'),
        raca: gV('raca'),
        antecedente: gV('antecedente'),
        alinhamento: gV('alinhamento'),
        jogador: gV('jogador'),

        // ── Combate: linha 1 ──
        proficiencia: gV('proficiencia'),
        iniciativa: gV('iniciativa'),
        deslocamento: gV('deslocamento'),
        deslocamentoVoo: gV('deslocamento-voo'),
        deslocamentoNado: gV('deslocamento-nado'),
        deslocamentoEscala: gV('deslocamento-escala'),
        caTemp: gV('ca-temp'),

        // ── Combate: linha 2 ──
        visao: gV('visao'),
        visaoEscuro: g('visao-escuro')?.checked || false,
        exaustao: gV('exaustao'),

        // ── Armadura ──
        armNome: gV('arm-nome'),
        armCA: gV('arm-ca'),
        armDesLimite: gV('arm-des-limite'),
        armAttrExtra: gV('arm-attr-extra'),
        escudo: g('escudo')?.checked || false,
        armBonus: gV('arm-bonus'),
        armDesv: g('arm-desv')?.checked || false,

        // ── Pontos de Vida ──
        pvMax: gV('pv-max'),
        pvAtual: gV('pv-atual'),
        pvTemp: gV('pv-temp'),
        dadoVida: gV('dado-vida'),
        dadoVida2: gV('dado-vida-2'),

        // ── Magias ──
        conjHab: gV('conj-hab'),
        conjCD: gV('conj-cd'),
        conjAtk: gV('conj-atk'),

        // ── Inventário ──
        equipamento: gV('equipamento'),
        itensMagicos: gV('itens-magicos'),
        consumiveis: gV('consumiveis'),
        pc: gV('pc'), pp: gV('pp'), pe: gV('pe'), po: gV('po'), pl: gV('pl'),

        // ── Habilidades ──
        outrasPorf: gV('outras-prof'),
        tracoAntecedente: gV('traco-antecedente'),
        profLeve: g('prof-leve')?.checked || false,
        profMedia: g('prof-media')?.checked || false,
        profPesada: g('prof-pesada')?.checked || false,
        profEscudo: g('prof-escudo')?.checked || false,
        profSimples: g('prof-simples')?.checked || false,
        profMarciais: g('prof-marciais')?.checked || false,

        // ── Descrição ──
        idade: gV('idade'),
        altura: gV('altura'),
        peso: gV('peso'),
        olhos: gV('olhos'),
        pele: gV('pele'),
        cabelo: gV('cabelo'),
        divindade: gV('divindade'),
        aparencia: gV('aparencia'),
        personalidade: gV('personalidade'),
        ideais: gV('ideais'),
        vinculos: gV('vinculos'),
        falhas: gV('falhas'),
        historia: gV('historia'),

        // ── Dados estruturados ──
        atributos: {
            for: gV('for'), des: gV('des'), con: gV('con'),
            int: gV('int'), sab: gV('sab'), car: gV('car')
        },
        saves,
        pericias,
        spellSlots,

        // ── Pontos de Magia ──
        spMode:  ls.get('sp-mode')  || '0',
        spTipo:  gV('sp-tipo'),
        spAtual: ls.get('sp-atual'),

        // ── Listas dinâmicas ──
        ataques: Array.from(document.querySelectorAll('#attacks-body tr')).map(tr => {
            const ins = tr.querySelectorAll('input[type=text]')
            return { nome: ins[0]?.value, atk: ins[1]?.value, dano: ins[2]?.value, tipo: ins[3]?.value, notas: ins[4]?.value }
        }),
        municoes: Array.from(document.querySelectorAll('#mun-body tr')).map(tr => {
            const ins = tr.querySelectorAll('input')
            return { tipo: ins[0]?.value, qtd: ins[1]?.value }
        }),
        habilidades: coletarHabilidades(),
        truques: coletarMagias('truques-lista', false),
        magias: coletarMagias('spells-lista', true),
        resistencias: coletarResVul('res'),
        vulnerabilidades: coletarResVul('vul'),
        imunidades: coletarResVul('imn'),
        linguas: coletarTags('linguas-tags'),
        talentos: coletarTags('talentos-tags'),

        // ── Notas de Sessão ──
        sessaoNum: gV('sessao-num'),
        sessaoData: gV('sessao-data'),
        sessaoTitulo: gV('sessao-titulo'),
        notasEventos: gV('notas-eventos'),
        notasCombate: gV('notas-combate'),
        notasMomentos: gV('notas-momentos'),
        notasNpcs: gV('notas-npcs'),
        notasPistas: gV('notas-pistas'),
        notasObjetivos: gV('notas-objetivos'),
    }

    // Salva localmente (prefixado pelo ID do personagem)
    ls.set('ficha-dnd', JSON.stringify(dados))

    const st = g('save-status')

    if (st) {
        st.textContent = '✦ Salvo localmente ✦'
        setTimeout(() => st.textContent = '', 3000)
    }
}


/* ============================================================
   14. CARREGAR FICHA (localStorage)
   ── Lê o JSON salvo e preenche todos os campos.
      sV: define o value de um input
      sC: define o checked de um checkbox
============================================================ */

// Aplicar dados na tela (usado tanto pelo carregar() quanto pelo listener em tempo real)
function carregar() {
    const raw = ls.get('ficha-dnd')
    if (!raw) return
    const d = JSON.parse(raw)

    const sV = (id, v) => { const el = g(id); if (el && v != null) el.value = v }
    const sC = (id, v) => { const el = g(id); if (el) el.checked = !!v }

    // Cabeçalho
    if (d.nome) g('nome-personagem').textContent = d.nome
    sV('classe', d.classe); sV('nivel', d.nivel); sV('raca', d.raca)
    sV('antecedente', d.antecedente); sV('alinhamento', d.alinhamento); sV('jogador', d.jogador)

    // Combate
    sV('proficiencia', d.proficiencia); sV('deslocamento', d.deslocamento)
    sV('deslocamento-voo', d.deslocamentoVoo)
    sV('deslocamento-nado', d.deslocamentoNado)
    sV('deslocamento-escala', d.deslocamentoEscala)
    sV('visao', d.visao); sV('exaustao', d.exaustao); sV('ca-temp', d.caTemp)
    if (d.visaoEscuro) { const cb = g('visao-escuro'); if (cb) { cb.checked = true; toggleVisaoEscuro() } }

    // Armadura
    sV('arm-nome', d.armNome); sV('arm-ca', d.armCA)
    sV('arm-des-limite', d.armDesLimite); sV('arm-attr-extra', d.armAttrExtra)
    sC('escudo', d.escudo); sV('arm-bonus', d.armBonus); sC('arm-desv', d.armDesv)

    // PV
    sV('pv-max', d.pvMax); sV('pv-atual', d.pvAtual); sV('pv-temp', d.pvTemp)
    sV('dado-vida', d.dadoVida); sV('dado-vida-2', d.dadoVida2)

    // Magias
    sV('conj-hab', d.conjHab); sV('conj-cd', d.conjCD); sV('conj-atk', d.conjAtk)
    // Pontos de magia
    if (d.spMode !== undefined) restaurarModeSP(d.spMode, d.spTipo, d.spAtual)

    // Inventário
    sV('equipamento', d.equipamento); sV('itens-magicos', d.itensMagicos); sV('consumiveis', d.consumiveis)
    sV('pc', d.pc); sV('pp', d.pp); sV('pe', d.pe); sV('po', d.po); sV('pl', d.pl)

    // Habilidades
    sV('outras-prof', d.outrasPorf); sV('traco-antecedente', d.tracoAntecedente)
    sC('prof-leve', d.profLeve); sC('prof-media', d.profMedia)
    sC('prof-pesada', d.profPesada); sC('prof-escudo', d.profEscudo)
    sC('prof-simples', d.profSimples); sC('prof-marciais', d.profMarciais)

    // Descrição
    sV('idade', d.idade); sV('altura', d.altura); sV('peso', d.peso)
    sV('olhos', d.olhos); sV('pele', d.pele); sV('cabelo', d.cabelo); sV('divindade', d.divindade)
    sV('aparencia', d.aparencia); sV('personalidade', d.personalidade)
    sV('ideais', d.ideais); sV('vinculos', d.vinculos); sV('falhas', d.falhas); sV('historia', d.historia)

    // Atributos
    if (d.atributos) Object.keys(d.atributos).forEach(id => sV(id, d.atributos[id]))

    // Saves
    if (d.saves) ATTRS.forEach(id => { if (d.saves[id]) g('save-dot-' + id)?.classList.add('on') })

    // Perícias
    if (d.pericias) Object.keys(d.pericias).forEach(id => {
        const el = g(id); if (el) el.checked = d.pericias[id]
    })

    // Slots de magia
    if (d.spellSlots) for (let i = 1; i <= 9; i++) sV('slot-' + i, d.spellSlots[i])

    // Listas dinâmicas
    if (d.ataques) d.ataques.forEach(a => addAtaqueRow(a.nome, a.atk, a.dano, a.tipo, a.notas))
    if (d.municoes) d.municoes.forEach(m => addMunicaoRow(m.tipo, m.qtd))
    if (d.habilidades) d.habilidades.forEach(h => addHabilidade(h))
    if (d.truques) d.truques.forEach(t => addSpellCard('truques-lista', false, t))
    if (d.magias) d.magias.forEach(m => addSpellCard('spells-lista', true, m))
    if (d.resistencias) d.resistencias.forEach(r => { g('res-input').value = r; addResVul('res') })
    if (d.vulnerabilidades) d.vulnerabilidades.forEach(v => { g('vul-input').value = v; addResVul('vul') })
    if (d.imunidades) d.imunidades.forEach(i => { g('imn-input').value = i; addResVul('imn') })
    if (d.linguas) d.linguas.forEach(l => addTag('lingua', l))
    if (d.talentos) d.talentos.forEach(t => addTag('talento', t))

    // Iniciativa manual (não recalcula se o jogador digitou)
    if (d.iniciativa) { sV('iniciativa', d.iniciativa); g('iniciativa').dataset.manual = 'true' }

    // Notas de Sessão
    sV('sessao-num', d.sessaoNum); sV('sessao-data', d.sessaoData); sV('sessao-titulo', d.sessaoTitulo)
    sV('notas-eventos', d.notasEventos); sV('notas-combate', d.notasCombate); sV('notas-momentos', d.notasMomentos)
    sV('notas-npcs', d.notasNpcs); sV('notas-pistas', d.notasPistas); sV('notas-objetivos', d.notasObjetivos)

    // Título dinâmico da página
    const nomeEl = g('nome-personagem')
    if (nomeEl) document.title = 'Ficha — ' + (nomeEl.textContent.trim() || personagemId)

    // Imagem do personagem (salva separado por ser grande)
    const img = ls.get('ficha-dnd-img')
    if (img) mostrarImagem(img)

}






/* ============================================================
   VISÃO NO ESCURO
============================================================ */
function toggleVisaoEscuro() {
    const cb = g('visao-escuro')
    const icon = g('visao-escuro-icon')
    if (!cb || !icon) return
    icon.style.display = cb.checked ? 'inline' : 'none'
    if (cb.checked && !g('visao').value) g('visao').value = 'Escuro'
}

/* ============================================================
   RESISTÊNCIAS, VULNERABILIDADES E IMUNIDADES
============================================================ */
function addResVul(tipo) {
    const inputId = tipo + '-input'
    const contId = tipo + '-tags'
    const colors = { res: '#1a5020', vul: '#8b1010', imn: '#6a4000' }
    const bgColors = { res: '#d4f0dc', vul: '#f0d4d4', imn: '#f0e8d0' }
    const val = g(inputId)?.value.trim()
    if (!val) return
    const tag = document.createElement('div')
    tag.className = 'resv-tag'
    tag.style.cssText = `border-color:${colors[tipo]};color:${colors[tipo]};background:${bgColors[tipo]};`
    tag.innerHTML = `<span>${val}</span><button onclick="this.parentElement.remove()" style="color:${colors[tipo]};">×</button>`
    g(contId).appendChild(tag)
    g(inputId).value = ''
}

function coletarResVul(tipo) {
    return Array.from(document.querySelectorAll('#' + tipo + '-tags .resv-tag span')).map(s => s.textContent)
}

/* ============================================================
   SISTEMA DE PONTOS DE MAGIA (Variante DMG p. 288)
   ── Custo em pontos por nível de espaço
   ── Pool de pontos por nível de conjurador
   ── Espaços de nível 6-9: apenas 1× por descanso longo
============================================================ */

// Custo em pontos para criar um espaço de cada nível
const SP_COST = { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7, 6: 9, 7: 10, 8: 11, 9: 13 }

// Pool de pontos e nível máximo de espaço por nível de conjurador (1-20)
const SP_BY_LEVEL = [
    null,
    { pts: 4,   max: 1 },  // 1
    { pts: 6,   max: 1 },  // 2
    { pts: 14,  max: 2 },  // 3
    { pts: 17,  max: 2 },  // 4
    { pts: 27,  max: 3 },  // 5
    { pts: 32,  max: 3 },  // 6
    { pts: 38,  max: 4 },  // 7
    { pts: 44,  max: 4 },  // 8
    { pts: 57,  max: 5 },  // 9
    { pts: 64,  max: 5 },  // 10
    { pts: 73,  max: 6 },  // 11
    { pts: 73,  max: 6 },  // 12
    { pts: 83,  max: 7 },  // 13
    { pts: 83,  max: 7 },  // 14
    { pts: 94,  max: 8 },  // 15
    { pts: 94,  max: 8 },  // 16
    { pts: 107, max: 9 },  // 17
    { pts: 114, max: 9 },  // 18
    { pts: 123, max: 9 },  // 19
    { pts: 133, max: 9 },  // 20
]

// Calcula o nível efetivo de conjurador baseado no tipo de classe
function calcNivelConjurador() {
    const nivel = gN('nivel')
    const tipo = gV('sp-tipo')
    if (tipo === 'half')      return Math.floor(nivel / 2)
    if (tipo === 'third')     return Math.floor(nivel / 3)
    if (tipo === 'artificer') return Math.ceil(nivel / 2)
    return nivel // full caster
}

// Retorna os dados (pts, max) para o nível de conjurador atual
function calcSPData() {
    const nc = Math.max(1, Math.min(20, calcNivelConjurador()))
    return SP_BY_LEVEL[nc] || { pts: 0, max: 0 }
}

// Lê os pontos atuais do localStorage (fallback: máximo)
function calcSPAtual() {
    const stored = ls.get('sp-atual')
    if (stored !== null) return parseInt(stored)
    return calcSPData().pts
}

// Muda os pontos manualmente (botões + e −)
function mudarPontosManual(delta) {
    const max = calcSPData().pts
    const novo = Math.max(0, Math.min(max, calcSPAtual() + delta))
    ls.set('sp-atual', novo)
    atualizarSpellPoints()
}

// Gasta pontos para criar um espaço de nível N
function gastarPontosParaEspaco(n) {
    const { pts: maxPts, max: maxLevel } = calcSPData()
    if (n > maxLevel) {
        alert(`Seu nível de conjurador não permite espaços de nível ${n}.`)
        return
    }
    const custo = SP_COST[n]
    const atual = calcSPAtual()
    if (atual < custo) {
        alert(`Pontos insuficientes. Necessário: ${custo}, disponível: ${atual}.`)
        return
    }
    // Restrição de alto nível (6-9): somente 1× por descanso longo
    if (n >= 6) {
        const jaUsado = ls.get('sp-alto-' + n) === 'true'
        if (jaUsado) {
            alert(`Você já criou um espaço de nível ${n} neste dia. Faça um Descanso Longo para recuperá-lo.`)
            return
        }
        ls.set('sp-alto-' + n, 'true')
    }
    ls.set('sp-atual', atual - custo)
    // Incrementa o slot "criado" (usa o mesmo tracker de usados)
    mudarSlotUsadoSP(n, 1)
    atualizarSpellPoints()
}

// Tracker de slots criados pelos pontos (separado dos slots normais)
function mudarSlotUsadoSP(n, delta) {
    const key = 'sp-slot-criado-' + n
    let criado = parseInt(ls.get(key.replace(personagemId + ':', '')) || '0')
    criado = Math.max(0, criado + delta)
    ls.set(key.replace(personagemId + ':', ''), criado)
    renderSPSlotsCriados()
}

// Renderiza os slots criados com pontos (linha de usados/disponíveis)
function renderSPSlotsCriados() {
    const wrap = g('spell-slots-usados-sp')
    if (!wrap) return
    wrap.innerHTML = ''
    const maxLevel = calcSPData().max
    for (let n = 1; n <= maxLevel; n++) {
        const criado = parseInt(ls.get('sp-slot-criado-' + n) || '0')
        const pill = document.createElement('div')
        pill.className = 'slot-usado-pill' + (criado > 0 ? ' sp-slot-ativo' : '')
        pill.innerHTML = `
            <label>NV ${n} · ${SP_COST[n]}pts</label>
            <div class="slot-usado-btns">
                <button onclick="mudarSlotUsadoSP(${n},-1)">−</button>
                <span id="sp-slot-val-${n}">${criado}</span>
                <button onclick="mudarSlotUsadoSP(${n},1)">+</button>
            </div>`
        wrap.appendChild(pill)
    }
}

// Renderiza os botões de "criar espaço"
function renderSPBotoes() {
    const wrap = g('sp-create-buttons')
    if (!wrap) return
    const { pts: maxPts, max: maxLevel } = calcSPData()
    const atual = calcSPAtual()
    wrap.innerHTML = ''
    for (let n = 1; n <= 9; n++) {
        const custo = SP_COST[n]
        const disabled = n > maxLevel || atual < custo
        const altoBloqueado = n >= 6 && ls.get('sp-alto-' + n) === 'true'
        const btn = document.createElement('button')
        btn.className = 'sp-create-btn' + (disabled || altoBloqueado ? ' sp-btn-disabled' : '') + (n >= 6 ? ' sp-btn-alto' : '')
        btn.disabled = disabled || altoBloqueado
        btn.onclick = () => gastarPontosParaEspaco(n)
        btn.innerHTML = `<span class="sp-btn-level">NV ${n}</span><span class="sp-btn-cost">−${custo}pts</span>${altoBloqueado ? '<span class="sp-btn-used">✓usado</span>' : ''}`
        wrap.appendChild(btn)
    }
}

// Renderiza os checkboxes de alto nível (6-9)
function renderSPAlto() {
    const wrap = g('sp-alto-checks')
    if (!wrap) return
    const maxLevel = calcSPData().max
    wrap.innerHTML = ''
    const row = g('sp-alto-row')
    if (maxLevel < 6) { if (row) row.style.display = 'none'; return }
    if (row) row.style.display = ''
    for (let n = 6; n <= maxLevel; n++) {
        const usado = ls.get('sp-alto-' + n) === 'true'
        const item = document.createElement('div')
        item.className = 'sp-alto-item' + (usado ? ' sp-alto-usado' : '')
        item.id = 'sp-alto-item-' + n
        item.innerHTML = `<span class="sp-alto-nv">NV ${n}</span><span class="sp-alto-status">${usado ? '✓ usado' : '○ livre'}</span>`
        wrap.appendChild(item)
    }
}

// Atualização central dos pontos de magia
function atualizarSpellPoints() {
    const { pts: maxPts, max: maxLevel } = calcSPData()
    const nc = Math.max(1, Math.min(20, calcNivelConjurador()))
    const atual = Math.max(0, Math.min(maxPts, calcSPAtual()))

    // Stats
    const elMax    = g('sp-max');      if (elMax)    elMax.textContent    = maxPts
    const elAtual  = g('sp-atual');    if (elAtual)  elAtual.textContent  = atual
    const elNC     = g('sp-nivel-conj'); if (elNC)   elNC.textContent     = nc
    const elMaxLv  = g('sp-max-level'); if (elMaxLv) elMaxLv.textContent  = maxLevel

    // Corrige se o atual armazenado ultrapassou o máximo
    if (ls.get('sp-atual') !== null && parseInt(ls.get('sp-atual')) > maxPts) {
        ls.set('sp-atual', maxPts)
        if (elAtual) elAtual.textContent = maxPts
    }

    // Cor do pool baseada em %
    const pct = maxPts > 0 ? atual / maxPts : 0
    const poolCard = document.querySelector('.sp-pool-card')
    if (poolCard) {
        poolCard.classList.remove('sp-pool-low', 'sp-pool-critical', 'sp-pool-empty')
        if (pct === 0) poolCard.classList.add('sp-pool-empty')
        else if (pct <= 0.25) poolCard.classList.add('sp-pool-critical')
        else if (pct <= 0.5) poolCard.classList.add('sp-pool-low')
    }

    renderSPBotoes()
    renderSPAlto()
    renderSPSlotsCriados()
}

// Descanso Longo: recupera todos os pontos e libera espaços de alto nível
function descansarLongoSP() {
    const max = calcSPData().pts
    ls.set('sp-atual', max)
    for (let n = 6; n <= 9; n++) ls.del('sp-alto-' + n)
    // Zera os slots criados
    for (let n = 1; n <= 9; n++) ls.del('sp-slot-criado-' + n)
    atualizarSpellPoints()
}

// Alterna entre modo de espaços e modo de pontos
function toggleSpellPointsMode() {
    const panel  = g('spell-points-panel')
    const regular = g('spell-slots-regular')
    if (!panel || !regular) return
    const ativando = panel.style.display === 'none'
    panel.style.display   = ativando ? '' : 'none'
    regular.style.display = ativando ? 'none' : ''
    const btn = g('sp-toggle-btn')
    if (btn) {
        btn.classList.toggle('sp-toggle-ativo', ativando)
        btn.textContent = ativando ? '📜 Usar Espaços de Magia' : '🔮 Ativar Pontos de Magia'
    }
    ls.set('sp-mode', ativando ? '1' : '0')
    if (ativando) {
        // Inicializa pontos se ainda não foram definidos
        if (ls.get('sp-atual') === null) {
            ls.set('sp-atual', calcSPData().pts)
        }
        atualizarSpellPoints()
    }
}

// Restaura o modo de pontos ao carregar
function restaurarModeSP(spMode, spTipo, spAtual) {
    if (spTipo) { const el = g('sp-tipo'); if (el) el.value = spTipo }
    if (spAtual != null) ls.set('sp-atual', spAtual)
    if (spMode === '1') {
        const panel   = g('spell-points-panel')
        const regular = g('spell-slots-regular')
        if (panel)   panel.style.display   = ''
        if (regular) regular.style.display = 'none'
        const btn = g('sp-toggle-btn')
        if (btn) { btn.classList.add('sp-toggle-ativo'); btn.textContent = '📜 Usar Espaços de Magia' }
        atualizarSpellPoints()
    }
}

function renderSpellSlotsUsados() {
    const wrap = g('spell-slots-usados')
    if (!wrap) return
    wrap.innerHTML = ''
    for (let n = 1; n <= 9; n++) {
        const pill = document.createElement('div')
        pill.className = 'slot-usado-pill'
        const usado = parseInt(ls.get('slot-usado-' + n) || '0')
        const total = parseInt(g('slot-' + n)?.value) || 0
        pill.innerHTML = `<label>USADOS NV${n}</label><div class="slot-usado-btns"><button onclick="mudarSlotUsado(${n},-1)">−</button><span id="slot-usado-val-${n}">${usado}</span>/<span id="slot-total-val-${n}">${total}</span><button onclick="mudarSlotUsado(${n},1)">+</button></div>`
        wrap.appendChild(pill)
    }
}

function mudarSlotUsado(n, delta) {
    const total = parseInt(g('slot-' + n)?.value) || 0
    let usado = parseInt(ls.get('slot-usado-' + n) || '0')
    usado = Math.max(0, Math.min(total, usado + delta))
    ls.set('slot-usado-' + n, usado)
    const valEl = g('slot-usado-val-' + n)
    if (valEl) {
        valEl.textContent = usado
        valEl.parentElement.parentElement.className = 'slot-usado-pill' + (usado >= total && total > 0 ? ' slot-esgotado' : '')
    }
    const totEl = g('slot-total-val-' + n)
    if (totEl) totEl.textContent = total
}


/* ============================================================
   EXPORTAR / IMPORTAR FICHA
============================================================ */
function exportarFicha() {
    salvar()
    setTimeout(() => {
        const dados = ls.get('ficha-dnd')
        if (!dados) { alert('Salve a ficha antes de exportar.'); return }
        const nome = (g('nome-personagem')?.textContent || 'Personagem').trim().replace(/\s+/g, '_')
        const blob = new Blob([dados], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'ficha_' + nome + '.json'
        document.body.appendChild(a); a.click()
        document.body.removeChild(a); URL.revokeObjectURL(url)
        const st = g('save-status')
        if (st) { st.textContent = '✦ Ficha exportada ✦'; setTimeout(() => st.textContent = '', 2500) }
    }, 600)
}

function importarFicha(event) {
    const file = event.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
        try {
            const dados = JSON.parse(e.target.result)
            if (!confirm('Importar ficha de "' + (dados.nome || 'Personagem') + '"?\n\nIsso vai substituir os dados atuais.')) {
                event.target.value = ''; return
            }
            ls.set('ficha-dnd', JSON.stringify(dados))
            const st = g('save-status')
            if (st) st.textContent = '✦ Importando...'
            setTimeout(() => window.location.reload(), 400)
        } catch (err) {
            alert('Arquivo inválido: ' + err.message)
            event.target.value = ''
        }
    }
    reader.readAsText(file)
}

/* ============================================================
   15. INICIALIZAÇÃO
   ── Executado automaticamente quando a página carrega.
      Ordem importante:
      1. renderSaves/renderPericias: cria o HTML das listas
      2. renderSpellSlots: cria as pílulas de slot
      3. carregar: preenche com dados salvos
      4. atualizarTudo: recalcula todos os bônus
      5. Linhas padrão: garante que as tabelas não ficam vazias
============================================================ */

window.onload = function () {
    // 1. Renderiza as listas geradas dinamicamente
    renderSaves()
    renderPericias()
    renderSpellSlots()

    // 2. Carrega dados do Firebase (ou localStorage)
    carregar()

    // 3. Recalcula todos os valores
    atualizarTudo()

    // 4. Adiciona linhas padrão se as tabelas estiverem vazias
    if (!document.querySelector('#attacks-body tr')) {
        addAtaqueRow(); addAtaqueRow(); addAtaqueRow()
    }
    if (!document.querySelector('#mun-body tr')) {
        addMunicaoRow()
    }
    if (!document.querySelector('#habilidades-lista .exp-card')) {
        addHabilidade()
    }
    renderSpellSlotsUsados()
    // Inicializa pontos de magia se o modo estiver ativo
    if (ls.get('sp-mode') === '1') atualizarSpellPoints()

    if (!document.querySelector('#truques-lista .exp-card')) {
        addSpellCard('truques-lista', false)
    }
    if (!document.querySelector('#spells-lista .exp-card')) {
        addSpellCard('spells-lista', true)
    }

    // Inicializa o sistema de temas
    inicializarTemas()
}

/* ============================================================
   SISTEMA DE TEMAS — Editor Visual
   ── Presets como ponto de partida.
   ── Color pickers por seção para personalização completa.
   ── Tema salvo por personagem no localStorage.
   ── Export/import via JSON para compartilhar entre jogadores.
============================================================ */

// ── Definição das variáveis editáveis por grupo ──
const CP_GROUPS = {
    header: [
        { var: '--header-top',     label: 'Cabeçalho superior', hint: 'topo do gradiente do header'        },
        { var: '--header-mid',     label: 'Cabeçalho meio',     hint: 'centro do gradiente do header'      },
        { var: '--header-bot',     label: 'Cabeçalho inferior', hint: 'base do gradiente do header'        },
        { var: '--tabs-top',       label: 'Abas (topo)',        hint: 'topo da barra de navegação'         },
        { var: '--tabs-bot',       label: 'Abas (base)',        hint: 'base da barra de navegação'         },
        { var: '--bar-bg',         label: 'Barra inferior',     hint: 'fundo da barra de salvar'           },
    ],
    fundo: [
        { var: '--page',           label: 'Fundo da página',    hint: 'cor de trás de tudo'                },
        { var: '--parch',          label: 'Cards e painéis',    hint: 'fundo dos blocos de conteúdo'       },
        { var: '--parch-mid',      label: 'Inputs e campos',    hint: 'campos de texto e linhas'           },
        { var: '--parch-deep',     label: 'Sombra dos cards',   hint: 'hover e seleções'                   },
        { var: '--parch-border',   label: 'Bordas',             hint: 'contornos e separadores'            },
    ],
    acento: [
        { var: '--gold',           label: 'Destaque principal', hint: 'títulos, barras e ícones'           },
        { var: '--gold-light',     label: 'Destaque médio',     hint: 'hover e estados ativos'             },
        { var: '--gold-pale',      label: 'Destaque claro',     hint: 'valores e modificadores'            },
    ],
    texto: [
        { var: '--ink',            label: 'Texto principal',    hint: 'texto, rótulos importantes'         },
        { var: '--ink-mid',        label: 'Texto médio',        hint: 'nomes de campos e labels'           },
        { var: '--ink-muted',      label: 'Texto suave',        hint: 'dicas, detalhes, placeholders'      },
    ],
}

// ── Paletas de preset completas ──
const TEMAS = {
    'Pergaminho': {
        swatch: '#e8b830',
        vars: { '--page':'#e8d8b0','--parch':'#fefaf0','--parch-mid':'#f5e8c8','--parch-deep':'#e8cc80',
                '--parch-border':'#c8901a','--gold':'#a86400','--gold-light':'#c87e10','--gold-pale':'#e8b830',
                '--ink':'#1a0c00','--ink-mid':'#2e1400','--ink-light':'#5c3010','--ink-muted':'#9a6828' ,'--header-top':'#f5e8c0','--header-mid':'#eedda0','--header-bot':'#e8d090','--tabs-top':'#2e1608','--tabs-bot':'#1e0e04','--bar-bg':'rgba(30,14,4,0.97)'}
    },
    'Floresta': {
        swatch: '#4a8a1a',
        vars: { '--page':'#d0e8b8','--parch':'#f0f8ea','--parch-mid':'#d4ecc0','--parch-deep':'#a8d880',
                '--parch-border':'#4a8a1a','--gold':'#2e7010','--gold-light':'#4a9820','--gold-pale':'#6ab830',
                '--ink':'#081802','--ink-mid':'#103008','--ink-light':'#1e5010','--ink-muted':'#3a7020' ,'--header-top':'#d8f0c0','--header-mid':'#c0e8a0','--header-bot':'#a8d880','--tabs-top':'#0a2006','--tabs-bot':'#061404','--bar-bg':'rgba(8,24,4,0.97)'}
    },
    'Arcano': {
        swatch: '#7030c8',
        vars: { '--page':'#d8ccf0','--parch':'#f5f0ff','--parch-mid':'#e0d0f8','--parch-deep':'#c0a0e8',
                '--parch-border':'#7030c8','--gold':'#5820a0','--gold-light':'#7040c0','--gold-pale':'#9060d8',
                '--ink':'#0a0020','--ink-mid':'#180840','--ink-light':'#301870','--ink-muted':'#6040a0' ,'--header-top':'#e8d8ff','--header-mid':'#d4b8f8','--header-bot':'#b890e8','--tabs-top':'#1a0840','--tabs-bot':'#0e0428','--bar-bg':'rgba(10,0,28,0.97)'}
    },
    'Inferno': {
        swatch: '#c83010',
        vars: { '--page':'#f0d8c8','--parch':'#fff5f0','--parch-mid':'#f8ddd0','--parch-deep':'#e8b0a0',
                '--parch-border':'#c83010','--gold':'#a02010','--gold-light':'#c84020','--gold-pale':'#e06030',
                '--ink':'#200800','--ink-mid':'#3a1008','--ink-light':'#602010','--ink-muted':'#903020' ,'--header-top':'#ffd8c0','--header-mid':'#f8b898','--header-bot':'#e89070','--tabs-top':'#3a0808','--tabs-bot':'#220404','--bar-bg':'rgba(24,4,4,0.97)'}
    },
    'Glacial': {
        swatch: '#1878c8',
        vars: { '--page':'#c8ddf0','--parch':'#f0f6ff','--parch-mid':'#cce0f8','--parch-deep':'#98c4f0',
                '--parch-border':'#1878c8','--gold':'#0858a8','--gold-light':'#1878c8','--gold-pale':'#38a0e8',
                '--ink':'#001028','--ink-mid':'#002040','--ink-light':'#004080','--ink-muted':'#2060a0' ,'--header-top':'#d0eeff','--header-mid':'#b0d8f8','--header-bot':'#88c0f0','--tabs-top':'#041828','--tabs-bot':'#020e18','--bar-bg':'rgba(2,10,20,0.97)'}
    },
    'Trevas': {
        swatch: '#700820',
        vars: { '--page':'#140810','--parch':'#1e1018','--parch-mid':'#2a1820','--parch-deep':'#3a2030',
                '--parch-border':'#700820','--gold':'#c01830','--gold-light':'#e03050','--gold-pale':'#ff5070',
                '--ink':'#f0d8e0','--ink-mid':'#d8c0c8','--ink-light':'#c0a0a8','--ink-muted':'#907080' ,'--header-top':'#2e1020','--header-mid':'#200a18','--header-bot':'#140610','--tabs-top':'#0a0008','--tabs-bot':'#040004','--bar-bg':'rgba(6,0,4,0.97)'}
    },
    'Oceano': {
        swatch: '#0878a0',
        vars: { '--page':'#c0e0f0','--parch':'#f0faff','--parch-mid':'#c8eaf8','--parch-deep':'#90d0f0',
                '--parch-border':'#0878a0','--gold':'#055878','--gold-light':'#0878a0','--gold-pale':'#20a8d0',
                '--ink':'#001828','--ink-mid':'#003050','--ink-light':'#006090','--ink-muted':'#1880a8' ,'--header-top':'#c0eeff','--header-mid':'#98d8f8','--header-bot':'#70c0f0','--tabs-top':'#021828','--tabs-bot':'#010e18','--bar-bg':'rgba(0,10,18,0.97)'}
    },
    'Outono': {
        swatch: '#b86010',
        vars: { '--page':'#f0dcc0','--parch':'#fff8f0','--parch-mid':'#f8e8d0','--parch-deep':'#e8c898',
                '--parch-border':'#b86010','--gold':'#986010','--gold-light':'#c07820','--gold-pale':'#d89030',
                '--ink':'#1a0c00','--ink-mid':'#2e1800','--ink-light':'#502800','--ink-muted':'#804010' ,'--header-top':'#ffe8c8','--header-mid':'#f8d4a0','--header-bot':'#e8b878','--tabs-top':'#2e1004','--tabs-bot':'#1e0802','--bar-bg':'rgba(20,8,2,0.97)'}
    },
}

// ── Lê o valor atual de uma variável CSS como hex ──
function lerVarCSS(cssVar) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw
    // rgb(r,g,b)
    const mRgb = raw.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/)
    if (mRgb) return '#' + [mRgb[1],mRgb[2],mRgb[3]].map(n=>parseInt(n).toString(16).padStart(2,'0')).join('')
    // rgba(r,g,b,a) — extrai só o rgb
    const mRgba = raw.match(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+)/)
    if (mRgba) return '#' + [mRgba[1],mRgba[2],mRgba[3]].map(n=>parseInt(n).toString(16).padStart(2,'0')).join('')
    return '#888888'
}

// ── Aplica um conjunto de vars no :root ──
function aplicarVars(vars) {
    const root = document.documentElement
    Object.entries(vars).forEach(([prop, val]) => root.style.setProperty(prop, val))
}

// ── Aplica um preset inteiro ──
function aplicarTema(nome) {
    const tema = TEMAS[nome]
    if (!tema) return
    aplicarVars(tema.vars)
    ls.set('tema-preset', nome)
    ls.del('tema-custom')
    sincronizarPickers()
    marcarPresetAtivo(nome)
    mostrarFeedback('Tema "' + nome + '" aplicado!')
}

function marcarPresetAtivo(nome) {
    document.querySelectorAll('.cp-preset').forEach(b => b.classList.toggle('ativo', b.dataset.preset === nome))
}

// ── Aplica uma cor individual via picker ──
function onColorChange(input) {
    const cssVar = input.dataset.var
    let val = input.value
    // --bar-bg usa rgba para manter o efeito de blur; converte hex → rgba(r,g,b,0.97)
    if (cssVar === '--bar-bg') {
        const r = parseInt(val.slice(1,3),16)
        const g = parseInt(val.slice(3,5),16)
        const b = parseInt(val.slice(5,7),16)
        val = `rgba(${r},${g},${b},0.97)`
    }
    document.documentElement.style.setProperty(cssVar, val)
    salvarCustom()
    marcarPresetAtivo(null)
}

// ── Coleta todos os valores atuais editáveis ──
function coletarVarsAtuais() {
    const allFields = [...CP_GROUPS.header, ...CP_GROUPS.fundo, ...CP_GROUPS.acento, ...CP_GROUPS.texto]
    const vars = {}
    allFields.forEach(f => { vars[f.var] = lerVarCSS(f.var) })
    return vars
}

// ── Salva o estado custom no localStorage ──
function salvarCustom() {
    ls.set('tema-custom', JSON.stringify(coletarVarsAtuais()))
    ls.del('tema-preset') // custom sobrescreve preset
}

// ── Sincroniza os pickers com os valores CSS atuais ──
function sincronizarPickers() {
    document.querySelectorAll('.cp-color-input').forEach(input => {
        const val = lerVarCSS(input.dataset.var)
        if (/^#[0-9a-fA-F]{6}$/.test(val)) input.value = val
    })
}

// ── Exporta o tema atual como JSON para clipboard ──
function exportarTema() {
    const vars = coletarVarsAtuais()
    const json = JSON.stringify(vars, null, 2)
    navigator.clipboard.writeText(json).then(() => {
        mostrarFeedback('✓ Tema copiado! Cole no seu parceiro de aventura.')
    }).catch(() => {
        // fallback: mostrar no textarea
        document.getElementById('cp-import-ta').value = json
        document.getElementById('cp-import-wrap').classList.add('open')
        mostrarFeedback('Copie o texto que apareceu abaixo.')
    })
}

// ── Importa um tema colado no textarea ──
function importarTema() {
    const raw = document.getElementById('cp-import-ta').value.trim()
    try {
        const vars = JSON.parse(raw)
        if (typeof vars !== 'object') throw new Error('Formato inválido')
        aplicarVars(vars)
        salvarCustom()
        sincronizarPickers()
        marcarPresetAtivo(null)
        document.getElementById('cp-import-ta').value = ''
        document.getElementById('cp-import-wrap').classList.remove('open')
        mostrarFeedback('✓ Tema importado com sucesso!')
    } catch(e) {
        mostrarFeedback('❌ JSON inválido. Copie o tema completo.')
    }
}

function toggleImportArea() {
    document.getElementById('cp-import-wrap').classList.toggle('open')
}

// ── Reseta para o tema Pergaminho (padrão) ──
function resetarTema() {
    aplicarTema('Pergaminho')
    ls.del('tema-custom')
    mostrarFeedback('Tema resetado para Pergaminho.')
}

// ── Feedback temporário ──
function mostrarFeedback(msg) {
    const el = document.getElementById('cp-feedback')
    if (!el) return
    el.textContent = msg
    el.classList.add('show')
    clearTimeout(el._t)
    el._t = setTimeout(() => el.classList.remove('show'), 3000)
}

// ── Abre/fecha o painel ──
function toggleTemaPanel() {
    const panel = document.getElementById('tema-panel')
    panel.classList.toggle('open')
    if (panel.classList.contains('open')) sincronizarPickers()
}

// ── Constrói o HTML de um grupo de color pickers ──
function renderCPGroup(groupId, fields) {
    const el = document.getElementById('cp-group-' + groupId)
    if (!el) return
    el.innerHTML = fields.map(f => `
        <div class="cp-row">
            <div class="cp-row-info">
                <div class="cp-row-label">${f.label}</div>
                <div class="cp-row-hint">${f.hint}</div>
            </div>
            <div class="cp-color-wrap" title="Clique para mudar">
                <input type="color" class="cp-color-input"
                    data-var="${f.var}" value="#888888"
                    oninput="onColorChange(this)">
            </div>
        </div>`).join('')
}

// ── Constrói os presets rápidos ──
function renderPresets() {
    const el = document.getElementById('cp-presets')
    if (!el) return
    el.innerHTML = Object.entries(TEMAS).map(([nome, d]) => `
        <button class="cp-preset" data-preset="${nome}" onclick="aplicarTema('${nome}')">
            <span class="cp-preset-dot" style="background:${d.swatch}"></span>
            ${nome}
        </button>`).join('')
}

// ── Inicializa todo o editor de tema ──
function inicializarTemas() {
    renderPresets()
    renderCPGroup('header', CP_GROUPS.header)
    renderCPGroup('fundo',  CP_GROUPS.fundo)
    renderCPGroup('acento', CP_GROUPS.acento)
    renderCPGroup('texto',  CP_GROUPS.texto)

    // Restaura: primeiro tenta custom, depois preset
    const custom = ls.get('tema-custom')
    const preset = ls.get('tema-preset')
    if (custom) {
        try {
            aplicarVars(JSON.parse(custom))
            sincronizarPickers()
        } catch(e) { aplicarTema('Pergaminho') }
    } else if (preset && TEMAS[preset]) {
        aplicarTema(preset)
    } else {
        sincronizarPickers() // usa valores padrão do CSS
    }

    // Fecha painel clicando fora
    document.addEventListener('click', e => {
        const panel = document.getElementById('tema-panel')
        const btn = document.getElementById('btn-tema')
        if (panel && btn && panel.classList.contains('open')
            && !panel.contains(e.target) && !btn.contains(e.target)) {
            panel.classList.remove('open')
        }
    })
}