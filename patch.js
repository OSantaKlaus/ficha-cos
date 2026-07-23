/* ════════════════════════════════════════════════════════════════
   PATCH v3 — Curse of Strahd Character Sheet
   Auto-Save · Undo/Redo · Expertise · Efeitos de Condição
   Rolador Avançado · Melhorias de Inicialização

   CARREGADO APÓS script.js — usa mesma cadeia de overrides
════════════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────────────
   0. CSS de expertise/undo/redo/condições/quick-roll agora vive só
      em strahd-rework.css — removida a injeção duplicada via JS.
──────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────
   1. UTILITÁRIOS
──────────────────────────────────────────────────────────────── */

function debounce(fn, delay = 800) {
    let timer
    return function (...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), delay) }
}

/* ────────────────────────────────────────────────────────────────
   2. AUTO-SAVE COM DEBOUNCE
   – Salva 800ms após cada mudança; indicador visual sutil.
   – Também faz push no undo stack.
──────────────────────────────────────────────────────────────── */

const _autoSalvarDebounced = debounce(function () {
    try {
        salvar()
        _pushUndo()
        const st = g('save-status')
        if (st) {
            st.textContent = '✦ Salvo'
            st.className = 'auto-ok'
            clearTimeout(st._timer)
            st._timer = setTimeout(() => { st.textContent = ''; st.className = '' }, 2500)
        }
    } catch (e) {
        console.warn('[auto-save]', e)
    }
}, 800)

document.addEventListener('input', e => {
    if (e.target.matches('input:not([type=file]):not([type=checkbox]), textarea, select'))
        _autoSalvarDebounced()
}, { passive: true })

document.addEventListener('change', e => {
    if (e.target.matches('input[type=checkbox], select'))
        _autoSalvarDebounced()
}, { passive: true })

// Garante que a última alteração seja salva mesmo se o jogador sair da
// página (ex: clicar em "Grupo") antes do debounce de 800ms disparar.
function _flushSalvarPendente() {
    try { salvar() } catch (e) {}
}
window.addEventListener('pagehide', _flushSalvarPendente)
window.addEventListener('beforeunload', _flushSalvarPendente)
document.getElementById('btn-voltar-grupo')?.addEventListener('click', _flushSalvarPendente)

/* ────────────────────────────────────────────────────────────────
   3. UNDO / REDO
   – Stack em memória, máx 25 estados.
   – Ctrl+Z / Ctrl+Shift+Z ou Ctrl+Y para desfazer/refazer.
   – Recarrega o conteúdo dinâmico sem reload de página.
──────────────────────────────────────────────────────────────── */

const UNDO_MAX = 25
const _undoStack = []
let _undoIdx = -1
let _undoLocked = false

function _pushUndo() {
    if (_undoLocked) return
    const estado = ls.get('ficha-dnd')
    if (!estado) return
    const ultimo = _undoStack[_undoIdx]
    if (ultimo === estado) return   // sem mudança real
    // Descarta "futuros" se estávamos no meio do histórico
    _undoStack.splice(_undoIdx + 1)
    _undoStack.push(estado)
    if (_undoStack.length > UNDO_MAX) _undoStack.shift()
    _undoIdx = _undoStack.length - 1
    _atualizarBotoesUndo()
}

function undoFicha() {
    if (_undoIdx <= 0) return
    _undoIdx--
    _aplicarEstado(_undoStack[_undoIdx])
    mostrarToast('↩ Desfeito', 'info', 1800)
}

function redoFicha() {
    if (_undoIdx >= _undoStack.length - 1) return
    _undoIdx++
    _aplicarEstado(_undoStack[_undoIdx])
    mostrarToast('↪ Refeito', 'info', 1800)
}

function _aplicarEstado(estadoJSON) {
    _undoLocked = true
    ls.set('ficha-dnd', estadoJSON)
    _limparListasDinamicas()
    try { renderSaves() } catch (e) {}
    try { renderPericias() } catch (e) {}
    try { renderSpellSlots() } catch (e) {}
    try { carregar() } catch (e) {}
    try { atualizarTudo() } catch (e) {}
    try { renderSpellSlotsUsados() } catch (e) {}
    _undoLocked = false
    _atualizarBotoesUndo()
}

function _limparListasDinamicas() {
    ;['attacks-body', 'mun-body', 'habilidades-lista', 'truques-lista',
      'spells-lista', 'linguas-tags', 'talentos-tags',
      'res-tags', 'vul-tags', 'imn-tags'].forEach(id => {
        const el = g(id); if (el) el.innerHTML = ''
    })
    ATTRS.forEach(id => g('save-dot-' + id)?.classList.remove('on'))
    // Limpa death saves (checkboxes)
    document.querySelectorAll('.death-check').forEach(cb => { cb.checked = false })
}

