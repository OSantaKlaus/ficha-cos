/* ============================================================
   storage-ns.js — separa os dados deste gerenciador dos de outros
   ── Todos os dados são gravados no localStorage com o prefixo
      "strahd::" (ex.: strahd::gasphar:ficha-dnd). Assim, os personagens
      de Curse of Strahd nunca aparecem no outro gerenciador e vice-versa.
   ── Expõe `appStorage`, com a mesma interface do localStorage
      (getItem, setItem, removeItem, key, length), já filtrada.
   ── Na primeira abertura do index.html, oferece trazer os
      personagens "antigos" (sem prefixo) escolhendo quais são daqui.
      Os dados antigos NÃO são apagados.
============================================================ */
(function () {
  var NS = 'strahd::'
  var OUTROS = ['umbra::']            // prefixos dos outros gerenciadores
  var NOME = 'Curse of Strahd'
  var FLAG = 'ns-migrado:' + NS        // chave crua (fora do namespace)
  var real = window.localStorage

  function chavesDoNs() {
    var out = []
    for (var i = 0; i < real.length; i++) {
      var k = real.key(i)
      if (k && k.indexOf(NS) === 0) out.push(k.slice(NS.length))
    }
    return out
  }

  window.appStorage = {
    getItem:    function (k)    { return real.getItem(NS + k) },
    setItem:    function (k, v) { return real.setItem(NS + k, v) },
    removeItem: function (k)    { return real.removeItem(NS + k) },
    key:        function (i)    { var c = chavesDoNs(); return i < c.length ? c[i] : null },
    get length() { return chavesDoNs().length },
  }

  /* ───────── Migração única dos dados antigos (só no index) ───────── */
  if (/ficha\.html$/i.test(location.pathname)) return

  function ehDeNamespace(k) {
    if (k.indexOf(NS) === 0) return true
    for (var i = 0; i < OUTROS.length; i++) if (k.indexOf(OUTROS[i]) === 0) return true
    return false
  }

  function legados() {
    var lista = []
    for (var i = 0; i < real.length; i++) {
      var k = real.key(i)
      if (!k || ehDeNamespace(k) || !/:ficha-dnd$/.test(k)) continue
      var id = k.slice(0, -':ficha-dnd'.length)
      var d = {}
      try { d = JSON.parse(real.getItem(k)) || {} } catch (e) {}
      var em = ''
      for (var j = 0; j < OUTROS.length; j++) {
        if (real.getItem(OUTROS[j] + id + ':ficha-dnd')) em = OUTROS[j].replace(/:+$/, '')
      }
      lista.push({ id: id, nome: d.nome || id, classe: d.classe || '—', nivel: d.nivel || '?', jaEm: em })
    }
    return lista
  }

  function copiar(id) {
    var pref = id + ':'
    for (var i = 0; i < real.length; i++) {
      var k = real.key(i)
      if (k && !ehDeNamespace(k) && k.indexOf(pref) === 0) real.setItem(NS + k, real.getItem(k))
    }
  }


  /* ───────── Limpeza dos dados antigos (botão "Limpar antigos") ───────── */
  // Só são apagáveis as cópias antigas de personagens que já existem em
  // algum namespace (importados aqui ou no outro gerenciador).
  function limpaveis() {
    var out = []
    for (var i = 0; i < real.length; i++) {
      var k = real.key(i)
      if (!k || ehDeNamespace(k) || !/:ficha-dnd$/.test(k)) continue
      var id = k.slice(0, -':ficha-dnd'.length)
      var seguro = !!real.getItem(NS + id + ':ficha-dnd')
      for (var j = 0; j < OUTROS.length; j++) if (real.getItem(OUTROS[j] + id + ':ficha-dnd')) seguro = true
      if (!seguro) continue
      var d = {}
      try { d = JSON.parse(real.getItem(k)) || {} } catch (e) {}
      out.push({ id: id, nome: d.nome || id })
    }
    return out
  }

  function atualizarBotao() {
    var b = document.getElementById('btn-limpar-antigos')
    if (b) b.style.display = limpaveis().length ? '' : 'none'
  }

  window.limparDadosAntigos = function () {
    var l = limpaveis()
    if (!l.length) { alert('Não há dados antigos para limpar.'); atualizarBotao(); return }
    var restantes = 0
    for (var i = 0; i < real.length; i++) {
      var k = real.key(i)
      if (k && !ehDeNamespace(k) && /:ficha-dnd$/.test(k)) restantes++
    }
    restantes -= l.length
    var msg = 'Apagar as cópias ANTIGAS (sem separação) destes personagens?\n\n• ' +
      l.map(function (p) { return p.nome }).join('\n• ') +
      '\n\nEles continuam intactos em ' + NOME + ' ou no outro gerenciador, onde já foram importados.' +
      (restantes > 0 ? '\n\n' + restantes + ' personagem(ns) antigo(s) ainda não foi/foram importado(s) em nenhum gerenciador e NÃO será/serão apagado(s).' : '') +
      '\n\nEsta ação não pode ser desfeita. Recomenda-se baixar um Backup antes. Continuar?'
    if (!confirm(msg)) return
    var apagar = []
    for (var i = 0; i < real.length; i++) {
      var k = real.key(i)
      if (!k || ehDeNamespace(k)) continue
      for (var j = 0; j < l.length; j++) if (k.indexOf(l[j].id + ':') === 0) { apagar.push(k); break }
    }
    apagar.forEach(function (k) { real.removeItem(k) })
    atualizarBotao()
    alert('Dados antigos limpos (' + l.length + ' personagem(ns)).')
  }

  function el(tag, css, texto) {
    var e = document.createElement(tag)
    if (css) e.style.cssText = css
    if (texto != null) e.textContent = texto
    return e
  }

  function abrirModal(lista) {
    var fundo = el('div', 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;')
    var caixa = el('div', 'background:#1a1a1f;color:#eee;border:1px solid #555;border-radius:10px;max-width:520px;width:100%;max-height:85vh;overflow:auto;padding:20px;font-family:sans-serif;')
    caixa.appendChild(el('h2', 'margin:0 0 8px;font-size:20px;', 'Separar personagens — ' + NOME))
    caixa.appendChild(el('p', 'margin:0 0 14px;font-size:14px;line-height:1.4;opacity:.85;',
      'Foram encontrados personagens salvos de antes da separação. Marque apenas os que pertencem à campanha ' + NOME +
      '. Nada será apagado: os dados antigos continuam guardados como segurança.'))

    var checks = []
    lista.forEach(function (p) {
      var linha = el('label', 'display:flex;gap:10px;align-items:center;padding:8px;border:1px solid #333;border-radius:6px;margin-bottom:6px;cursor:pointer;')
      var cb = el('input'); cb.type = 'checkbox'
      checks.push({ cb: cb, id: p.id })
      var info = el('div', 'flex:1;')
      info.appendChild(el('div', 'font-weight:bold;', p.nome))
      info.appendChild(el('div', 'font-size:12px;opacity:.7;', p.classe + ' · nível ' + p.nivel))
      linha.appendChild(cb); linha.appendChild(info)
      if (p.jaEm) linha.appendChild(el('span', 'font-size:11px;background:#444;border-radius:4px;padding:2px 6px;', 'já em ' + p.jaEm))
      caixa.appendChild(linha)
    })

    var barra = el('div', 'display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap;')
    function btn(txt, destaque) {
      return el('button', 'padding:8px 14px;border-radius:6px;border:1px solid #666;cursor:pointer;font-size:14px;' +
        (destaque ? 'background:#7a4cc2;color:#fff;border-color:#7a4cc2;' : 'background:transparent;color:#eee;'), txt)
    }
    var bPular = btn('Pular (começar vazio)')
    var bImp = btn('Importar marcados', true)
    bPular.onclick = function () {
      if (!confirm('Nenhum personagem antigo será trazido para ' + NOME + '. Continuar?')) return
      real.setItem(FLAG, '1'); fundo.remove()
    }
    bImp.onclick = function () {
      var marcados = checks.filter(function (c) { return c.cb.checked })
      marcados.forEach(function (c) { copiar(c.id) })
      real.setItem(FLAG, '1')
      location.reload()
    }
    barra.appendChild(bPular); barra.appendChild(bImp)
    caixa.appendChild(barra)
    fundo.appendChild(caixa)
    document.body.appendChild(fundo)
  }

  function iniciar() {
    atualizarBotao()
    if (real.getItem(FLAG)) return
    var l = legados()
    if (!l.length) { real.setItem(FLAG, '1'); return }
    abrirModal(l)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar)
  else iniciar()
})()
