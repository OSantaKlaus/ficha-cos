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
    { nome: 'Acrobacia', attr: 'des', desc: 'Manter o equilíbrio, cair bem, fazer acrobacias e escapar de agarrões.' },
    { nome: 'Arcanismo', attr: 'int', desc: 'Conhecimento sobre magia, itens mágicos, planos e criaturas arcanas.' },
    { nome: 'Atletismo', attr: 'for', desc: 'Escalar, saltar, nadar e vencer disputas físicas de força.' },
    { nome: 'Atuação', attr: 'car', desc: 'Entreter uma plateia com música, dança, atuação ou contação de histórias.' },
    { nome: 'Enganação', attr: 'car', desc: 'Mentir de forma convincente, blefar ou disfarçar intenções.' },
    { nome: 'Furtividade', attr: 'des', desc: 'Esconder-se, mover-se em silêncio e passar despercebido.' },
    { nome: 'História', attr: 'int', desc: 'Lembrar eventos históricos, lendas, reinos e civilizações antigas.' },
    { nome: 'Intimidação', attr: 'car', desc: 'Influenciar alguém através de ameaças, hostilidade ou violência.' },
    { nome: 'Intuição', attr: 'sab', desc: 'Perceber mentiras, ler intenções e prever o próximo passo de alguém.' },
    { nome: 'Investigação', attr: 'int', desc: 'Analisar pistas, deduzir conclusões e encontrar detalhes escondidos.' },
    { nome: 'Lidar c/ Animais', attr: 'sab', desc: 'Acalmar, treinar ou entender o comportamento de um animal.' },
    { nome: 'Medicina', attr: 'sab', desc: 'Estabilizar um moribundo, diagnosticar doenças e identificar causa de morte.' },
    { nome: 'Natureza', attr: 'int', desc: 'Conhecimento sobre terrenos, plantas, animais e ciclos naturais.' },
    { nome: 'Percepção', attr: 'sab', desc: 'Notar detalhes, ouvir sons distantes ou detectar algo escondido.' },
    { nome: 'Persuasão', attr: 'car', desc: 'Convencer alguém através de tato, boas maneiras ou apelos sinceros.' },
    { nome: 'Prestidigitação', attr: 'des', desc: 'Truques manuais, punga, plantar objetos e outras manobras sutis.' },
    { nome: 'Religião', attr: 'int', desc: 'Conhecimento sobre deuses, ritos, símbolos sagrados e organizações religiosas.' },
    { nome: 'Sobrevivência', attr: 'sab', desc: 'Rastrear, caçar, prever o clima e evitar perigos naturais.' },
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
    // Sincroniza total de dados de vida com o nível do personagem
    const dtEl = g('dado-vida-total')
    if (dtEl && dtEl.dataset.manual !== 'true') {
        dtEl.value = nivel
        sincronizarDadosVida()
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

// Garante que total de dados de vida nunca fique abaixo de restantes
function sincronizarDadosVida() {
    const total = parseInt(g('dado-vida-total')?.value) || 1
    const restEl = g('dado-vida-rest')
    if (restEl) {
        restEl.max = total
        if ((parseInt(restEl.value) || 1) > total) restEl.value = total
    }
}

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
    try { atualizarQuickStats() } catch(e) {}
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

    // Quando há PV temporário, a escala da barra passa a ser max+temp,
    // senão o PV normal cheio (100%) nunca sobra espaço pro temporário aparecer.
    const escala = pvTemp > 0 ? (max + pvTemp) : max
    const pct = Math.max(0, Math.min(100, (cur / escala) * 100))

    const bar = g('pv-bar')
    if (bar) {
        bar.style.width = pct + '%'
        bar.classList.remove('pv-high', 'pv-medium', 'pv-critical', 'pv-dead')
        if (cur <= 0) bar.classList.add('pv-dead')
        else if ((cur / max) * 100 <= 25) bar.classList.add('pv-critical')
        else if ((cur / max) * 100 <= 60) bar.classList.add('pv-medium')
        else bar.classList.add('pv-high')
    }

    const tempBar = g('pv-bar-temp')
    if (tempBar) {
        if (pvTemp > 0) {
            const pctTempOnly = Math.max(0, Math.min(100 - pct, (pvTemp / escala) * 100))
            tempBar.style.width = pctTempOnly + '%'
        } else {
            tempBar.style.width = '0%'
        }
    }

    const lbl = g('pv-bar-label')
    if (lbl) lbl.textContent = cur + ' / ' + max

    const lblTemp = g('pv-bar-temp-label')
    if (lblTemp) lblTemp.textContent = pvTemp > 0 ? '+' + pvTemp : ''

    const heart = g('pv-heart')
    if (heart) heart.style.display = (cur > 0 && (cur / max) * 100 <= 25) ? 'inline' : 'none'
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
        return `<div class="save-row" onclick="rolarSave('${id}')" title="Clique para rolar teste de ${ATTR_NOMES[id]}">
      <div class="save-dot ${on ? 'on' : ''}" id="save-dot-${id}" onclick="event.stopPropagation();toggleSave('${id}')"></div>
      <span>${ATTR_NOMES[id]}</span>
      <span class="save-bonus" id="save-bonus-${id}">+0</span>
      <span class="roll-hint">🎲</span>
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
        return `<div class="skill-item">
      <div class="skill-row" onclick="rolarPericia('${p.nome}','${sid}')" title="Clique para rolar ${p.nome}">
        <input type="checkbox" class="skill-check" id="${sid}" ${sp[sid] ? 'checked' : ''} onchange="atualizarTudo()" onclick="event.stopPropagation()">
        <span class="skill-name">${p.nome}</span>
        <button type="button" class="skill-desc-toggle" onclick="toggleSkillDesc('${sid}', event)" title="Mostrar descrição" aria-label="Mostrar descrição de ${p.nome}">▸</button>
        <span class="skill-attr ${attrCls}">${p.attr.toUpperCase()}</span>
        <span class="skill-val" id="${sid}-bonus">+0</span>
        <span class="roll-hint">🎲</span>
      </div>
      <div class="skill-desc" id="${sid}-desc">${p.desc}</div>
    </div>`
    }).join('')
}

function toggleSkillDesc(sid, event) {
    event.stopPropagation()
    const desc = g(sid + '-desc')
    const btn = event.currentTarget
    if (!desc) return
    const abrindo = !desc.classList.contains('open')
    desc.classList.toggle('open', abrindo)
    btn.classList.toggle('open', abrindo)
    btn.setAttribute('title', abrindo ? 'Ocultar descrição' : 'Mostrar descrição')
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
    <td style="width:22%"><input type="text" value="${nome}" placeholder="Espada Longa"></td>
    <td style="width:13%"><input type="text" value="${atk}" placeholder="+5" style="text-align:center;"></td>
    <td style="width:20%"><input type="text" value="${dano}" placeholder="1d8+3"></td>
    <td style="width:16%"><input type="text" value="${tipo}" placeholder="Cortante"></td>
    <td style="width:8%;text-align:center;">
        <button class="btn-rolar-ataque" onclick="rolarAtaque(this)" title="Rolar ataque e dano">⚔</button>
    </td>
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
        const img = new Image()
        img.onload = () => {
            // Redimensiona para no máximo 640px no lado maior, evitando
            // estourar o limite de armazenamento do navegador (localStorage)
            // com fotos de celular que costumam vir muito grandes.
            const MAX_LADO = 640
            let w = img.width, h = img.height
            if (w > MAX_LADO || h > MAX_LADO) {
                if (w >= h) { h = Math.round(h * (MAX_LADO / w)); w = MAX_LADO }
                else { w = Math.round(w * (MAX_LADO / h)); h = MAX_LADO }
            }
            const canvas = document.createElement('canvas')
            canvas.width = w; canvas.height = h
            canvas.getContext('2d').drawImage(img, 0, 0, w, h)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.82)

            mostrarImagem(dataUrl)
            try {
                ls.set('ficha-dnd-img', dataUrl)
                mostrarToast('✦ Imagem salva', 'sucesso', 2000)
            } catch (err) {
                console.warn('[imagem]', err)
                mostrarToast('Não foi possível salvar a imagem (espaço insuficiente no navegador)', 'erro', 4500)
            }
        }
        img.onerror = () => mostrarToast('Não foi possível ler essa imagem', 'erro', 3500)
        img.src = e.target.result
    }
    reader.onerror = () => mostrarToast('Não foi possível ler o arquivo', 'erro', 3500)
    reader.readAsDataURL(file)
}

function mostrarImagem(src) {
    const wrap = g('char-img-wrap')
    const ph   = g('img-placeholder')
    let img = wrap.querySelector('img')
    if (!img) {
        img = document.createElement('img')
        wrap.appendChild(img)
    }
    img.src = src
    // Classe CSS garante que placeholder some mesmo se JS inline for sobrescrito
    wrap.classList.add('has-image')
    if (ph) ph.style.display = 'none'
}

/* ── Toggle de modo da imagem: retrato / token ── */
function setImgMode(modo) {
    const outer = g('char-img-outer')
    if (!outer) return
    outer.classList.remove('modo-retrato', 'modo-token')
    outer.classList.add('modo-' + modo)

    document.querySelectorAll('.img-mode-btn').forEach(b => b.classList.remove('active'))
    const btn = g('btn-modo-' + modo)
    if (btn) btn.classList.add('active')

    // Se há imagem carregada, garante que o placeholder fica oculto
    const wrap = g('char-img-wrap')
    if (wrap && wrap.querySelector('img')) {
        wrap.classList.add('has-image')
        const ph = g('img-placeholder')
        if (ph) ph.style.display = 'none'
    }

    ls.set('img-modo', modo)
}

function restaurarModoImagem() {
    // Modo retrato removido — sempre usa token
    setImgMode('token')
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
    moverIndicadorTab(btn)
}

function moverIndicadorTab(btn) {
    const indicator = document.getElementById('tab-indicator')
    if (!indicator || !btn) return
    const tabs = document.getElementById('tabs')
    const tabsRect = tabs.getBoundingClientRect()
    const btnRect  = btn.getBoundingClientRect()
    indicator.style.left  = (btnRect.left - tabsRect.left) + 'px'
    indicator.style.width = btnRect.width + 'px'
}

// Inicializa o indicador na aba ativa
window.addEventListener('load', () => {
    setTimeout(() => {
        const activeBtn = document.querySelector('.tab-btn.active')
        if (activeBtn) moverIndicadorTab(activeBtn)
    }, 100)
})

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
        nome: g('nome-personagem').textContent,
        classe: gV('classe'),
        nivel: gV('nivel'),
        raca: gV('raca'),
        antecedente: gV('antecedente'),
        alinhamento: gV('alinhamento'),
        jogador: gV('jogador'),

        proficiencia: gV('proficiencia'),
        iniciativa: gV('iniciativa'),
        deslocamento: gV('deslocamento'),
        deslocamentoVoo: gV('deslocamento-voo'),
        deslocamentoNado: gV('deslocamento-nado'),
        deslocamentoEscala: gV('deslocamento-escala'),
        caTemp: gV('ca-temp'),

        visao: gV('visao'),
        visaoEscuro: g('visao-escuro')?.checked || false,
        exaustao: gV('exaustao'),

        armNome: gV('arm-nome'),
        armCA: gV('arm-ca'),
        armDesLimite: gV('arm-des-limite'),
        armAttrExtra: gV('arm-attr-extra'),
        escudo: g('escudo')?.checked || false,
        armBonus: gV('arm-bonus'),
        armDesv: g('arm-desv')?.checked || false,

        pvMax: gV('pv-max'),
        pvAtual: gV('pv-atual'),
        pvTemp: gV('pv-temp'),
        dadoVida: gV('dado-vida'),
        dadoVidaTotal: gV('dado-vida-total'),
        dadoVidaRest: gV('dado-vida-rest'),
        deathSaves: Array.from(document.querySelectorAll('.death-check')).map(cb => cb.checked),

        conjHab: gV('conj-hab'),
        conjCD: gV('conj-cd'),
        conjAtk: gV('conj-atk'),

        equipamento: gV('equipamento'),
        itensMagicos: gV('itens-magicos'),
        consumiveis: gV('consumiveis'),
        pc: gV('pc'), pp: gV('pp'), pe: gV('pe'), po: gV('po'), pl: gV('pl'),

        outrasPorf: gV('outras-prof'),
        tracoAntecedente: gV('traco-antecedente'),
        profLeve: g('prof-leve')?.checked || false,
        profMedia: g('prof-media')?.checked || false,
        profPesada: g('prof-pesada')?.checked || false,
        profEscudo: g('prof-escudo')?.checked || false,
        profSimples: g('prof-simples')?.checked || false,
        profMarciais: g('prof-marciais')?.checked || false,

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

        atributos: {
            for: gV('for'), des: gV('des'), con: gV('con'),
            int: gV('int'), sab: gV('sab'), car: gV('car')
        },
        saves,
        pericias,
        spellSlots,

        spMode:  ls.get('sp-mode')  || '0',
        spTipo:  gV('sp-tipo'),
        spAtual: ls.get('sp-atual'),

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
    // Proficiência: marca como manual se foi editada (para não sobrescrever pelo nível)
    if (d.proficiencia) { sV('proficiencia', d.proficiencia); const pe = g('proficiencia'); if(pe) pe.dataset.manual = 'true' }
    sV('deslocamento', d.deslocamento)
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
    sV('dado-vida', d.dadoVida)
    if (d.dadoVidaTotal ?? d.dadoVida2) {
        sV('dado-vida-total', d.dadoVidaTotal ?? d.dadoVida2)
        const dte = g('dado-vida-total'); if (dte) dte.dataset.manual = 'true'
    }
    sV('dado-vida-rest', d.dadoVidaRest ?? d.dadoVida2)
    // Testes contra a morte
    if (Array.isArray(d.deathSaves)) {
        const dcs = document.querySelectorAll('.death-check')
        d.deathSaves.forEach((v, i) => { if (dcs[i]) dcs[i].checked = !!v })
    }

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
    try { renderSaves() }     catch(e) { console.warn('renderSaves:', e) }
    try { renderPericias() }  catch(e) { console.warn('renderPericias:', e) }
    try { renderSpellSlots() } catch(e) { console.warn('renderSpellSlots:', e) }

    // 2. Carrega dados salvos
    try { carregar() }        catch(e) { console.warn('carregar:', e) }

    // 3. Recalcula tudo
    try { atualizarTudo() }   catch(e) { console.warn('atualizarTudo:', e) }

    // 4. Garante conteúdo padrão mesmo que carregar não tenha preenchido
    try {
        if (!document.querySelector('#attacks-body tr')) {
            addAtaqueRow(); addAtaqueRow(); addAtaqueRow()
        }
    } catch(e) {}
    try {
        if (!document.querySelector('#mun-body tr')) { addMunicaoRow() }
    } catch(e) {}
    try {
        if (!document.querySelector('#habilidades-lista .exp-card')) { addHabilidade() }
    } catch(e) { console.warn('addHabilidade:', e) }

    try { renderSpellSlotsUsados() } catch(e) {}
    try { if (ls.get('sp-mode') === '1') atualizarSpellPoints() } catch(e) {}

    try {
        if (!document.querySelector('#truques-lista .exp-card')) {
            addSpellCard('truques-lista', false)
        }
    } catch(e) {}
    try {
        if (!document.querySelector('#spells-lista .exp-card')) {
            addSpellCard('spells-lista', true)
        }
    } catch(e) { console.warn('addSpellCard:', e) }

    // 5. Inicializações visuais
    try { inicializarTemas() }   catch(e) { console.warn('temas:', e) }
    try { inicializarDados() }   catch(e) { console.warn('dados:', e) }
    try { restaurarModoImagem() } catch(e) {}

    // 6. Re-inicializa seções colapsáveis após saves/perícias renderizados
    try { if (typeof setupColapsaveis === 'function') setupColapsaveis() } catch(e) { console.warn('collapse:', e) }
}

/* ============================================================
   SISTEMA DE TEMAS — Editor Visual
   ── Presets como ponto de partida.
   ── Color pickers por seção para personalização completa.
   ── Tema salvo por personagem no localStorage.
   ── Export/import via JSON para compartilhar entre jogadores.
============================================================ */

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

/* Ícones por tema — SVG inline (herdam a cor via stroke=currentColor).
   Compartilhados por família onde faz sentido, mas cada classe tem
   assinatura própria. Usados em #header-ornament-left/right. */
const ICONES = {
    'Umbra':       '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/></svg>',
    'Strahd':      '<svg viewBox="0 0 24 24"><path d="M12 6c-2 0-3 2-3 2s-3-3-7-2c2 1 3 3 3 3s-2 0-3 2c2 0 3 1 3 1s-1 2-1 3c2-1 4-3 4-3s1 4 4 6c3-2 4-6 4-6s2 2 4 3c0-1-1-3-1-3s1-1 3-1c-1-2-3-2-3-2s1-2 3-3c-4-1-7 2-7 2s-1-2-3-2z"/></svg>',
    'Bárbaro':     '<svg viewBox="0 0 24 24"><path d="M12 3 L12 21 M12 5 C8 4 5 6 5 10 C8 11 11 8 12 6 M12 6 C15 5 18 6.5 18 9 C15 10.5 13 8.5 12 7"/></svg>',
    'Guerreiro':   '<svg viewBox="0 0 24 24"><path d="M12 2 L12 16 M8 15 L16 15 M12 16 L12 20"/><circle cx="12" cy="21" r="1.3"/></svg>',
    'Paladino':    '<svg viewBox="0 0 24 24"><path d="M12 3 L19 6 V11 C19 16 16 19.5 12 21 C8 19.5 5 16 5 11 V6 Z M12 8 L12 15 M9 11.5 L15 11.5"/></svg>',
    'Patrulheiro': '<svg viewBox="0 0 24 24"><path d="M6 3 C6 3 5 12 6 21 M6 3 C10 5 10 19 6 21 M6 12 L20 12 M17 9 L20 12 L17 15"/></svg>',
    'Mago':        '<svg viewBox="0 0 24 24"><path d="M12 2 L14 9 L21 9 L15.5 13.5 L17.5 21 L12 16.5 L6.5 21 L8.5 13.5 L3 9 L10 9 Z"/></svg>',
    'Feiticeiro':  '<svg viewBox="0 0 24 24"><path d="M12 2 C10 7 7 8 7 13 A5 5 0 0 0 17 13 C17 10 15 9 15 7 C15 9 13.5 10 13.5 12 C13 9 12 7 12 2 Z"/></svg>',
    'Bruxo':       '<svg viewBox="0 0 24 24"><path d="M12 4 L21 19 H3 Z M12 12 A3 3 0 1 0 12 12.01"/></svg>',
    'Artificer':   '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.3"/><path d="M12 2 L12 5 M12 19 L12 22 M2 12 L5 12 M19 12 L22 12 M4.5 4.5 L6.6 6.6 M17.4 17.4 L19.5 19.5 M19.5 4.5 L17.4 6.6 M6.6 17.4 L4.5 19.5"/></svg>',
    'Clérigo':     '<svg viewBox="0 0 24 24"><path d="M12 2 V22 M6 8 H18"/></svg>',
    'Druida':      '<svg viewBox="0 0 24 24"><path d="M12 21 C12 21 4 16 4 9 A8 8 0 0 1 12 3 A8 8 0 0 1 20 9 C20 16 12 21 12 21 Z M12 3 L12 21"/></svg>',
    'Monge':       '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12 A4 4 0 0 1 12 8 M16 12 A4 4 0 0 1 12 16"/></svg>',
    'Ladino':      '<svg viewBox="0 0 24 24"><path d="M12 2 L14 4 L14 15 L12 20 L10 15 L10 4 Z M9 6 L15 6 M8 3 L16 3"/></svg>',
    'Bardo':       '<svg viewBox="0 0 24 24"><circle cx="7" cy="17" r="3"/><path d="M10 17 V5 L19 3 V15" /><circle cx="16" cy="15" r="3"/></svg>',
}

/* Família visual por tema — controla textura de fundo e moldura do
   cabeçalho (ver css/13-identidade-temas.css). Strahd/Umbra ficam
   fora do sistema de família (identidade própria). */
const FAMILIAS = {
    'Bárbaro': 'marcial', 'Guerreiro': 'marcial', 'Paladino': 'marcial', 'Patrulheiro': 'marcial',
    'Mago': 'arcano', 'Feiticeiro': 'arcano', 'Bruxo': 'arcano', 'Artificer': 'arcano',
    'Clérigo': 'divino', 'Druida': 'divino', 'Monge': 'divino',
    'Ladino': 'furtivo', 'Bardo': 'furtivo',
}

const TEMAS = {
    'Umbra': {
        swatch: '#8890c0',
        vars: {
            '--page':         '#050509',
            '--parch':        '#0c0c14',
            '--parch-mid':    '#14141f',
            '--parch-deep':   '#1c1c2a',
            '--parch-border': '#4a4a68',
            '--gold':         '#8890c0',
            '--gold-light':   '#a8b0d8',
            '--gold-pale':    '#c8ceec',
            '--ink':          '#e4e4f2',
            '--ink-mid':      '#b0b0c8',
            '--ink-light':    '#9797ae',
            '--ink-muted':    '#78788e',
            '--header-top':   '#14141e',
            '--header-mid':   '#0a0a10',
            '--header-bot':   '#050508',
            '--tabs-top':     '#08080c',
            '--tabs-bot':     '#050508',
            '--bar-bg':       'rgba(8,8,12,0.97)',
            '--tabs-txt-off':   'rgba(140,140,190,0.42)',
            '--tabs-txt-hover': 'rgba(200,204,236,0.75)',
            '--gold-rgb':     '136,144,192',
        }
    },
    'Strahd': {
        swatch: '#c82040',
        vars: {
            '--page':         '#06020a',
            '--parch':        '#130918',
            '--parch-mid':    '#1e0c18',
            '--parch-deep':   '#2c1020',
            '--parch-border': '#8a1825',
            '--gold':         '#c8960a',
            '--gold-light':   '#e0b020',
            '--gold-pale':    '#f0d060',
            '--ink':          '#f0e8d8',
            '--ink-mid':      '#d4c0a8',
            '--ink-light':    '#b8a488',
            '--ink-muted':    '#9c8268',
            '--header-top':   '#1e0810',
            '--header-mid':   '#140508',
            '--header-bot':   '#080305',
            '--tabs-top':     '#060102',
            '--tabs-bot':     '#030001',
            '--bar-bg':       'rgba(4,1,3,0.97)',
            '--tabs-txt-off':   'rgba(200,130,80,0.40)',
            '--tabs-txt-hover': 'rgba(240,190,120,0.70)',
            '--gold-rgb':     '200,150,10',
        }
    },
    'Bárbaro': {
        swatch: '#E7623E',
        vars: {
            '--page':       '#080403',
            '--parch':      '#100705',
            '--parch-mid':  '#190c08',
            '--parch-deep': '#22100b',
            '--parch-border':'#b93a17',
            '--gold':       '#E7623E',
            '--gold-light': '#df5d39',
            '--gold-pale':  '#d19180',
            '--ink':        '#eae7e6',
            '--ink-mid':    '#bea49d',
            '--ink-light':  '#a58278',
            '--ink-muted':  '#815f56',
            '--header-top': '#1f0f0a',
            '--header-mid': '#100705',
            '--header-bot': '#080403',
            '--tabs-top':   '#080403',
            '--tabs-bot':   '#040201',
            '--bar-bg':     'rgba(4,2,1,0.97)',
            '--tabs-txt-off':'rgba(231,98,62,0.42)',
            '--tabs-txt-hover':'#c95d40',
            '--gold-rgb':   '231,98,62',
            '--shadow-sm':  '0 2px 8px rgba(231,98,62,0.14)',
            '--shadow-md':  '0 5px 18px rgba(231,98,62,0.22)',
            '--shadow-lg':  '0 16px 56px rgba(0,0,0,0.35), 0 4px 14px rgba(231,98,62,0.20)',
        }
    },
    'Bardo': {
        swatch: '#AB6DAC',
        vars: {
            '--page':       '#070407',
            '--parch':      '#0d080d',
            '--parch-mid':  '#140d14',
            '--parch-deep': '#1c121c',
            '--parch-border':'#7e487f',
            '--gold':       '#AB6DAC',
            '--gold-light': '#a96faa',
            '--gold-pale':  '#b69ab7',
            '--ink':        '#eae6ea',
            '--ink-mid':    '#b8a2b9',
            '--ink-light':  '#9e7f9e',
            '--ink-muted':  '#795c7a',
            '--header-top': '#181019',
            '--header-mid': '#0d080d',
            '--header-bot': '#070407',
            '--tabs-top':   '#070407',
            '--tabs-bot':   '#030203',
            '--bar-bg':     'rgba(3,2,3,0.97)',
            '--tabs-txt-off':'rgba(171,109,172,0.42)',
            '--tabs-txt-hover':'#9c6c9d',
            '--gold-rgb':   '171,109,172',
            '--shadow-sm':  '0 2px 8px rgba(171,109,172,0.14)',
            '--shadow-md':  '0 5px 18px rgba(171,109,172,0.22)',
            '--shadow-lg':  '0 16px 56px rgba(0,0,0,0.35), 0 4px 14px rgba(171,109,172,0.20)',
        }
    },
    'Bruxo': {
        swatch: '#7B469B',
        vars: {
            '--page':       '#060407',
            '--parch':      '#0b070d',
            '--parch-mid':  '#120c15',
            '--parch-deep': '#19101d',
            '--parch-border':'#57326e',
            '--gold':       '#7B469B',
            '--gold-light': '#8f5ab0',
            '--gold-pale':  '#ad95bc',
            '--ink':        '#e9e6ea',
            '--ink-mid':    '#b19ebd',
            '--ink-light':  '#947aa4',
            '--ink-muted':  '#70577f',
            '--header-top': '#160f1a',
            '--header-mid': '#0b070d',
            '--header-bot': '#060407',
            '--tabs-top':   '#060407',
            '--tabs-bot':   '#030203',
            '--bar-bg':     'rgba(3,2,3,0.97)',
            '--tabs-txt-off':'rgba(123,70,155,0.42)',
            '--tabs-txt-hover':'#8d63a6',
            '--gold-rgb':   '123,70,155',
            '--shadow-sm':  '0 2px 8px rgba(123,70,155,0.14)',
            '--shadow-md':  '0 5px 18px rgba(123,70,155,0.22)',
            '--shadow-lg':  '0 16px 56px rgba(0,0,0,0.35), 0 4px 14px rgba(123,70,155,0.20)',
        }
    },
    'Clérigo': {
        swatch: '#91A1B2',
        vars: {
            '--page':       '#050606',
            '--parch':      '#090a0c',
            '--parch-mid':  '#0e1113',
            '--parch-deep': '#14171a',
            '--parch-border':'#5e7287',
            '--gold':       '#91A1B2',
            '--gold-light': '#798c9f',
            '--gold-pale':  '#9fa8b1',
            '--ink':        '#e7e8e9',
            '--ink-mid':    '#a6adb5',
            '--ink-light':  '#858e99',
            '--ink-muted':  '#626b75',
            '--header-top': '#121417',
            '--header-mid': '#090a0c',
            '--header-bot': '#050606',
            '--tabs-top':   '#050606',
            '--tabs-bot':   '#020303',
            '--bar-bg':     'rgba(2,3,3,0.97)',
            '--tabs-txt-off':'rgba(145,161,178,0.42)',
            '--tabs-txt-hover':'#758494',
            '--gold-rgb':   '145,161,178',
            '--shadow-sm':  '0 2px 8px rgba(145,161,178,0.14)',
            '--shadow-md':  '0 5px 18px rgba(145,161,178,0.22)',
            '--shadow-lg':  '0 16px 56px rgba(0,0,0,0.35), 0 4px 14px rgba(145,161,178,0.20)',
        }
    },
    'Druida': {
        swatch: '#7A853B',
        vars: {
            '--page':       '#070704',
            '--parch':      '#0d0d07',
            '--parch-mid':  '#14150c',
            '--parch-deep': '#1c1e10',
            '--parch-border':'#575e2a',
            '--gold':       '#7A853B',
            '--gold-light': '#929e4b',
            '--gold-pale':  '#b6bc94',
            '--ink':        '#e9eae6',
            '--ink-mid':    '#b8bd9e',
            '--ink-light':  '#9ea479',
            '--ink-muted':  '#7a8056',
            '--header-top': '#191a0f',
            '--header-mid': '#0d0d07',
            '--header-bot': '#070704',
            '--tabs-top':   '#070704',
            '--tabs-bot':   '#030302',
            '--bar-bg':     'rgba(3,3,2,0.97)',
            '--tabs-txt-off':'rgba(122,133,59,0.42)',
            '--tabs-txt-hover':'#9ca763',
            '--gold-rgb':   '122,133,59',
            '--shadow-sm':  '0 2px 8px rgba(122,133,59,0.14)',
            '--shadow-md':  '0 5px 18px rgba(122,133,59,0.22)',
            '--shadow-lg':  '0 16px 56px rgba(0,0,0,0.35), 0 4px 14px rgba(122,133,59,0.20)',
        }
    },
    'Feiticeiro': {
        swatch: '#992E2E',
        vars: {
            '--page':       '#080303',
            '--parch':      '#0f0606',
            '--parch-mid':  '#170a0a',
            '--parch-deep': '#200e0e',
            '--parch-border':'#6d2121',
            '--gold':       '#992E2E',
            '--gold-light': '#b43c3c',
            '--gold-pale':  '#c48c8c',
            '--ink':        '#eae6e6',
            '--ink-mid':    '#be9d9d',
            '--ink-light':  '#a57878',
            '--ink-muted':  '#815656',
            '--header-top': '#1d0c0c',
            '--header-mid': '#0f0606',
            '--header-bot': '#080303',
            '--tabs-top':   '#080303',
            '--tabs-bot':   '#040202',
            '--bar-bg':     'rgba(4,2,2,0.97)',
            '--tabs-txt-off':'rgba(153,46,46,0.42)',
            '--tabs-txt-hover':'#b45555',
            '--gold-rgb':   '153,46,46',
            '--shadow-sm':  '0 2px 8px rgba(153,46,46,0.14)',
            '--shadow-md':  '0 5px 18px rgba(153,46,46,0.22)',
            '--shadow-lg':  '0 16px 56px rgba(0,0,0,0.35), 0 4px 14px rgba(153,46,46,0.20)',
        }
    },
    'Guerreiro': {
        swatch: '#7F513E',
        vars: {
            '--page':       '#070504',
            '--parch':      '#0d0908',
            '--parch-mid':  '#150f0c',
            '--parch-deep': '#1d1411',
            '--parch-border':'#5a3a2c',
            '--gold':       '#7F513E',
            '--gold-light': '#98644e',
            '--gold-pale':  '#baa196',
            '--ink':        '#eae7e6',
            '--ink-mid':    '#bba89f',
            '--ink-light':  '#a2877c',
            '--ink-muted':  '#7e6359',
            '--header-top': '#1a120f',
            '--header-mid': '#0d0908',
            '--header-bot': '#070504',
            '--tabs-top':   '#070504',
            '--tabs-bot':   '#030202',
            '--bar-bg':     'rgba(3,2,2,0.97)',
            '--tabs-txt-off':'rgba(127,81,62,0.42)',
            '--tabs-txt-hover':'#a37866',
            '--gold-rgb':   '127,81,62',
            '--shadow-sm':  '0 2px 8px rgba(127,81,62,0.14)',
            '--shadow-md':  '0 5px 18px rgba(127,81,62,0.22)',
            '--shadow-lg':  '0 16px 56px rgba(0,0,0,0.35), 0 4px 14px rgba(127,81,62,0.20)',
        }
    },
    'Ladino': {
        swatch: '#555752',
        vars: {
            '--page':       '#060605',
            '--parch':      '#0b0b0a',
            '--parch-mid':  '#111110',
            '--parch-deep': '#171716',
            '--parch-border':'#3c3e3a',
            '--gold':       '#555752',
            '--gold-light': '#696c66',
            '--gold-pale':  '#a9aaa7',
            '--ink':        '#e8e8e8',
            '--ink-mid':    '#aeafac',
            '--ink-light':  '#8f908d',
            '--ink-muted':  '#6b6d6a',
            '--header-top': '#141514',
            '--header-mid': '#0b0b0a',
            '--header-bot': '#060605',
            '--tabs-top':   '#060605',
            '--tabs-bot':   '#030302',
            '--bar-bg':     'rgba(3,3,2,0.97)',
            '--tabs-txt-off':'rgba(85,87,82,0.42)',
            '--tabs-txt-hover':'#858782',
            '--gold-rgb':   '85,87,82',
            '--shadow-sm':  '0 2px 8px rgba(85,87,82,0.14)',
            '--shadow-md':  '0 5px 18px rgba(85,87,82,0.22)',
            '--shadow-lg':  '0 16px 56px rgba(0,0,0,0.35), 0 4px 14px rgba(85,87,82,0.20)',
        }
    },
    'Mago': {
        swatch: '#2A50A1',
        vars: {
            '--page':       '#030508',
            '--parch':      '#06090f',
            '--parch-mid':  '#090e18',
            '--parch-deep': '#0d1321',
            '--parch-border':'#1e3972',
            '--gold':       '#2A50A1',
            '--gold-light': '#3762bc',
            '--gold-pale':  '#8a9dc7',
            '--ink':        '#e6e7ea',
            '--ink-mid':    '#9da8be',
            '--ink-light':  '#7887a5',
            '--ink-muted':  '#566381',
            '--header-top': '#0b111d',
            '--header-mid': '#06090f',
            '--header-bot': '#030508',
            '--tabs-top':   '#030508',
            '--tabs-bot':   '#010204',
            '--bar-bg':     'rgba(1,2,4,0.97)',
            '--tabs-txt-off':'rgba(42,80,161,0.42)',
            '--tabs-txt-hover':'#5172b8',
            '--gold-rgb':   '42,80,161',
            '--shadow-sm':  '0 2px 8px rgba(42,80,161,0.14)',
            '--shadow-md':  '0 5px 18px rgba(42,80,161,0.22)',
            '--shadow-lg':  '0 16px 56px rgba(0,0,0,0.35), 0 4px 14px rgba(42,80,161,0.20)',
        }
    },
    'Monge': {
        swatch: '#51A5C5',
        vars: {
            '--page':       '#040708',
            '--parch':      '#070c0e',
            '--parch-mid':  '#0a1317',
            '--parch-deep': '#0e1b20',
            '--parch-border':'#317994',
            '--gold':       '#51A5C5',
            '--gold-light': '#57a4c2',
            '--gold-pale':  '#8eb4c2',
            '--ink':        '#e6e9ea',
            '--ink-mid':    '#9db5be',
            '--ink-light':  '#7899a5',
            '--ink-muted':  '#567581',
            '--header-top': '#0d181c',
            '--header-mid': '#070c0e',
            '--header-bot': '#040708',
            '--tabs-top':   '#040708',
            '--tabs-bot':   '#020304',
            '--bar-bg':     'rgba(2,3,4,0.97)',
            '--tabs-txt-off':'rgba(81,165,197,0.42)',
            '--tabs-txt-hover':'#5998b1',
            '--gold-rgb':   '81,165,197',
            '--shadow-sm':  '0 2px 8px rgba(81,165,197,0.14)',
            '--shadow-md':  '0 5px 18px rgba(81,165,197,0.22)',
            '--shadow-lg':  '0 16px 56px rgba(0,0,0,0.35), 0 4px 14px rgba(81,165,197,0.20)',
        }
    },
    'Paladino': {
        swatch: '#B59E54',
        vars: {
            '--page':       '#070604',
            '--parch':      '#0e0c07',
            '--parch-mid':  '#15130c',
            '--parch-deep': '#1e1b10',
            '--parch-border':'#837239',
            '--gold':       '#B59E54',
            '--gold-light': '#b7a262',
            '--gold-pale':  '#bdb394',
            '--ink':        '#eae9e6',
            '--ink-mid':    '#beb69d',
            '--ink-light':  '#a59a79',
            '--ink-muted':  '#807656',
            '--header-top': '#1a180e',
            '--header-mid': '#0e0c07',
            '--header-bot': '#070604',
            '--tabs-top':   '#070604',
            '--tabs-bot':   '#030302',
            '--bar-bg':     'rgba(3,3,2,0.97)',
            '--tabs-txt-off':'rgba(181,158,84,0.42)',
            '--tabs-txt-hover':'#a79762',
            '--gold-rgb':   '181,158,84',
            '--shadow-sm':  '0 2px 8px rgba(181,158,84,0.14)',
            '--shadow-md':  '0 5px 18px rgba(181,158,84,0.22)',
            '--shadow-lg':  '0 16px 56px rgba(0,0,0,0.35), 0 4px 14px rgba(181,158,84,0.20)',
        }
    },
    'Patrulheiro': {
        swatch: '#507F62',
        vars: {
            '--page':       '#050705',
            '--parch':      '#090c0a',
            '--parch-mid':  '#0e1310',
            '--parch-deep': '#131b16',
            '--parch-border':'#395a46',
            '--gold':       '#507F62',
            '--gold-light': '#629676',
            '--gold-pale':  '#9cb4a6',
            '--ink':        '#e6eae8',
            '--ink-mid':    '#a4b7ab',
            '--ink-light':  '#829c8c',
            '--ink-muted':  '#5f7768',
            '--header-top': '#111814',
            '--header-mid': '#090c0a',
            '--header-bot': '#050705',
            '--tabs-top':   '#050705',
            '--tabs-bot':   '#020302',
            '--bar-bg':     'rgba(2,3,2,0.97)',
            '--tabs-txt-off':'rgba(80,127,98,0.42)',
            '--tabs-txt-hover':'#719980',
            '--gold-rgb':   '80,127,98',
            '--shadow-sm':  '0 2px 8px rgba(80,127,98,0.14)',
            '--shadow-md':  '0 5px 18px rgba(80,127,98,0.22)',
            '--shadow-lg':  '0 16px 56px rgba(0,0,0,0.35), 0 4px 14px rgba(80,127,98,0.20)',
        }
    },
    'Artificer': {
        swatch: '#6a4325',
        vars: {
            '--page':         '#080503',
            '--parch':        '#0f0a06',
            '--parch-mid':    '#181009',
            '--parch-deep':   '#21160d',
            '--parch-border': '#4b301b',
            '--gold':         '#6a4325',
            '--gold-light':   '#835734',
            '--gold-pale':    '#c1a590',
            '--ink':          '#e9e5e2',
            '--ink-mid':      '#bcab9f',
            '--ink-light':    '#9f8d7f',
            '--ink-muted':    '#78695e',
            '--header-top':   '#1e130b',
            '--header-mid':   '#0f0a05',
            '--header-bot':   '#080503',
            '--tabs-top':     '#080503',
            '--tabs-bot':     '#040201',
            '--bar-bg':       'rgba(4,2,1,0.97)',
            '--tabs-txt-off':   'rgba(106,67,37,0.42)',
            '--tabs-txt-hover': '#ad7f5c',
            '--gold-rgb':     '106,67,37',
            '--shadow-sm':    '0 2px 8px rgba(106,67,37,0.14)',
            '--shadow-md':    '0 5px 18px rgba(106,67,37,0.22)',
            '--shadow-lg':    '0 16px 56px rgba(0,0,0,0.35), 0 4px 14px rgba(106,67,37,0.20)',
        }
    },


}


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

function aplicarVars(vars) {
    const root = document.documentElement
    Object.entries(vars).forEach(([prop, val]) => root.style.setProperty(prop, val))
}

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

function coletarVarsAtuais() {
    const allFields = [...CP_GROUPS.header, ...CP_GROUPS.fundo, ...CP_GROUPS.acento, ...CP_GROUPS.texto]
    const vars = {}
    allFields.forEach(f => { vars[f.var] = lerVarCSS(f.var) })
    return vars
}

function salvarCustom() {
    ls.set('tema-custom', JSON.stringify(coletarVarsAtuais()))
    ls.del('tema-preset') // custom sobrescreve preset
}

function sincronizarPickers() {
    document.querySelectorAll('.cp-color-input').forEach(input => {
        const val = lerVarCSS(input.dataset.var)
        if (/^#[0-9a-fA-F]{6}$/.test(val)) input.value = val
    })
}

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

function resetarTema() {
    aplicarTema('Umbra')
    ls.del('tema-custom')
    mostrarFeedback('Tema Umbra restaurado.')
}

function mostrarFeedback(msg) {
    const el = document.getElementById('cp-feedback')
    if (!el) return
    el.textContent = msg
    el.classList.add('show')
    clearTimeout(el._t)
    el._t = setTimeout(() => el.classList.remove('show'), 3000)
}

function toggleTemaPanel() {
    const panel = document.getElementById('tema-panel')
    panel.classList.toggle('open')
    if (panel.classList.contains('open')) sincronizarPickers()
}

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

function renderPresets() {
    const el = document.getElementById('cp-presets')
    if (!el) return
    el.innerHTML = Object.entries(TEMAS).map(([nome, d]) => `
        <button class="cp-preset" data-preset="${nome}" onclick="aplicarTema('${nome}')" title="${nome === 'Strahd' ? 'Homenagem ao Curse of Strahd original' : nome}">
            <span class="cp-preset-dot" style="background:${d.swatch}"></span>
            ${nome}${nome === 'Strahd' ? ' <small style="opacity:.55;font-size:.7em;">(homenagem)</small>' : ''}
        </button>`).join('')
}

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
        } catch(e) { aplicarTema('Umbra') }
    } else if (preset && TEMAS[preset]) {
        aplicarTema(preset)
    } else {
        aplicarTema('Umbra') // padrão do gerenciador
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

/* ============================================================
   ROLADOR DE DADOS
   ── Suporte a todos os dados padrão de D&D 5e.
   ── Vantagem/Desvantagem no d20.
   ── Modificador livre (+/-).
   ── Atalhos rápidos contextuais.
   ── Histórico das últimas 20 rolagens.
   ── Animação e indicadores de crítico/falha crítica.
============================================================ */

const DADOS_CONFIG = {
    die: 20,
    qty: 1,
    vantagem: 0,  // -1 desvantagem · 0 normal · 1 vantagem
    historico: [],
}

const DADOS_TIPOS = [4, 6, 8, 10, 12, 20, 100]

function inicializarDados() {
    const container = document.getElementById('dados-tipos')
    if (!container) return

    DADOS_TIPOS.forEach(d => {
        const btn = document.createElement('button')
        btn.className = 'dado-btn' + (d === 20 ? ' ativo' : '')
        btn.textContent = d === 100 ? 'd%' : 'd' + d
        btn.dataset.die = d
        btn.onclick = () => selecionarDado(d)
        container.appendChild(btn)
    })

    // Fecha ao clicar fora
    document.addEventListener('click', e => {
        const panel = document.getElementById('dados-panel')
        const btn   = document.getElementById('btn-dados')
        if (panel && btn && panel.classList.contains('open')
            && !panel.contains(e.target) && !btn.contains(e.target)) {
            panel.classList.remove('open')
        }
    })

    // Restaura histórico da última sessão
    carregarHistoricoDados()
}

function toggleDados() {
    document.getElementById('dados-panel').classList.toggle('open')
}

function selecionarDado(die) {
    DADOS_CONFIG.die = die
    document.getElementById('dados-die-label').textContent = die === 100 ? '%' : die
    document.querySelectorAll('.dado-btn').forEach(b => b.classList.toggle('ativo', parseInt(b.dataset.die) === die))
    // Vantagem só faz sentido no d20
    document.querySelectorAll('.vant-btn').forEach(b => {
        b.style.opacity = (die === 20) ? '1' : '0.35'
        b.style.pointerEvents = (die === 20) ? '' : 'none'
    })
    if (die !== 20) setVantagem(0)
}

function changeQty(delta) {
    DADOS_CONFIG.qty = Math.max(1, Math.min(20, DADOS_CONFIG.qty + delta))
    document.getElementById('dados-qty').textContent = DADOS_CONFIG.qty
}

function setVantagem(v) {
    DADOS_CONFIG.vantagem = v
    document.querySelectorAll('.vant-btn').forEach(b => b.classList.toggle('ativo', parseInt(b.dataset.v) === v))
}

function rolarDado() {
    const { die, qty, vantagem } = DADOS_CONFIG
    const mod = parseInt(document.getElementById('dados-mod-input').value) || 0
    let rolls = [], resultado, detalhes, expressao, isCritico = false, isFalhaCrit = false

    if (vantagem !== 0 && die === 20 && qty === 1) {
        // Rola 2d20, pega o maior ou menor
        const r1 = rolarUm(20), r2 = rolarUm(20)
        const escolhido = vantagem === 1 ? Math.max(r1, r2) : Math.min(r1, r2)
        resultado = escolhido + mod
        detalhes  = `[${r1}, ${r2}] ${vantagem === 1 ? '↑' : '↓'}${mod !== 0 ? (mod > 0 ? ' +' : ' ') + mod : ''}`
        expressao = `d20${vantagem === 1 ? ' vantagem' : ' desvantagem'}${mod !== 0 ? (mod > 0 ? '+' : '') + mod : ''}`
        isCritico    = escolhido === 20
        isFalhaCrit  = escolhido === 1
    } else {
        // Rolagem normal
        for (let i = 0; i < qty; i++) rolls.push(rolarUm(die))
        const soma = rolls.reduce((a, b) => a + b, 0)
        resultado = soma + mod
        detalhes  = `[${rolls.join(', ')}]${mod !== 0 ? (mod > 0 ? ' +' : ' ') + mod : ''}`
        expressao = `${qty}d${die === 100 ? '%' : die}${mod !== 0 ? (mod > 0 ? '+' : '') + mod : ''}`
        if (die === 20 && qty === 1) {
            isCritico   = rolls[0] === 20
            isFalhaCrit = rolls[0] === 1
        }
    }

    // Animação no botão
    const btnDados = document.getElementById('btn-dados')
    btnDados.classList.add('rolando')
    setTimeout(() => btnDados.classList.remove('rolando'), 500)

    // Atualiza resultado com animação
    mostrarResultadoDado(resultado, detalhes, expressao, isCritico, isFalhaCrit)

    // Registra no histórico
    adicionarHistorico(expressao, resultado, detalhes, isCritico, isFalhaCrit)
}

function rolarUm(lados) {
    return Math.floor(Math.random() * lados) + 1
}

function mostrarResultadoDado(valor, detalhes, expressao, critico, falhaCrit) {
    const box    = document.getElementById('dados-resultado')
    const numEl  = document.getElementById('dados-res-num')
    const label  = document.getElementById('dados-res-label')
    const detEl  = document.getElementById('dados-res-detalhe')

    box.className = critico ? 'critico' : falhaCrit ? 'falha-crit' : ''

    label.textContent = expressao
    detEl.textContent = detalhes

    // Animação: mostra números aleatórios por 300ms, depois o resultado
    numEl.className = ''
    let ticks = 0
    const intervalo = setInterval(() => {
        numEl.textContent = Math.floor(Math.random() * (DADOS_CONFIG.die || 20)) + 1
        if (++ticks >= 6) {
            clearInterval(intervalo)
            numEl.textContent = valor
            numEl.className = 'animando' + (critico ? ' critico-num' : falhaCrit ? ' falha-crit-num' : '')
            if (critico)   label.textContent = '✦ CRÍTICO! — ' + expressao
            if (falhaCrit) label.textContent = '💀 FALHA CRÍTICA — ' + expressao
        }
    }, 50)
}

function adicionarHistorico(expressao, valor, detalhes, critico, falhaCrit) {
    const ts = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    DADOS_CONFIG.historico.unshift({ expressao, valor, detalhes, critico, falhaCrit, ts })
    if (DADOS_CONFIG.historico.length > 20) DADOS_CONFIG.historico.pop()
    renderHistorico()
    salvarHistoricoDados()
}

function renderHistorico() {
    const el = document.getElementById('dados-historico')
    if (!el) return
    if (!DADOS_CONFIG.historico.length) {
        el.innerHTML = '<div style="font-size:0.75rem;color:var(--ink-muted);font-style:italic;text-align:center;padding:0.5rem 0;">Nenhuma rolagem ainda.</div>'
        return
    }
    el.innerHTML = DADOS_CONFIG.historico.map(h => `
        <div class="hist-row">
            <span class="hist-expr">${h.critico ? '✦ ' : h.falhaCrit ? '💀 ' : ''}${h.expressao}</span>
            <span class="hist-val ${h.critico ? 'critico-num' : h.falhaCrit ? 'falha-crit-num' : ''}">${h.valor}</span>
            <span class="hist-detail">${h.detalhes}</span>
            <span class="hist-ts">${h.ts}</span>
        </div>`).join('')
}

function limparHistorico() {
    DADOS_CONFIG.historico = []
    renderHistorico()
}

function atalho(tipo) {
    const mod = parseInt(document.getElementById('dados-mod-input').value) || 0

    const atalhos = {
        'iniciativa': () => {
            // Usa o modificador de DES da ficha
            const desMod = parseInt(document.querySelector('#des .attr-mod')?.textContent) || 0
            document.getElementById('dados-mod-input').value = desMod
            selecionarDado(20); setVantagem(0)
            DADOS_CONFIG.qty = 1
            document.getElementById('dados-qty').textContent = 1
        },
        'ataque': () => {
            // d20 com mod atual
            selecionarDado(20); setVantagem(0)
            DADOS_CONFIG.qty = 1
            document.getElementById('dados-qty').textContent = 1
        },
        '4d6drop': () => {
            // 4d6 descartando o menor
            const rolls = [rolarUm(6), rolarUm(6), rolarUm(6), rolarUm(6)]
            const min = Math.min(...rolls)
            const total = rolls.reduce((a, b) => a + b, 0) - min
            const descartado = rolls.indexOf(min)
            const detalhe = rolls.map((r, i) => i === descartado ? `~~${r}~~` : r).join(', ')
            mostrarResultadoDado(total, `[${detalhe}] −menor`, '4d6↓', false, false)
            adicionarHistorico('4d6↓ atributo', total, `[${rolls.join(',')}] desc.${min}`, false, false)
            return // não chama rolarDado padrão
        },
        'percentual': () => {
            selecionarDado(100); setVantagem(0)
            DADOS_CONFIG.qty = 1
            document.getElementById('dados-qty').textContent = 1
        },
        'dano-furtivo': () => {
            // Dano furtivo padrão d6, quantidade baseada no nível (nivel/2 arredondado)
            const nivel = parseInt(document.getElementById('nivel')?.value) || 1
            const qtyFurtivo = Math.max(1, Math.ceil(nivel / 2))
            selecionarDado(6); setVantagem(0)
            DADOS_CONFIG.qty = qtyFurtivo
            document.getElementById('dados-qty').textContent = qtyFurtivo
            document.getElementById('dados-mod-input').value = 0
        },
    }

    if (atalhos[tipo]) {
        const retorno = atalhos[tipo]()
        if (retorno !== undefined || tipo === '4d6drop') return // 4d6drop já exibiu
    }

    rolarDado()
}

function usarModNoRolador(attr) {
    const modEl = document.getElementById(attr + '-mod')
    if (!modEl) return
    const val = parseInt(modEl.textContent) || 0
    const input = document.getElementById('dados-mod-input')
    if (input) input.value = val
    const panel = document.getElementById('dados-panel')
    if (panel && !panel.classList.contains('open')) panel.classList.add('open')
    if (input) {
        input.style.color = 'var(--gold)'
        setTimeout(() => input.style.color = '', 600)
    }
}

/* ============================================================
   DESCANSOS — Curto e Longo
============================================================ */
function descanso(tipo) {
    const nome = document.getElementById('nome-personagem')?.textContent?.trim() || 'o personagem'

    if (tipo === 'curto') {
        if (!confirm(`Descanso Curto para ${nome}?\n\n• Recursos de "descanso curto" restaurados\n• Use seus Dados de Vida para recuperar PV manualmente`)) return

        // Descanso Curto NÃO recupera dados de vida automaticamente.
        // O jogador deve gastar dados de vida manualmente para recuperar PV.
        // (Apenas restauramos recursos de classe aqui.)
        // Restaura habilidades com recarga "Descanso Curto"
        document.querySelectorAll('#habilidades-lista .exp-card').forEach(card => {
            const recarga = card.querySelector('.exp-body select')?.value || ''
            if (recarga === 'Descanso Curto') {
                const usadas = card.querySelectorAll('.exp-body input[type=number]')[1]
                if (usadas) usadas.value = 0
                atualizarCargasBadge(card.id)
            }
        })

        mostrarStatusSalvo('☽ Descanso Curto realizado!')
        salvar()

    } else {
        if (!confirm(`Descanso Longo para ${nome}?\n\n• PV restaurado ao máximo\n• Metade dos Dados de Vida recuperados (mín. 1)\n• Slots de magia restaurados\n• Testes contra a morte limpos\n• Todos os recursos restaurados`)) return

        // Restaura PV
        const pvMax = document.getElementById('pv-max')
        const pvAtual = document.getElementById('pv-atual')
        if (pvMax && pvAtual) pvAtual.value = pvMax.value
        const pvTemp = document.getElementById('pv-temp')
        if (pvTemp) pvTemp.value = 0
        atualizarPVBar()

        // Restaura dados de vida: recupera metade do total (mín. 1), regra D&D 5e
        const dadoTotal = document.getElementById('dado-vida-total')
        const dadoRest  = document.getElementById('dado-vida-rest')
        if (dadoTotal && dadoRest) {
            const total = parseInt(dadoTotal.value) || 1
            const atual = parseInt(dadoRest.value)  || 0
            const recupera = Math.max(1, Math.floor(total / 2))
            dadoRest.value = Math.min(total, atual + recupera)
        }

        // Limpa testes contra a morte
        document.querySelectorAll('.death-check').forEach(cb => cb.checked = false)

        // Restaura slots de magia
        for (let n = 1; n <= 9; n++) ls.del('slot-usado-' + n)
        renderSpellSlotsUsados()
        descansarLongoSP()

        // Restaura todas as habilidades com carga (Descanso Curto, Longo ou Ao Amanhecer)
        document.querySelectorAll('#habilidades-lista .exp-card').forEach(card => {
            const recarga = card.querySelector('.exp-body select')?.value || ''
            if (recarga === 'Descanso Curto' || recarga === 'Descanso Longo' || recarga === 'Ao Amanhecer') {
                const usadas = card.querySelectorAll('.exp-body input[type=number]')[1]
                if (usadas) usadas.value = 0
                atualizarCargasBadge(card.id)
            }
        })

        mostrarStatusSalvo('☀ Descanso Longo realizado!')
        salvar()
    }
}

/* ============================================================
   PERSISTÊNCIA DO HISTÓRICO DE DADOS
   ── Salva/carrega o histórico no localStorage para
      que os jogadores vejam as rolagens da última sessão.
============================================================ */
function salvarHistoricoDados() {
    ls.set('dados-historico', JSON.stringify(DADOS_CONFIG.historico.slice(0, 20)))
}

function carregarHistoricoDados() {
    try {
        const raw = ls.get('dados-historico')
        if (raw) {
            DADOS_CONFIG.historico = JSON.parse(raw)
            renderHistorico()
        }
    } catch(e) {}
}

function mostrarToast(msg, tipo = 'sucesso', duracao = 3000) {
    const icons = {
        sucesso: '✦', erro: '✕', aviso: '⚠', info: 'ℹ',
        'descanso-curto': '🌙', 'descanso-longo': '☀️'
    }
    const container = document.getElementById('toast-container')
    if (!container) return

    const el = document.createElement('div')
    el.className = `toast tipo-${tipo}`
    el.innerHTML = `<span class="toast-icon">${icons[tipo] || '✦'}</span><span class="toast-msg">${msg}</span>`
    container.appendChild(el)

    setTimeout(() => {
        el.classList.add('saindo')
        setTimeout(() => el.remove(), 260)
    }, duracao)
}

const _atualizarPVBarOriginal = window.atualizarPVBar
window.atualizarPVBar = function() {
    if (_atualizarPVBarOriginal) _atualizarPVBarOriginal()
    const pvAtual = parseInt(document.getElementById('pv-atual')?.value) || 0
    const pvMax   = parseInt(document.getElementById('pv-max')?.value)   || 1
    const pct = Math.max(0, pvAtual / pvMax)
    const section = document.getElementById('pv-section') || document.querySelector('.pv-section')
    if (!section) return
    section.classList.remove('pv-saude-boa','pv-saude-media','pv-saude-baixa','pv-saude-critica')
    if (pct > 0.5)       section.classList.add('pv-saude-boa')
    else if (pct > 0.25) section.classList.add('pv-saude-media')
    else if (pct > 0)    section.classList.add('pv-saude-baixa')
    else                 section.classList.add('pv-saude-critica')
}

const _modAnterior = {}
function flashAtributoSeAtualizado(id) {
    const el = document.getElementById(id + '-mod')
    if (!el) return
    const val = el.textContent
    if (_modAnterior[id] !== undefined && _modAnterior[id] !== val) {
        const card = el.closest('.attr-card')
        if (card) {
            card.classList.remove('atualizando')
            void card.offsetWidth // reflow para reiniciar animação
            card.classList.add('atualizando')
            setTimeout(() => card.classList.remove('atualizando'), 500)
        }
    }
    _modAnterior[id] = val
}

// Observa modificadores após cada atualizarTudo
const _atualizarTudoOriginal = window.atualizarTudo
window.atualizarTudo = function() {
    if (_atualizarTudoOriginal) _atualizarTudoOriginal()
    ;['for','des','con','int','sab','car'].forEach(flashAtributoSeAtualizado)
}

const CONDICOES = [
    { id:'amedrontado', emoji:'⚡', label:'Amedrontado', positiva: false },
    { id:'cego',        emoji:'◎', label:'Cego',        positiva: false },
    { id:'encantado',   emoji:'✦', label:'Encantado',   positiva: false },
    { id:'ensurdecido', emoji:'⌀', label:'Ensurdecido', positiva: false },
    { id:'envenenado',  emoji:'☠', label:'Envenenado',  positiva: false },
    { id:'exausto',     emoji:'↯', label:'Exausto',     positiva: false },
    { id:'incapacitado',emoji:'✖', label:'Incapacitado',positiva: false },
    { id:'inconsciente',emoji:'💤', label:'Inconsciente',positiva: false },
    { id:'invisivel',   emoji:'◌', label:'Invisível',   positiva: true  },
    { id:'paralisado',  emoji:'⊗', label:'Paralisado',  positiva: false },
    { id:'petrificado', emoji:'◼', label:'Petrificado', positiva: false },
    { id:'prostrado',   emoji:'⊥', label:'Prostrado',   positiva: false },
    { id:'preso',       emoji:'⛞', label:'Preso',       positiva: false },
]

let condicoesAtivas = new Set()

function renderCondicoes() {
    const grid = document.getElementById('condicoes-grid')
    if (!grid) return
    grid.innerHTML = CONDICOES.map(c => `
        <button class="cond-btn ${condicoesAtivas.has(c.id) ? 'ativa' + (c.positiva ? ' cond-positiva' : '') : ''}"
            onclick="toggleCondicao('${c.id}')" title="${c.label}">
            ${c.emoji} ${c.label}
        </button>`).join('')
}

function toggleCondicao(id) {
    if (condicoesAtivas.has(id)) condicoesAtivas.delete(id)
    else condicoesAtivas.add(id)
    renderCondicoes()
    salvar()
}

// Integrar condições no salvar/carregar — sobrescreve parcialmente
const _salvarOriginal = window.salvar
window.salvar = function() {
    if (_salvarOriginal) _salvarOriginal()
    ls.set('condicoes', JSON.stringify([...condicoesAtivas]))
}

const _carregarOriginal = window.carregar
window.carregar = function() {
    try { if (_carregarOriginal) _carregarOriginal() }
    catch(e) { console.warn('[carregar] erro na cadeia original:', e) }
    try {
        const raw = ls.get('condicoes')
        if (raw) condicoesAtivas = new Set(JSON.parse(raw))
        renderCondicoes()   // ← DENTRO do try-catch
    } catch(e) { condicoesAtivas = new Set(); try { renderCondicoes() } catch(_){} }
}

// Sobrescrever mostrarStatusSalvo por toast
window.mostrarStatusSalvo = function(msg) {
    const tipo = msg.includes('Longo') ? 'descanso-longo'
               : msg.includes('Curto') ? 'descanso-curto'
               : msg.includes('❌') || msg.includes('Erro') ? 'erro'
               : 'sucesso'
    mostrarToast(msg || '✦ Ficha salva!', tipo)
}

function rolarContextual(label, bonus, tipo = 'info') {
    const roll = Math.floor(Math.random() * 20) + 1
    const total = roll + bonus
    const critico   = roll === 20
    const falhaCrit = roll === 1
    const sinal = bonus >= 0 ? '+' : ''
    const toastTipo = critico ? 'sucesso' : falhaCrit ? 'erro' : tipo

    const msg = critico   ? `✦ CRÍTICO! ${label}: <strong>${total}</strong> [20 ${sinal}${bonus}]`
              : falhaCrit ? `✕ Falha! ${label}: <strong>${total}</strong> [1 ${sinal}${bonus}]`
              :             `${label}: <strong>${total}</strong> [d20(${roll}) ${sinal}${bonus}]`

    mostrarToast(msg, toastTipo, 4000)

    // Registra no histórico do rolador
    adicionarHistorico(label, total, `[d20(${roll}) ${sinal}${bonus}]`, critico, falhaCrit)
}

function rolarPericia(nome, sid) {
    const bonusEl = document.getElementById(sid + '-bonus')
    const bonus = parseInt(bonusEl?.textContent) || 0
    rolarContextual(nome, bonus, 'info')
}

function rolarSave(attrId) {
    const bonusEl = document.getElementById('save-bonus-' + attrId)
    const bonus = parseInt(bonusEl?.textContent) || 0
    const label = 'Save ' + (ATTR_NOMES[attrId] || attrId.toUpperCase())
    rolarContextual(label, bonus, 'info')
}

let _recursos = []   // array de { id, nome, atual, max, recarga, dado }

function _recursoId() { return 'rec-' + Date.now().toString(36) }

// Presets para classes comuns
const RECURSOS_PRESETS = {
    'Bárbaro':    [{ nome:'Rages',               max:2,  recarga:'dl', dado:null }],
    'Bardo':      [{ nome:'Inspiração Bárdica',  max:3,  recarga:'dl', dado:'d6' }],
    'Clérigo':    [{ nome:'Conjurar Divindade',  max:1,  recarga:'dl', dado:null }],
    'Druida':     [{ nome:'Forma Selvagem',       max:2,  recarga:'dc', dado:null }],
    'Guerreiro':  [{ nome:'Surge de Ação',        max:1,  recarga:'dc', dado:null },
                   { nome:'Dados de Super.',      max:4,  recarga:'dc', dado:'d8' }],
    'Monge':      [{ nome:'Ki',                  max:4,  recarga:'dc', dado:null }],
    'Paladino':   [{ nome:'Imposição de Mãos',   max:5,  recarga:'dl', dado:null },
                   { nome:'Sentido Divino',       max:3,  recarga:'dl', dado:null }],
    'Patrulheiro':[{ nome:'Marca do Caçador',    max:3,  recarga:'dl', dado:null }],
    'Ladino':     [{ nome:'Usar Magia Arcana',   max:2,  recarga:'dc', dado:null }],
    'Feiticeiro': [{ nome:'Pts. de Feitiçaria',  max:4,  recarga:'dl', dado:null }],
    'Bruxo':      [{ nome:'Patrono (slots)',      max:1,  recarga:'dc', dado:null }],
    'Mago':       [{ nome:'Recuperação Arcana',  max:1,  recarga:'dc', dado:null }],
}

function renderRecursos() {
    const el = document.getElementById('recursos-lista')
    if (!el) return
    if (!_recursos.length) {
        el.innerHTML = '<p class="recursos-empty">Nenhum recurso adicionado. Use os atalhos ou crie um personalizado.</p>'
        return
    }
    el.innerHTML = _recursos.map(r => `
        <div class="recurso-item" id="ri-${r.id}">
            <div class="recurso-topo">
                <input class="recurso-nome-input" value="${r.nome}"
                    onchange="_recursos.find(x=>x.id==='${r.id}').nome=this.value;salvar()">
                <button class="recurso-del" onclick="removerRecurso('${r.id}')" title="Remover">✕</button>
            </div>
            <div class="recurso-usos">
                <button class="uso-btn" onclick="mudarRecurso('${r.id}',-1)">−</button>
                <div class="uso-pips">
                    ${Array.from({length: Math.min(r.max,20)}, (_,i) => `
                        <button class="uso-pip uso-pip-rect ${i < r.atual ? 'cheio' : ''}"
                            onclick="setRecurso('${r.id}',${i < r.atual ? i : i+1})"
                            title="${i+1}/${r.max}"></button>`
                    ).join('')}
                </div>
                <button class="uso-btn" onclick="mudarRecurso('${r.id}',1)">+</button>
                <span class="uso-label">${r.atual}/${r.max}</span>
            </div>
            <div class="recurso-mid-wrap">
                <div class="recurso-max-wrap">
                    <label>Máx:</label>
                    <input type="number" class="recurso-max-input" value="${r.max}" min="1" max="99"
                        onchange="setMaxRecurso('${r.id}',this.value)">
                </div>
                <div class="recurso-dado-wrap">
                    <label>Dado:</label>
                    <input type="text" class="recurso-dado-input" placeholder="d6…" value="${r.dado || ''}"
                        onchange="setDadoRecurso('${r.id}',this.value)">
                </div>
                <div class="recurso-recarga-wrap">
                    <label>Recarga:</label>
                    <select class="recurso-recarga-select" title="Tipo de recuperação"
                        onchange="_recursos.find(x=>x.id==='${r.id}').recarga=this.value;salvar()">
                        <option value="dc" ${r.recarga === 'dc' ? 'selected' : ''}>☽ DC</option>
                        <option value="dl" ${r.recarga === 'dl' ? 'selected' : ''}>☀ DL</option>
                        <option value="am" ${r.recarga === 'am' ? 'selected' : ''}>✦ AM</option>
                        <option value="manual" ${(!r.recarga || r.recarga === 'manual') ? 'selected' : ''}>— Manual</option>
                    </select>
                </div>
                ${r.dado ? `<button class="recurso-dado-btn" onclick="rolarRecurso('${r.id}')" title="Rolar ${r.dado}">🎲</button>` : ''}
            </div>
            <div class="recurso-desc-wrap">
                <textarea class="recurso-desc" placeholder="Descrição do recurso…"
                    onchange="_recursos.find(x=>x.id==='${r.id}').desc=this.value;salvar()">${r.desc || ''}</textarea>
            </div>
        </div>`).join('')
}

function addRecurso(preset = null) {
    const base = preset || { nome: 'Novo Recurso', max: 3, recarga: 'dl', dado: null }
    _recursos.push({ id: _recursoId(), atual: base.max, ...base })
    renderRecursos()
    salvar()
}

function removerRecurso(id) {
    _recursos = _recursos.filter(r => r.id !== id)
    renderRecursos()
    salvar()
}

function mudarRecurso(id, delta) {
    const r = _recursos.find(x => x.id === id)
    if (!r) return
    r.atual = Math.max(0, Math.min(r.max, r.atual + delta))
    renderRecursos()
    salvar()
}

function setRecurso(id, val) {
    const r = _recursos.find(x => x.id === id)
    if (!r) return
    r.atual = Math.max(0, Math.min(r.max, val))
    renderRecursos()
    salvar()
}

function setMaxRecurso(id, val) {
    const r = _recursos.find(x => x.id === id)
    if (!r) return
    r.max = Math.max(1, parseInt(val) || 1)
    r.atual = Math.min(r.atual, r.max)
    renderRecursos()
    salvar()
}

function setDadoRecurso(id, val) {
    const r = _recursos.find(x => x.id === id)
    if (!r) return
    r.dado = val.trim() || null
    // Não re-renderiza tudo para não perder o foco do input
    salvar()
}

function rolarRecurso(id) {
    const r = _recursos.find(x => x.id === id)
    if (!r || !r.dado) return
    const lados = parseInt(r.dado.replace('d','')) || 6
    const roll = Math.floor(Math.random() * lados) + 1
    mostrarToast(`${r.nome}: <strong>${roll}</strong> [${r.dado}]`, 'info', 3500)
    adicionarHistorico(r.nome, roll, `[${r.dado}]`, false, false)
}

function addRecursoPreset() {
    const classe = document.getElementById('classe')?.value || ''
    const presets = RECURSOS_PRESETS[classe]
    if (presets?.length) {
        presets.forEach(p => addRecurso(p))
        mostrarToast(`Recursos de ${classe} adicionados!`, 'sucesso')
    } else {
        addRecurso()
    }
}

// Integração com descansos — restaurar recursos por tipo de recarga
const _descansoOriginal = window.descanso
window.descanso = function(tipo) {
    if (_descansoOriginal) _descansoOriginal(tipo)
    _recursos.forEach(r => {
        if (tipo === 'longo' || (tipo === 'curto' && r.recarga === 'dc')) {
            r.atual = r.max
        }
    })
    renderRecursos()
}

// Integração com salvar/carregar
const _salvarRecOriginal = window.salvar
window.salvar = function() {
    if (_salvarRecOriginal) _salvarRecOriginal()
    ls.set('recursos', JSON.stringify(_recursos))
}

const _carregarRecOriginal = window.carregar
window.carregar = function() {
    if (_carregarRecOriginal) _carregarRecOriginal()
    try {
        const raw = ls.get('recursos')
        if (raw) { _recursos = JSON.parse(raw); renderRecursos() }
    } catch(e) {}
}

function parseDiceExpr(expr) {
    if (!expr || !expr.trim()) return null
    const m = expr.trim().match(/(\d+)[dD](\d+)\s*([+-]\s*\d+)?/)
    if (!m) {
        const n = parseInt(expr)
        return isNaN(n) ? null : { count: 0, sides: 0, bonus: n, fixo: true }
    }
    return {
        count: parseInt(m[1]),
        sides: parseInt(m[2]),
        bonus: m[3] ? parseInt(m[3].replace(/\s/g,'')) : 0,
        fixo: false,
    }
}

function rolarExpressao(expr, crit = false) {
    const d = parseDiceExpr(expr)
    if (!d) return null
    if (d.fixo) return { total: d.bonus, detalhe: `[${d.bonus}]` }
    const numDados = crit ? d.count * 2 : d.count
    const rolls = Array.from({ length: numDados }, () => Math.floor(Math.random() * d.sides) + 1)
    const soma  = rolls.reduce((a, b) => a + b, 0) + d.bonus
    const sinal = d.bonus > 0 ? '+' + d.bonus : d.bonus < 0 ? d.bonus : ''
    const detalhe = `[${rolls.join('+')}${sinal}]${crit ? ' ✦×2' : ''}`
    return { total: soma, detalhe }
}

function rolarAtaque(btn) {
    const tr    = btn.closest('tr')
    const ins   = tr.querySelectorAll('input')
    const nome  = ins[0]?.value?.trim() || 'Ataque'
    const atkStr = ins[1]?.value?.trim() || '0'
    const danoExpr = ins[2]?.value?.trim() || ''
    const tipo  = ins[3]?.value?.trim() || ''

    const atkBonus = parseInt(atkStr.replace(/[^0-9+-]/g, '')) || 0

    // Rola d20 para acerto
    const d20     = Math.floor(Math.random() * 20) + 1
    const atkTotal = d20 + atkBonus
    const critico  = d20 === 20
    const falha    = d20 === 1

    // Rola dano
    const danoRoll = danoExpr ? rolarExpressao(danoExpr, critico) : null
    const sinalAtk = atkBonus >= 0 ? '+' : ''

    // Monta mensagem
    let msg, toastTipo
    if (critico) {
        const danoTxt = danoRoll ? ` — Dano ×2: <strong>${danoRoll.total}</strong> ${danoRoll.detalhe}${tipo ? ' ' + tipo : ''}` : ''
        msg      = `⚔ ${nome}: <strong>✦ CRÍTICO!</strong> [d20(20)${sinalAtk}${atkBonus}]${danoTxt}`
        toastTipo = 'sucesso'
        dispararCritico()
    } else if (falha) {
        msg      = `⚔ ${nome}: <strong>✕ Falha Crítica</strong> [d20(1)${sinalAtk}${atkBonus}]`
        toastTipo = 'erro'
        dispararFalha()
    } else {
        const danoTxt = danoRoll ? ` — Dano: <strong>${danoRoll.total}</strong> ${danoRoll.detalhe}${tipo ? ' ' + tipo : ''}` : ''
        msg      = `⚔ ${nome}: <strong>${atkTotal}</strong> [d20(${d20})${sinalAtk}${atkBonus}]${danoTxt}`
        toastTipo = 'info'
    }

    mostrarToast(msg, toastTipo, 5000)
    adicionarHistorico(nome, atkTotal, `[d20(${d20})${sinalAtk}${atkBonus}]`, critico, falha)

    // Anima a linha do ataque
    tr.classList.remove('ataque-animado')
    void tr.offsetWidth
    tr.classList.add('ataque-animado')
    setTimeout(() => tr.classList.remove('ataque-animado'), 600)
}

let _pvAnterior = null

// Sobrescreve atualizarPVBar para detectar direção da mudança
;(function() {
    const _orig = window.atualizarPVBar
    window.atualizarPVBar = function() {
        const pvNovo = parseInt(document.getElementById('pv-atual')?.value) || 0
        if (_orig) _orig()
        if (_pvAnterior !== null && pvNovo !== _pvAnterior) {
            if (pvNovo < _pvAnterior) dispararDano()
            else                      dispararCura()
        }
        _pvAnterior = pvNovo
    }
})()

function _getPvSection() {
    return document.getElementById('pv-section')
        || document.querySelector('.pv-section')
        || document.getElementById('pv-bar')?.parentElement
}

function dispararDano() {
    const el = _getPvSection()
    if (!el) return
    el.classList.remove('anim-dano', 'anim-cura')
    void el.offsetWidth
    el.classList.add('anim-dano')
    setTimeout(() => el.classList.remove('anim-dano'), 700)
}

function dispararCura() {
    const el = _getPvSection()
    if (!el) return
    el.classList.remove('anim-dano', 'anim-cura')
    void el.offsetWidth
    el.classList.add('anim-cura')
    setTimeout(() => el.classList.remove('anim-cura'), 900)
}

function dispararCritico() {
    let flash = document.getElementById('anim-crit-flash')
    if (!flash) {
        flash = document.createElement('div')
        flash.id = 'anim-crit-flash'
        flash.className = 'anim-flash'
        document.body.appendChild(flash)
    }
    flash.style.background = 'radial-gradient(ellipse at center, rgba(220,170,10,0.45) 0%, transparent 70%)'
    flash.classList.remove('ativo')
    void flash.offsetWidth
    flash.classList.add('ativo')
    setTimeout(() => flash.classList.remove('ativo'), 800)
}

function dispararFalha() {
    let flash = document.getElementById('anim-crit-flash')
    if (!flash) {
        flash = document.createElement('div')
        flash.id = 'anim-crit-flash'
        flash.className = 'anim-flash'
        document.body.appendChild(flash)
    }
    flash.style.background = 'radial-gradient(ellipse at center, rgba(180,20,20,0.40) 0%, transparent 70%)'
    flash.classList.remove('ativo')
    void flash.offsetWidth
    flash.classList.add('ativo')
    setTimeout(() => flash.classList.remove('ativo'), 700)
}
/* ═══════════════════════════════════════════════════════════
   MELHORIAS v2 — Quick Stats, Fonte, Campo Custom, Attr Colors
═══════════════════════════════════════════════════════════ */

/* ── BARRA DE STATS RÁPIDOS ──────────────────────────────── */

// Definição dos slots disponíveis
const QS_SLOTS = [
    { id: 'pv',   label: 'PV',       icon: '❤',  title: 'Pontos de Vida',   get: () => { const a=parseInt(g('pv-atual')?.value)||0; const m=parseInt(g('pv-max')?.value)||0; return m>0?a+'/'+m:'—' }, extra: (el) => { const pvAtual=parseInt(g('pv-atual')?.value)||0; const pvMax=parseInt(g('pv-max')?.value)||1; const pct=pvMax>0?pvAtual/pvMax:1; el.className='qs-val'; if(pct<=0.25) el.classList.add('pv-crit'); else if(pct<=0.5) el.classList.add('pv-low'); } },
    { id: 'ca',   label: 'CA',       icon: '🛡',  title: 'Classe de Armadura',get: () => g('ca-total')?.value || '—' },
    { id: 'init', label: 'INIT',     icon: '⚡',  title: 'Iniciativa',        get: () => g('iniciativa')?.value || '—' },
    { id: 'sab',  label: 'SAB.PASS', icon: '👁',  title: 'Sabedoria Passiva', get: () => g('sab-passiva')?.value || '—' },
    { id: 'prof', label: 'PROF',     icon: '✦',  title: 'Bônus de Proficiência', get: () => { const v=parseInt(g('proficiencia')?.value)||2; return '+'+ v } },
    { id: 'exau', label: 'EXAUSTÃO', icon: '↯',  title: 'Nível de Exaustão', get: () => g('exaustao')?.value || '0' },
]

let _qsAtivos = new Set(['pv','ca','init','sab']) // padrão

function renderQuickStatsBar() {
    const bar = g('quick-stats')
    if (!bar) return
    bar.innerHTML = ''
    const ativos = QS_SLOTS.filter(s => _qsAtivos.has(s.id))
    ativos.forEach((slot, i) => {
        const item = document.createElement('div')
        item.className = 'qs-item'
        item.title = slot.title
        item.innerHTML = `<span class="qs-icon">${slot.icon}</span><span class="qs-label">${slot.label}</span><span class="qs-val" id="qs-${slot.id}">—</span>`
        bar.appendChild(item)
        if (i < ativos.length - 1) {
            const sep = document.createElement('div')
            sep.className = 'qs-sep'
            sep.textContent = '|'
            bar.appendChild(sep)
        }
    })
    atualizarQuickStats()
}

function atualizarQuickStats() {
    QS_SLOTS.forEach(slot => {
        const el = g('qs-' + slot.id)
        if (!el) return
        el.textContent = slot.get()
        if (slot.extra) slot.extra(el)
    })
}

function renderCPQuickStats() {
    const el = g('cp-quickstats-opts')
    if (!el) return
    el.innerHTML = QS_SLOTS.map(s => `
        <div class="cp-row" style="padding:3px 0;">
            <label class="cp-toggle-label">
                <input type="checkbox" ${_qsAtivos.has(s.id) ? 'checked' : ''}
                    onchange="toggleQSSlot('${s.id}', this.checked)">
                ${s.icon} ${s.title}
            </label>
        </div>`).join('')
}

function toggleQSSlot(id, on) {
    if (on) _qsAtivos.add(id); else _qsAtivos.delete(id)
    ls.set('qs-ativos', JSON.stringify([..._qsAtivos]))
    renderQuickStatsBar()
}

function restaurarQSAtivos() {
    const raw = ls.get('qs-ativos')
    if (raw) {
        try { _qsAtivos = new Set(JSON.parse(raw)) } catch(e) {}
    }
    renderQuickStatsBar()
    renderCPQuickStats()
}

// Hook atualizarQuickStats into atualizarTudo
const _atualizarTudoOrig = window.atualizarTudo
window.atualizarTudo = function() {
    if (_atualizarTudoOrig) _atualizarTudoOrig()
    try { atualizarQuickStats() } catch(e) {}
}

// Also hook into PV bar updates
const _pvBarOrig = window.atualizarPVBar
window.atualizarPVBar = function() {
    if (_pvBarOrig) _pvBarOrig()
    try { atualizarQuickStats() } catch(e) {}
}

/* ── FONT SELECTOR ───────────────────────────────────────── */
const FONT_GOOGLE_URLS = {
    classic:  'https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700&family=Cinzel:wght@400;600;700&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&display=swap',
    readable: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap',
    fantasy:  'https://fonts.googleapis.com/css2?family=Philosopher:ital,wght@0,400;0,700;1,400&family=IM+Fell+English:ital@0;1&display=swap',
    ink:      'https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&family=Philosopher:wght@400;700&family=Crimson+Pro:wght@400;600&display=swap',
}

function onFontChange(preset) {
    document.body.className = document.body.className.replace(/\bfont-\w+/g, '').trim()
    if (preset !== 'medieval') {
        document.body.classList.add('font-' + preset)
        // Load Google Font if needed
        if (FONT_GOOGLE_URLS[preset]) {
            const id = 'gfont-' + preset
            if (!document.getElementById(id)) {
                const link = document.createElement('link')
                link.id = id
                link.rel = 'stylesheet'
                link.href = FONT_GOOGLE_URLS[preset]
                document.head.appendChild(link)
            }
        }
    }
    ls.set('font-preset', preset)
    sincronizarFontSelect()
}

function onSizeChange(px) {
    document.documentElement.style.setProperty('--font-size-base', px + 'px')
    document.body.style.fontSize = px + 'px'
    ls.set('font-size', px)
    sincronizarFontSelect()
}

function sincronizarFontSelect() {
    const sel = document.getElementById('cp-font-select')
    if (sel) sel.value = ls.get('font-preset') || 'medieval'
    const szSel = document.getElementById('cp-size-select')
    if (szSel) szSel.value = ls.get('font-size') || '17'
}

function restaurarFontes() {
    const fp = ls.get('font-preset')
    if (fp && fp !== 'medieval') onFontChange(fp)
    const fz = ls.get('font-size')
    if (fz) onSizeChange(fz)
    sincronizarFontSelect()
}

/* ── CAMPO DE IDENTIDADE PERSONALIZADA ───────────────────── */
function toggleCampoCustom(ativo) {
    const wrap = document.getElementById('hfield-custom-wrap')
    const config = document.getElementById('cp-custom-field-config')
    const cb = document.getElementById('cp-custom-field-on')

    if (wrap) wrap.style.display = ativo ? '' : 'none'
    if (config) config.style.display = ativo ? '' : 'none'
    if (cb) cb.checked = ativo
    ls.set('campo-custom-on', ativo ? '1' : '0')
}

function onCustomLabelChange(val) {
    const lbl = document.getElementById('hfield-custom-label')
    if (lbl) lbl.textContent = val || 'Personalizado'
    ls.set('campo-custom-label', val)
}

function restaurarCampoCustom() {
    const on = ls.get('campo-custom-on') === '1'
    const label = ls.get('campo-custom-label') || ''
    const valor = ls.get('campo-custom-valor') || ''

    const cb = document.getElementById('cp-custom-field-on')
    if (cb) cb.checked = on

    if (on) {
        toggleCampoCustom(true)
        const lbl = document.getElementById('hfield-custom-label')
        const inp = document.getElementById('cp-custom-label-input')
        const campo = document.getElementById('campo-custom')
        if (lbl && label) lbl.textContent = label
        if (inp && label) inp.value = label
        if (campo && valor) campo.value = valor
    }
}

// Save campo-custom value when changed
document.addEventListener('input', function(e) {
    if (e.target && e.target.id === 'campo-custom') {
        ls.set('campo-custom-valor', e.target.value)
    }
})

/* ── ATTR COLORS NO PAINEL DE TEMA ──────────────────────── */
const CP_ATTRS = [
    { var: '--for-color', label: 'Força',        hint: 'cor do mod. de FOR e barra' },
    { var: '--des-color', label: 'Destreza',      hint: 'cor do mod. de DES'         },
    { var: '--con-color', label: 'Constituição',  hint: 'cor do mod. de CON'         },
    { var: '--int-color', label: 'Inteligência',  hint: 'cor do mod. de INT'         },
    { var: '--sab-color', label: 'Sabedoria',     hint: 'cor do mod. de SAB'         },
    { var: '--car-color', label: 'Carisma',       hint: 'cor do mod. de CAR'         },
    { var: '--pv-bar-color', label: 'Barra de PV (alta)', hint: 'cor quando HP > 50%' },
    { var: '--pv-bar-low',   label: 'Barra de PV (média)', hint: 'cor quando HP 25–50%' },
    { var: '--pv-bar-crit',  label: 'Barra de PV (crítico)', hint: 'cor quando HP ≤ 25%' },
]

function renderCPAttrs() {
    const el = document.getElementById('cp-group-attrs')
    if (!el) return
    el.innerHTML = CP_ATTRS.map(f => `
        <div class="cp-row">
            <div class="cp-row-info">
                <div class="cp-row-label">${f.label}</div>
                <div class="cp-row-hint">${f.hint}</div>
            </div>
            <div class="cp-color-wrap" title="Clique para mudar">
                <input type="color" class="cp-color-input"
                    data-var="${f.var}" value="#888888"
                    oninput="onAttrColorChange(this)">
            </div>
        </div>`).join('')
    sincronizarAttrPickers()
}

function onAttrColorChange(input) {
    document.documentElement.style.setProperty(input.dataset.var, input.value)
    // save in custom tema
    const allCustom = {}
    ;[...CP_ATTRS].forEach(f => {
        allCustom[f.var] = getComputedStyle(document.documentElement).getPropertyValue(f.var).trim()
    })
    const existing = ls.get('tema-attrs')
    const merged = Object.assign(existing ? JSON.parse(existing) : {}, allCustom)
    ls.set('tema-attrs', JSON.stringify(merged))
}

function sincronizarAttrPickers() {
    document.querySelectorAll('#cp-group-attrs .cp-color-input').forEach(inp => {
        const raw = getComputedStyle(document.documentElement).getPropertyValue(inp.dataset.var).trim()
        // Convert to hex if needed
        const m = raw.match(/#[0-9a-fA-F]{6}/)
        if (m) inp.value = m[0]
    })
}

function restaurarAttrColors() {
    const raw = ls.get('tema-attrs')
    if (!raw) return
    try {
        const vars = JSON.parse(raw)
        Object.entries(vars).forEach(([k,v]) => document.documentElement.style.setProperty(k,v))
    } catch(e) {}
}

/* ── OVERRIDE inicializarTemas para incluir attrs e fontes ── */
const _inicializarTemasOrig = window.inicializarTemas
window.inicializarTemas = function() {
    if (_inicializarTemasOrig) _inicializarTemasOrig()
    try { renderCPAttrs() }          catch(e) { console.warn('renderCPAttrs:', e) }
    try { restaurarFontes() }        catch(e) { console.warn('restaurarFontes:', e) }
    try { restaurarCampoCustom() }   catch(e) { console.warn('restaurarCampoCustom:', e) }
    try { restaurarAttrColors() }    catch(e) { console.warn('restaurarAttrColors:', e) }
    try { sincronizarAttrPickers() } catch(e) {}
    try { restaurarQSAtivos() }      catch(e) { console.warn('restaurarQSAtivos:', e) }
    // Initial quick stats render
    setTimeout(() => { try { atualizarQuickStats() } catch(e) {} }, 200)
}

/* ── SAVE/LOAD HOOKS para campo custom ───────────────────── */
const _salvarCustomFieldOrig = window.salvar
window.salvar = function() {
    if (_salvarCustomFieldOrig) _salvarCustomFieldOrig()
    // Also persist custom field valor
    const campo = document.getElementById('campo-custom')
    if (campo) ls.set('campo-custom-valor', campo.value)
}

// Patch toggleTemaPanel para renderizar opções de QS ao abrir
;(function() {
    const _orig = window.toggleTemaPanel
    window.toggleTemaPanel = function() {
        if (_orig) _orig()
        const panel = document.getElementById('tema-panel')
        if (panel?.classList.contains('open')) {
            try { renderCPQuickStats() } catch(e) {}
        }
    }
})()
/* ═══════════════════════════════════════════════════════════
   MELHORIAS v3
   1. Efeito Ripple nos botões
   2. Badges de magia alto nível com estrela (⭐)
   3. Seções colapsáveis na aba Combate
   4. Toast com undo ao remover itens
═══════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════
   1. EFEITO RIPPLE
   ── Adiciona um círculo de onda no ponto de clique de
      qualquer botão marcado com position:relative + overflow:hidden.
══════════════════════════════════════════════════════════ */
;(function initRipple() {
    const SELETORES = [
        '.btn-add', '.save-btn', '.rest-btn',
        '.btn-rolar-ataque', '.btn-remove', '.tab-btn',
        '.cond-btn', '.img-mode-btn',
    ]

    function criarRipple(e) {
        const btn = e.currentTarget
        // remove ripples anteriores para não acumular
        btn.querySelectorAll('.ripple-circle').forEach(r => r.remove())

        const rect = btn.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        const span = document.createElement('span')
        span.className = 'ripple-circle'
        span.style.left = x + 'px'
        span.style.top  = y + 'px'
        btn.appendChild(span)

        // remove após animação
        span.addEventListener('animationend', () => span.remove(), { once: true })
    }

    function bindRipple() {
        SELETORES.forEach(sel => {
            document.querySelectorAll(sel).forEach(btn => {
                if (!btn.dataset.rippleBound) {
                    btn.addEventListener('click', criarRipple)
                    btn.dataset.rippleBound = '1'
                }
            })
        })
    }

    // Bind imediato + re-bind via MutationObserver (para botões adicionados dinamicamente)
    document.addEventListener('DOMContentLoaded', bindRipple)

    const rippleObserver = new MutationObserver(() => bindRipple())
    document.addEventListener('DOMContentLoaded', () => {
        rippleObserver.observe(document.body, { childList: true, subtree: true })
        bindRipple()
    })
})()

/* ══════════════════════════════════════════════════════════
   2. BADGES DE MAGIA ALTO NÍVEL COM ESTRELA
   ── Sobrescreve atualizarBadge para injetar ⭐ nos níveis 6-9
   ── Também corrige addSpellCard para já renderizar a estrela
══════════════════════════════════════════════════════════ */
;(function patchBadges() {

    const ALTO_NIVEL = new Set([6,7,8,9])

    // Helper: gera o innerHTML do badge
    function badgeHTML(nivel, cor) {
        const estrela = ALTO_NIVEL.has(nivel)
            ? '<span class="spell-star" aria-hidden="true">⭐</span>'
            : ''
        return `${estrela}NV ${nivel}`
    }

    // Patch atualizarBadge
    const _origAtualizarBadge = window.atualizarBadge
    window.atualizarBadge = function(id, withLevel) {
        if (!withLevel) return
        const nivel = parseInt(document.getElementById('nivel-' + id)?.value) || 1
        const badge = document.getElementById('badge-' + id)
        if (!badge) return

        badge.setAttribute('data-level', nivel)
        badge.style.background = '' // limpa inline; CSS cuida dos 6-9
        if (!ALTO_NIVEL.has(nivel)) {
            // Níveis 1-5: usa a cor da tabela do script original
            badge.style.background = SPELL_LEVEL_COLORS[nivel] || SPELL_LEVEL_COLORS[1]
        }
        badge.innerHTML = badgeHTML(nivel, badge.style.background)
    }

    // Patch addSpellCard para já criar o badge correto
    const _origAddSpellCard = window.addSpellCard
    window.addSpellCard = function(listaId, withLevel, data = {}) {
        _origAddSpellCard(listaId, withLevel, data)

        if (!withLevel) return
        // Encontra o último card adicionado
        const lista = document.getElementById(listaId)
        if (!lista) return
        const cards = lista.querySelectorAll('.exp-card')
        const card = cards[cards.length - 1]
        if (!card) return

        const badge = card.querySelector('.spell-level-badge')
        if (!badge) return
        const nivel = parseInt(data.nivel) || 1
        badge.setAttribute('data-level', nivel)
        if (!ALTO_NIVEL.has(nivel)) {
            badge.style.background = SPELL_LEVEL_COLORS[nivel] || SPELL_LEVEL_COLORS[1]
        } else {
            badge.style.background = '' // deixa CSS cuidar
        }
        badge.innerHTML = badgeHTML(nivel, badge.style.background)
    }

})()

/* ══════════════════════════════════════════════════════════
   3. SEÇÕES COLAPSÁVEIS NAS ABAS ATRIBUTOS E ATAQUES
   ── Varre todos .section-title dentro de #tab-atributos e
      #tab-ataques e insere um botão [▼] que colapsa o conteúdo
      seguinte.
   ── Estado salvo no localStorage (chave: secoes-colapsadas).
══════════════════════════════════════════════════════════ */
;(function initColapsaveis() {

    const LS_KEY = 'secoes-colapsadas'

    function salvarEstado(colapsadas) {
        ls.set(LS_KEY, JSON.stringify([...colapsadas]))
    }

    function carregarEstado() {
        try {
            const raw = ls.get(LS_KEY)
            return raw ? new Set(JSON.parse(raw)) : new Set()
        } catch(_) { return new Set() }
    }

    // Agrupa elementos entre dois .section-title num div.collapsible-section
    function agruparSecao(titulo) {
        const elementos = []
        let el = titulo.nextElementSibling
        while (el && !el.classList.contains('section-title') && !el.classList.contains('death-section-title')) {
            elementos.push(el)
            el = el.nextElementSibling
        }
        if (!elementos.length) return null

        const wrap = document.createElement('div')
        wrap.className = 'collapsible-section'

        titulo.parentNode.insertBefore(wrap, elementos[0])
        elementos.forEach(e => wrap.appendChild(e))
        return wrap
    }

    function toggleSecao(id, wrap, btn, colapsadas) {
        const estaColapsado = colapsadas.has(id)
        if (estaColapsado) {
            colapsadas.delete(id)
            wrap.classList.remove('collapsed')
            btn.classList.remove('collapsed')
            btn.title = 'Recolher seção'
        } else {
            colapsadas.add(id)
            wrap.classList.add('collapsed')
            btn.classList.add('collapsed')
            btn.title = 'Expandir seção'
        }
        salvarEstado(colapsadas)
    }

    function setup() {
        const colapsadas = carregarEstado()
        ;['tab-atributos', 'tab-ataques'].forEach(tabId => {
            const painel = document.getElementById(tabId)
            if (!painel) return
            setupPainel(painel, colapsadas)
        })
    }

    function setupPainel(painel, colapsadas) {
        let idx = 0

        painel.querySelectorAll('.section-title').forEach(titulo => {
            // evita duplicar o botão
            if (titulo.querySelector('.section-collapse-btn')) return

            const id = 'secao-' + (titulo.textContent.trim().replace(/\s+/g,'_').toLowerCase() || idx++)
            titulo.classList.add('has-collapse')

            const wrap = agruparSecao(titulo)
            if (!wrap) return

            // Cria botão [▼]
            const btn = document.createElement('button')
            btn.className = 'section-collapse-btn'
            btn.innerHTML = '▼'
            btn.setAttribute('aria-label', 'Recolher / expandir seção')
            btn.title = 'Recolher seção'
            btn.type = 'button'

            // Insere ANTES do ::after do section-title (ao final dos filhos)
            titulo.appendChild(btn)

            // Aplica estado salvo
            if (colapsadas.has(id)) {
                wrap.classList.add('collapsed')
                btn.classList.add('collapsed')
                btn.title = 'Expandir seção'
            }

            btn.addEventListener('click', (e) => {
                e.stopPropagation()
                toggleSecao(id, wrap, btn, colapsadas)
            })
        })
    }

    // Expõe setup globalmente para ser chamado após renderSaves no window.onload
    window.setupColapsaveis = setup

    // Espera o DOM estar pronto (o script roda após o HTML)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup)
    } else {
        // DOM já pronto: aguarda um tick para garantir que o render de saves/perícias ocorreu
        setTimeout(setup, 500)
    }

})()

/* ══════════════════════════════════════════════════════════
   4. TOAST COM UNDO AO REMOVER ITENS
   ── Intercepta os botões .btn-remove de ataques, munições
      e cards (habilidades/magias) para exibir um toast de
      "Item removido" com botão Desfazer por 3 segundos.
══════════════════════════════════════════════════════════ */
;(function initUndoRemove() {

    // Guarda o estado do último item removido para o undo
    let pendingUndo = null
    let undoTimer   = null

    function mostrarToastUndo(msg, onUndo) {
        const container = document.getElementById('toast-container')
        if (!container) return

        // Cancela qualquer undo pendente anterior
        if (pendingUndo) {
            pendingUndo.el?.remove()
            clearTimeout(undoTimer)
            pendingUndo = null
        }

        const el = document.createElement('div')
        el.className = 'toast tipo-aviso'
        el.style.setProperty('--toast-dur', '3s')
        el.style.position = 'relative'
        el.style.overflow = 'hidden'

        const undoBtn = document.createElement('button')
        undoBtn.className = 'toast-undo-btn'
        undoBtn.textContent = 'DESFAZER'
        undoBtn.type = 'button'

        el.innerHTML = `<span class="toast-icon">✕</span><span class="toast-msg">${msg}</span>`
        el.appendChild(undoBtn)
        container.appendChild(el)

        pendingUndo = { el, restored: false }

        undoBtn.addEventListener('click', () => {
            clearTimeout(undoTimer)
            el.classList.add('saindo')
            setTimeout(() => el.remove(), 260)
            if (!pendingUndo?.restored) {
                pendingUndo.restored = true
                onUndo()
            }
            pendingUndo = null
        })

        undoTimer = setTimeout(() => {
            el.classList.add('saindo')
            setTimeout(() => el.remove(), 260)
            pendingUndo = null
        }, 3000)
    }

    // ── Intercepta cliques em .btn-remove dentro do documento ──
    document.addEventListener('click', function(e) {
        const btn = e.target.closest('.btn-remove')
        if (!btn) return

        // Determina o alvo de remoção (tr para ataques/munições, .exp-card para cards)
        const tr   = btn.closest('tr')
        const card = btn.closest('.exp-card')
        const tag  = btn.closest('.prof-tag')

        if (tr) {
            e.stopImmediatePropagation()
            e.preventDefault()

            const tbody  = tr.parentNode
            const index  = Array.from(tbody.children).indexOf(tr)
            const clone  = tr.cloneNode(true)
            const isAtk  = !!tr.closest('#attacks-body')
            const msg    = isAtk ? 'Ataque removido' : 'Munição removida'

            tr.remove()

            mostrarToastUndo(msg, () => {
                // Restaura na mesma posição
                if (index >= tbody.children.length) {
                    tbody.appendChild(clone)
                } else {
                    tbody.insertBefore(clone, tbody.children[index])
                }
            })
            return
        }

        if (card) {
            e.stopImmediatePropagation()
            e.preventDefault()

            const lista   = card.parentNode
            const index   = Array.from(lista.children).indexOf(card)
            const clone   = card.cloneNode(true)
            const isHab   = !!card.closest('#habilidades-lista')
            const isTruq  = !!card.closest('#truques-lista')
            const msg     = isHab ? 'Habilidade removida' : isTruq ? 'Truque removido' : 'Magia removida'

            card.remove()

            mostrarToastUndo(msg, () => {
                if (index >= lista.children.length) {
                    lista.appendChild(clone)
                } else {
                    lista.insertBefore(clone, lista.children[index])
                }
            })
            return
        }

        // Tags (.prof-tag): não têm undo, mas mostra toast informativo simples
        if (tag) {
            const tagContent = tag.querySelector('span')?.textContent || 'Tag'
            // Deixa o comportamento padrão acontecer (remoção inline)
            // mas poderia adicionar undo aqui também se desejado
        }
    }, true) // capture: true para interceptar antes dos onclick inline

})()

/* ═══════════════════════════════════════════════════════════
   CLASSES AUXILIARES DE TEMA — no body
   ── Intercepta aplicarTema para adicionar/remover a classe
      body.tema-* correspondente automaticamente (ver DARK_TEMAS).
═══════════════════════════════════════════════════════════ */
;(function patchAplicarTemaDark() {

    const DARK_TEMAS = {
        'Umbra':       'tema-umbra',
        'Strahd':      'tema-strahd',
        'Bárbaro':     'tema-barbaro',
        'Bardo':       'tema-bardo',
        'Bruxo':       'tema-bruxo',
        'Clérigo':     'tema-clerigo',
        'Druida':      'tema-druida',
        'Feiticeiro':  'tema-feiticeiro',
        'Guerreiro':   'tema-guerreiro',
        'Ladino':      'tema-ladino',
        'Mago':        'tema-mago',
        'Monge':       'tema-monge',
        'Paladino':    'tema-paladino',
        'Patrulheiro': 'tema-patrulheiro',
        'Artificer':   'tema-artificer',
    }

    const _orig = window.aplicarTema
    window.aplicarTema = function(nome) {
        _orig(nome)
        // Remove todas as classes de tema escuro antes de aplicar
        Object.values(DARK_TEMAS).forEach(cls => document.body.classList.remove(cls))
        if (DARK_TEMAS[nome]) {
            document.body.classList.add(DARK_TEMAS[nome])
        }
        aplicarFamiliaEIcone(nome)
    }

    function aplicarFamiliaEIcone(nome) {
        // Remove classes de família anteriores
        ;['fam-marcial', 'fam-arcano', 'fam-divino', 'fam-furtivo'].forEach(c => document.body.classList.remove(c))
        const fam = FAMILIAS[nome]
        if (fam) document.body.classList.add('fam-' + fam)
        // Troca o ícone do cabeçalho (fallback: ✦ se tema não tiver ícone definido)
        const icone = ICONES[nome] || '✦'
        const el = document.getElementById('header-ornament-left')
        const er = document.getElementById('header-ornament-right')
        if (el) el.innerHTML = icone
        if (er) er.innerHTML = icone
    }

    // Restaura a classe ao carregar
    const _origInicializar = window.inicializarTemas
    window.inicializarTemas = function() {
        _origInicializar()
        setTimeout(() => {
            const preset = ls.get('tema-preset')
            Object.values(DARK_TEMAS).forEach(cls => document.body.classList.remove(cls))
            if (preset && DARK_TEMAS[preset]) {
                document.body.classList.add(DARK_TEMAS[preset])
            }
            // Fallback: detecta o tema pela cor --page (Umbra é o padrão)
            if (!preset) {
                const page = getComputedStyle(document.documentElement)
                    .getPropertyValue('--page').trim().toLowerCase()
                if (page === '#080305') document.body.classList.add('tema-strahd')
                else document.body.classList.add('tema-umbra')
            }
            aplicarFamiliaEIcone(preset && TEMAS[preset] ? preset : 'Umbra')
        }, 100)
    }

})()