function _atualizarBotoesUndo() {
    const btnU = g('btn-undo')
    const btnR = g('btn-redo')
    if (btnU) btnU.disabled = _undoIdx <= 0
    if (btnR) btnR.disabled = _undoIdx >= _undoStack.length - 1
}

// Atalhos de teclado
document.addEventListener('keydown', e => {
    const ctrl = e.ctrlKey || e.metaKey
    if (!ctrl) return
    if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undoFicha() }
    if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redoFicha() }
    if (e.key === 's') { e.preventDefault(); salvar(); mostrarToast('✦ Ficha salva', 'sucesso', 2000) }
})

/* ────────────────────────────────────────────────────────────────
   4. EXPERTISE NAS PERÍCIAS
   – Toggle ◈ ao lado do checkbox quando proficiente.
   – Calcula bônus dobrado; destaque visual dourado.
   – Integrado ao salvar/carregar (sobrevive export/import).
──────────────────────────────────────────────────────────────── */

// Substituição de renderPericias com suporte a expertise
window.renderPericias = function (sp) {
    sp = sp || {}
    const lista = g('pericias-lista')
    if (!lista) return
    lista.innerHTML = PERICIAS.map(p => {
        const sid = skillId(p.nome)
        const attrCls = 'attr-' + p.attr.toLowerCase()
        const isProf = !!sp[sid]
        const isExp = isProf && ls.get('exp-' + sid) === '1'
        return `<div class="skill-item">
        <div class="skill-row" onclick="rolarPericia('${p.nome}','${sid}')" title="Clique para rolar ${p.nome}">
          <input type="checkbox" class="skill-check" id="${sid}" ${isProf ? 'checked' : ''}
            onchange="onSkillChange('${sid}')" onclick="event.stopPropagation()">
          <span class="exp-toggle-btn ${isExp ? 'exp-on' : ''} ${isProf ? '' : 'exp-oculto'}"
            id="exp-${sid}" onclick="event.stopPropagation(); toggleExpertise('${sid}')"
            title="Expertise — dobro de proficiência${isExp ? ' (ATIVO)' : ''}">◈</span>
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

function onSkillChange(sid) {
    atualizarTudo()
    const cb = g(sid)
    const expBtn = g('exp-' + sid)
    if (!expBtn) return
    if (!cb?.checked) {
        ls.del('exp-' + sid)
        expBtn.classList.remove('exp-on')
        expBtn.classList.add('exp-oculto')
    } else {
        expBtn.classList.remove('exp-oculto')
    }
}

function toggleExpertise(sid) {
    const cb = g(sid)
    if (!cb?.checked) return // sem proficiência → sem expertise
    const era = ls.get('exp-' + sid) === '1'
    if (era) ls.del('exp-' + sid); else ls.set('exp-' + sid, '1')
    const btn = g('exp-' + sid)
    if (btn) btn.classList.toggle('exp-on', !era)
    atualizarTudo()
    mostrarToast(era ? 'Expertise removida' : '◈ Expertise ativada!', 'info', 1800)
}

// Override de atualizarTudo para incluir expertise
const _atualizarTudoBase = window.atualizarTudo
window.atualizarTudo = function () {
    if (_atualizarTudoBase) _atualizarTudoBase()
    const prof = gP()
    PERICIAS.forEach(p => {
        const sid = skillId(p.nome)
        const cb = g(sid)
        const isProf = !!cb?.checked
        const isExp = isProf && ls.get('exp-' + sid) === '1'
        const b = calcMod(gA(p.attr)) + (isProf ? prof : 0) + (isExp ? prof : 0)
        const bel = g(sid + '-bonus')
        if (bel) {
            bel.textContent = fmtMod(b)
            bel.classList.toggle('expertise-bonus', isExp)
        }
    })
    // Sabedoria passiva com expertise em Percepção
    const percId = skillId('Percepção')
    const isPercProf = !!g(percId)?.checked
    const isPercExp = isPercProf && ls.get('exp-' + percId) === '1'
    const profVal = gP()
    const spEl = g('sab-passiva')
    if (spEl) spEl.value = 10 + calcMod(gA('sab')) + (isPercProf ? profVal : 0) + (isPercExp ? profVal : 0)
}

// Integrar expertise no salvar / carregar
const _salvarPreExp = window.salvar
window.salvar = function () {
    if (_salvarPreExp) _salvarPreExp()
    const raw = ls.get('ficha-dnd')
    if (!raw) return
    try {
        const d = JSON.parse(raw)
        const expertise = {}
        PERICIAS.forEach(p => {
            const sid = skillId(p.nome)
            if (ls.get('exp-' + sid) === '1') expertise[sid] = true
        })
        d.expertise = expertise
        ls.set('ficha-dnd', JSON.stringify(d))
    } catch (e) { console.warn('[salvar expertise]', e) }
}

const _carregarPreExp = window.carregar
window.carregar = function () {
    if (_carregarPreExp) _carregarPreExp()
    const raw = ls.get('ficha-dnd')
    if (!raw) return
    try {
        const d = JSON.parse(raw)
        if (!d.expertise) return
        PERICIAS.forEach(p => {
            const sid = skillId(p.nome)
            if (d.expertise[sid]) ls.set('exp-' + sid, '1')
            else ls.del('exp-' + sid)
        })
        // Atualiza visual dos botões de expertise
        PERICIAS.forEach(p => {
            const sid = skillId(p.nome)
            const cb = g(sid)
            const isExp = ls.get('exp-' + sid) === '1'
            const btn = g('exp-' + sid)
            if (!btn) return
            if (!cb?.checked) {
                btn.classList.add('exp-oculto')
            } else {
                btn.classList.remove('exp-oculto')
                btn.classList.toggle('exp-on', isExp)
            }
        })
    } catch (e) { console.warn('[carregar expertise]', e) }
}

/* ────────────────────────────────────────────────────────────────
   5. CONDIÇÕES COM EFEITOS D&D 5e
   – Substituição de CONDICOES com descrições mecânicas completas.
   – Popup de efeitos ao hover no botão da condição.
──────────────────────────────────────────────────────────────── */

// Redefine CONDICOES com efeitos detalhados
if (typeof CONDICOES !== 'undefined') {
    const CONDICOES_EFEITOS = {
        amedrontado: [
            'Desvantagem em testes de habilidade e jogadas de ataque enquanto a fonte do medo estiver no campo de visão.',
            'Não pode se mover voluntariamente em direção à fonte do medo.'
        ],
        cego: [
            'Não pode enxergar; falha automaticamente em testes que exigem visão.',
            'Desvantagem em jogadas de ataque.',
            'Ataques contra esta criatura têm Vantagem.'
        ],
        encantado: [
            'Não pode atacar ou alvejar o encantador com poderes prejudiciais.',
            'O encantador tem vantagem em testes de habilidade social contra esta criatura.'
        ],
        ensurdecido: [
            'Não pode ouvir; falha automaticamente em testes que exigem audição.',
            'Imune a efeitos que dependem de som.'
        ],
        envenenado: [
            'Desvantagem em jogadas de ataque.',
            'Desvantagem em testes de habilidade.'
        ],
        exausto: [
            '<strong>Nível 1:</strong> Desvantagem em testes de habilidade.',
            '<strong>Nível 2:</strong> Velocidade reduzida à metade.',
            '<strong>Nível 3:</strong> Desvantagem em jogadas de ataque e saves.',
            '<strong>Nível 4:</strong> Máximo de PV reduzido à metade.',
            '<strong>Nível 5:</strong> Velocidade reduzida a 0.',
            '<strong>Nível 6:</strong> Morte.'
        ],
        incapacitado: [
            'Não pode executar ações nem reações.'
        ],
        invisivel: [
            '<span class="cond-positiva-label">✦ Vantagem</span> em jogadas de ataque.',
            'Ataques contra esta criatura têm Desvantagem.',
            'Considerado oculto para efeitos de furtividade.'
        ],
        paralisado: [
            'Incapacitado; não pode se mover ou falar.',
            'Falha automaticamente em saves de Força e Destreza.',
            'Ataques contra esta criatura têm Vantagem.',
            'Ataques que acertam a menos de 1,5m são críticos automáticos.'
        ],
        petrificado: [
            'Transformado em pedra; incapacitado.',
            'Não pode se mover ou falar; inconsciente dos arredores.',
            'Ataques têm Vantagem; falha automaticamente em saves Força e Destreza.',
            'Resistência a todos os danos; imune a veneno e doença.'
        ],
        prostrado: [
            'Só pode rastejar (velocidade 0 em pé).',
            'Desvantagem em jogadas de ataque.',
            'Ataques corpo a corpo contra esta criatura têm Vantagem.',
            'Ataques à distância contra esta criatura têm Desvantagem.'
        ],
        preso: [
            'Velocidade reduzida a 0.',
            'Desvantagem em jogadas de ataque.',
            'Ataques contra esta criatura têm Vantagem.',
            'Desvantagem em saves de Destreza.'
        ],
        inconsciente: [
            'Incapacitado; cai prostrado.',
            'Falha automaticamente em saves de Força e Destreza.',
            'Ataques têm Vantagem; críticos automáticos a menos de 1,5m.'
        ],
    }

    // Adiciona campo de efeitos a cada condição
    CONDICOES.forEach(c => { c.efeitos = CONDICOES_EFEITOS[c.id] || [] })
}

// Popup singleton para efeitos
let _condPopup = null
function _getCondPopup() {
    if (_condPopup) return _condPopup
    _condPopup = document.createElement('div')
    _condPopup.className = 'cond-efeito-popup'
    document.body.appendChild(_condPopup)
    return _condPopup
}

function mostrarEfeitoCondicao(id, anchor) {
    if (typeof CONDICOES === 'undefined') return
    const cond = CONDICOES.find(c => c.id === id)
    if (!cond || !cond.efeitos?.length) return
    const popup = _getCondPopup()
    popup.innerHTML = `<strong>${cond.emoji} ${cond.label}</strong>
      <ul>${cond.efeitos.map(e => `<li>${e}</li>`).join('')}</ul>`
    const rect = anchor.getBoundingClientRect()
    popup.style.left = Math.min(rect.left, window.innerWidth - 295) + 'px'
    popup.style.top = (rect.bottom + 6) + 'px'
    popup.classList.add('visivel')
}

function ocultarEfeitoCondicao() {
    _condPopup?.classList.remove('visivel')
}

// Override de renderCondicoes com efeitos
const _renderCondicoesBase = window.renderCondicoes
window.renderCondicoes = function () {
    const grid = g('condicoes-grid')
    if (!grid || typeof CONDICOES === 'undefined' || typeof condicoesAtivas === 'undefined') {
        if (_renderCondicoesBase) _renderCondicoesBase()
        return
    }
    grid.innerHTML = CONDICOES.map(c => `
        <button class="cond-btn ${condicoesAtivas.has(c.id) ? 'ativa' + (c.positiva ? ' cond-positiva' : '') : ''}"
            onclick="toggleCondicao('${c.id}')"
            onmouseenter="mostrarEfeitoCondicao('${c.id}', this)"
            onmouseleave="ocultarEfeitoCondicao()"
            title="${c.label}">
            ${c.emoji} ${c.label}
        </button>`).join('')
}

/* ────────────────────────────────────────────────────────────────
   6. ROLADOR AVANÇADO — Quick Roll por expressão
   – Input "/r 2d6+3 adv" no painel de dados.
   – Suporta: NdX, +/-mod, adv/vantagem, desv/desvantagem, crítico.
──────────────────────────────────────────────────────────────── */

function parseDiceExprAvancado(expr) {
    expr = expr.trim().toLowerCase().replace(/^\/r\s*/, '')

    // Detecta vantagem/desvantagem
    let vant = 0
    if (/\b(adv|vantagem|v)\b/.test(expr)) { vant = 1; expr = expr.replace(/\b(adv|vantagem|v)\b/, '').trim() }
    if (/\b(desv|desvantagem|d)\b/.test(expr)) { vant = -1; expr = expr.replace(/\b(desv|desvantagem|d)\b/, '').trim() }

    // Tenta fazer parse como XdY+Z
    const match = expr.match(/^(\d+)?d(\d+)([+-]\d+)?$/)
    if (!match) return null

    const count = parseInt(match[1] || '1')
    const sides = parseInt(match[2])
    const bonus = parseInt(match[3] || '0')

    return { count, sides, bonus, vant }
}

function rolarExpressaoAvancada(exprStr) {
    const parsed = parseDiceExprAvancado(exprStr)
    if (!parsed) {
        mostrarToast('Expressão inválida. Ex: 2d6+3, 1d20 adv', 'erro', 2500)
        return
    }

    const { count, sides, bonus, vant } = parsed
    let total, detalhes, expressao, isCrit = false, isFalha = false

    if (vant !== 0 && sides === 20 && count === 1) {
        const r1 = Math.floor(Math.random() * 20) + 1
        const r2 = Math.floor(Math.random() * 20) + 1
        const escolhido = vant === 1 ? Math.max(r1, r2) : Math.min(r1, r2)
        total = escolhido + bonus
        isCrit  = escolhido === 20
        isFalha = escolhido === 1
        const sinal = bonus > 0 ? '+' + bonus : bonus < 0 ? bonus : ''
        detalhes  = `[${r1}, ${r2}] ${vant === 1 ? '↑vant' : '↓desv'}${sinal}`
        expressao = `d20 ${vant === 1 ? 'vantagem' : 'desvantagem'}${sinal}`
    } else {
        const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
        const soma  = rolls.reduce((a, b) => a + b, 0) + bonus
        total = soma
        const sinal = bonus > 0 ? '+' + bonus : bonus < 0 ? bonus : ''
        detalhes  = `[${rolls.join(', ')}]${sinal}`
        expressao = `${count}d${sides}${sinal}`
        if (sides === 20 && count === 1) { isCrit = rolls[0] === 20; isFalha = rolls[0] === 1 }
    }

    mostrarResultadoDado(total, detalhes, expressao, isCrit, isFalha)
    adicionarHistorico(expressao, total, detalhes, isCrit, isFalha)
}

// Injeta o campo de quick-roll no painel de dados após inicialização
function _injetarQuickRoll() {
    const scroll = document.querySelector('.dados-scroll')
    if (!scroll || g('dados-quick-roll')) return
    const wrap = document.createElement('div')
    wrap.className = 'dados-quick-input-wrap'
    wrap.id = 'dados-quick-roll'
    wrap.innerHTML = `
        <input class="dados-quick-input" id="dados-expr-input"
            placeholder="/r 2d6+3 adv" title="Expressão de dado: XdY+Z [adv/desv]">
        <button class="dados-quick-btn" onclick="_rolarExprInput()" title="Rolar expressão">⚄ ROLAR</button>`
    scroll.appendChild(wrap)

    g('dados-expr-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') _rolarExprInput()
    })
}

function _rolarExprInput() {
    const inp = g('dados-expr-input')
    if (!inp?.value.trim()) return
    rolarExpressaoAvancada(inp.value.trim())
    inp.value = ''
    inp.focus()
}

// Hook usarModNoRolador para suportar expressões do contexto
window.usarModNoRolador = function(bonus, label) {
    const modEl = document.getElementById('dados-mod-input')
    if (modEl) modEl.value = bonus
    const painelDados = document.getElementById('dados-panel')
    if (painelDados && !painelDados.classList.contains('open')) toggleDados()
    if (label) {
        const lbl = document.getElementById('dados-res-label')
        if (lbl) lbl.textContent = label
    }
    mostrarToast(`Mod ${fmtMod(bonus)} carregado no rolador`, 'info', 1800)
}

/* ────────────────────────────────────────────────────────────────
   7. INICIALIZAÇÃO ROBUSTA
   – Garante que quick-stats, condições e undo recebem estado inicial.
   – Corrige a cadeia de inicialização após todos os overrides.
──────────────────────────────────────────────────────────────── */

window.addEventListener('load', function _patchInit() {
    // Pequeno delay para garantir que script.js terminou de inicializar
    setTimeout(() => {
        // Estado inicial no undo stack
        try {
            const estadoInicial = ls.get('ficha-dnd')
            if (estadoInicial && _undoStack.length === 0) {
                _undoStack.push(estadoInicial)
                _undoIdx = 0
            }
            _atualizarBotoesUndo()
        } catch (e) {}

        // Quick roll no painel de dados
        try { _injetarQuickRoll() } catch (e) {}

        // Garante renderCondicoes com efeitos
        try {
            if (typeof renderCondicoes === 'function') renderCondicoes()
        } catch (e) {}

        // Botões de undo/redo: inicializa estado
        _atualizarBotoesUndo()

    }, 400)
}, { once: true })

/* ────────────────────────────────────────────────────────────────
   8. EXPORT/IMPORT MELHORADO — preview antes de importar
──────────────────────────────────────────────────────────────── */

const _importarBase = window.importarFicha
window.importarFicha = function (event) {
    const file = event.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
        try {
            const dados = JSON.parse(e.target.result)
            const nome   = dados.nome      || 'Personagem desconhecido'
            const classe = dados.classe    || '?'
            const nivel  = dados.nivel     || '?'
            const raca   = dados.raca      || '?'
            const preview = `Importar ficha?\n\n👤 ${nome}\n⚔ ${classe} — Nível ${nivel}\n🌿 ${raca}\n\nIsso vai substituir todos os dados atuais.`
            if (!confirm(preview)) { event.target.value = ''; return }
            // Salva estado atual como undo antes de importar
            salvar(); _pushUndo()
            ls.set('ficha-dnd', JSON.stringify(dados))
            mostrarToast('✦ Importando...', 'sucesso', 1500)
            setTimeout(() => window.location.reload(), 700)
        } catch (err) {
            alert('Arquivo inválido: ' + err.message)
            event.target.value = ''
        }
    }
    reader.readAsText(file)
}
