import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'

// ─── constantes ───────────────────────────────────────────────
const GRUPO_LABELS = {
  pessoal: '👤 Pessoal',
  casa: '🏠 Casa',
  colecao: '🎵 Coleção / CEG',
  receita_grp: '💰 Receita',
}
const GRUPO_COLORS = {
  pessoal: '#378ADD',
  casa: '#1D9E75',
  colecao: '#D4537E',
  receita_grp: '#BA7517',
}
const DEFAULT_CATS = {
  pessoal: ['Alimentação','Saúde','Transporte','Lazer','Roupas','Beleza','Educação','Assinaturas','Outros pessoal'],
  casa: ['Aluguel','Condomínio','Luz','Água','Gás','Internet','Mercado','Limpeza','Manutenção','Outros casa'],
  colecao: ['Álbuns K-pop','Photocards','Merchandise','SKZOO','Frete CEG','Taxa importação','Compra grupo','Outros coleção'],
  receita_grp: ['Salário','Freelance','Marketing','CEG/Revenda','3D Printing','Pix recebido','Outros receita'],
}

const fmtBRL = v =>
  'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const monthStr = (m, y) =>
  new Date(y, m, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())

const today = () => new Date().toISOString().split('T')[0]

// ─── hook: lançamentos ────────────────────────────────────────
function useFinanceiro() {
  const [entries, setEntries] = useState([])
  const [metas, setMetas] = useState({})
  const [cats, setCats] = useState(DEFAULT_CATS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: ent }, { data: met }, { data: cat }] = await Promise.all([
        supabase.from('lancamentos').select('*').order('data', { ascending: false }),
        supabase.from('metas').select('*'),
        supabase.from('categorias').select('*'),
      ])
      if (ent) setEntries(ent)
      if (met) {
        const m = {}; met.forEach(r => { m[r.grupo] = r.valor }); setMetas(m)
      }
      if (cat && cat.length) {
        const c = {}
        cat.forEach(r => { if (!c[r.grupo]) c[r.grupo] = []; c[r.grupo].push(r.nome) })
        setCats(c)
      }
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const addEntry = async (entry) => {
    const { data, error: err } = await supabase.from('lancamentos').insert([entry]).select().single()
    if (err) throw err
    setEntries(prev => [data, ...prev])
    return data
  }

  const deleteEntry = async (id) => {
    await supabase.from('lancamentos').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const saveMeta = async (grupo, valor) => {
    await supabase.from('metas').upsert({ grupo, valor }, { onConflict: 'grupo' })
    setMetas(prev => ({ ...prev, [grupo]: valor }))
  }

  const addCat = async (grupo, nome) => {
    await supabase.from('categorias').insert([{ grupo, nome }])
    setCats(prev => ({ ...prev, [grupo]: [...(prev[grupo] || []), nome] }))
  }

  const removeCat = async (grupo, nome) => {
    await supabase.from('categorias').delete().eq('grupo', grupo).eq('nome', nome)
    setCats(prev => ({ ...prev, [grupo]: prev[grupo].filter(c => c !== nome) }))
  }

  return { entries, metas, cats, loading, error, addEntry, deleteEntry, saveMeta, addCat, removeCat, reload: load }
}

// ─── componentes menores ──────────────────────────────────────
function Toast({ msg }) {
  if (!msg) return null
  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, background: '#1D9E75',
      color: '#fff', padding: '8px 18px', borderRadius: 6, fontSize: 13, zIndex: 999,
    }}>{msg}</div>
  )
}

function MetricCard({ label, value, color }) {
  return (
    <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '1rem' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 500, color: color || 'var(--text)' }}>{value}</div>
    </div>
  )
}

// ─── aba dashboard ────────────────────────────────────────────
function Dashboard({ entries, metas, cats }) {
  const [month, setMonth] = useState(new Date().getMonth())
  const [year, setYear] = useState(new Date().getFullYear())

  const chMonth = d => {
    let m = month + d, y = year
    if (m > 11) { m = 0; y++ }
    if (m < 0) { m = 11; y-- }
    setMonth(m); setYear(y)
  }

  const me = entries.filter(e => {
    const d = new Date(e.data + 'T12:00:00')
    return d.getMonth() === month && d.getFullYear() === year
  })

  const rec = me.filter(e => e.tipo === 'receita').reduce((s, e) => s + Number(e.valor), 0)
  const desp = me.filter(e => e.tipo === 'despesa').reduce((s, e) => s + Number(e.valor), 0)
  const saldo = rec - desp
  const col = me.filter(e => e.grupo === 'colecao' && e.tipo === 'despesa').reduce((s, e) => s + Number(e.valor), 0)

  const catTotals = {}
  me.filter(e => e.tipo === 'despesa').forEach(e => { catTotals[e.cat] = (catTotals[e.cat] || 0) + Number(e.valor) })
  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 7)
  const max = sorted[0]?.[1] || 1

  const grupoOf = c => { for (const [g, arr] of Object.entries(cats)) if (arr.includes(c)) return g; return 'pessoal' }

  return (
    <div>
      {/* nav mês */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem' }}>
        <button className="btn-sm" onClick={() => chMonth(-1)}>‹</button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 500 }}>{monthStr(month, year)}</span>
        <button className="btn-sm" onClick={() => chMonth(1)}>›</button>
      </div>

      {/* métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: '1.25rem' }}>
        <MetricCard label="Entradas" value={fmtBRL(rec)} color="var(--green)" />
        <MetricCard label="Saídas" value={fmtBRL(desp)} color="var(--red)" />
        <MetricCard label="Saldo" value={(saldo < 0 ? '-' : '') + fmtBRL(Math.abs(saldo))} color={saldo >= 0 ? 'var(--green)' : 'var(--red)'} />
        <MetricCard label="Coleção" value={fmtBRL(col)} color="var(--amber)" />
      </div>

      {/* gráfico categorias */}
      <div className="card">
        <div className="card-title">Gastos por categoria</div>
        {sorted.length ? sorted.map(([c, v]) => (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12 }}>
            <div style={{ width: 90, textAlign: 'right', color: 'var(--muted)', flexShrink: 0 }}>{c}</div>
            <div style={{ flex: 1, height: 12, background: 'var(--bg3)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(v / max * 100)}%`, height: '100%', background: GRUPO_COLORS[grupoOf(c)] || '#888', borderRadius: 6 }} />
            </div>
            <div style={{ minWidth: 65, fontSize: 11, color: 'var(--muted)' }}>{fmtBRL(v)}</div>
          </div>
        )) : <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--muted)', fontSize: 13 }}>Nenhuma despesa neste mês</div>}
      </div>

      {/* últimos lançamentos */}
      <div className="card">
        <div className="card-title">Últimos lançamentos</div>
        {me.slice(0, 6).length ? me.slice(0, 6).map(e => (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: e.tipo === 'receita' ? 'var(--green)' : 'var(--red)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>{e.descricao}</div>
            <div style={{ fontSize: 11, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '2px 7px', color: 'var(--muted)' }}>{e.cat}</div>
            <div style={{ fontWeight: 500, color: e.tipo === 'receita' ? 'var(--green)' : 'var(--red)', minWidth: 75, textAlign: 'right' }}>
              {e.tipo === 'receita' ? '+' : '-'}{fmtBRL(e.valor)}
            </div>
          </div>
        )) : <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--muted)', fontSize: 13 }}>Nenhum lançamento neste mês</div>}
      </div>
    </div>
  )
}

// ─── aba lançar ───────────────────────────────────────────────
function Lancar({ cats, addEntry, toast }) {
  const [tipo, setTipo] = useState('despesa')
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState(today())
  const [grupo, setGrupo] = useState('pessoal')
  const [cat, setCat] = useState('')
  const [obs, setObs] = useState('')
  const [loading, setLoading] = useState(false)

  const grupos = tipo === 'receita' ? ['receita_grp'] : ['pessoal', 'casa', 'colecao']
  const catOpts = cats[grupo] || []

  const handleTipo = v => { setTipo(v); setGrupo(v === 'receita' ? 'receita_grp' : 'pessoal') }
  const handleGrupo = v => { setGrupo(v); setCat('') }

  const submit = async () => {
    if (!valor || !descricao || !data) { alert('Preencha valor, descrição e data.'); return }
    setLoading(true)
    try {
      await addEntry({ tipo, valor: parseFloat(valor), descricao, data, grupo, cat: cat || catOpts[0] || '', obs })
      setValor(''); setDesc(''); setObs('')
      toast('Lançamento adicionado!')
    } catch (e) { alert('Erro: ' + e.message) }
    setLoading(false)
  }

  return (
    <div className="card">
      <div className="card-title">Novo lançamento</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Tipo</label>
          <select value={tipo} onChange={e => handleTipo(e.target.value)}>
            <option value="despesa">💸 Despesa</option>
            <option value="receita">💰 Receita</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Valor (R$)</label>
          <input type="number" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" min="0" step="0.01" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Descrição</label>
          <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Mercado, Salário..." />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Data</label>
          <input type="date" value={data} onChange={e => setData(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Grupo</label>
          <select value={grupo} onChange={e => handleGrupo(e.target.value)}>
            {grupos.map(g => <option key={g} value={g}>{GRUPO_LABELS[g]}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Categoria</label>
          <select value={cat} onChange={e => setCat(e.target.value)}>
            {catOpts.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Observação</label>
        <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Detalhe opcional..." />
      </div>
      <button className="btn-primary" style={{ width: '100%' }} onClick={submit} disabled={loading}>
        {loading ? 'Salvando...' : '+ Adicionar lançamento'}
      </button>
    </div>
  )
}

// ─── aba ia / fatura ──────────────────────────────────────────
function IAFatura({ cats, addEntry, toast }) {
  const [imgB64, setImgB64] = useState(null)
  const [imgType, setImgType] = useState(null)
  const [imgPreview, setImgPreview] = useState(null)
  const [textInput, setTextInput] = useState('')
  const [status, setStatus] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState([])
  const [loading, setLoading] = useState(false)

  const handleFile = file => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      const b64 = e.target.result.split(',')[1]
      setImgB64(b64); setImgType(file.type)
      if (file.type.startsWith('image/')) setImgPreview(e.target.result)
      else setImgPreview(null)
    }
    reader.readAsDataURL(file)
  }

  const clear = () => { setImgB64(null); setImgType(null); setImgPreview(null); setTextInput(''); setStatus(''); setResults([]); setSelected([]) }

  const runIA = async () => {
    if (!imgB64 && !textInput.trim()) { alert('Anexe uma imagem ou cole o texto da fatura.'); return }
    setLoading(true); setStatus('Analisando documento...'); setResults([])
    const catList = Object.entries(cats).map(([g, arr]) => `${g}: ${arr.join(', ')}`).join('\n')
    const prompt = `Você é um assistente de controle financeiro. Analise o documento financeiro e extraia TODOS os lançamentos encontrados.

Grupos disponíveis: pessoal, casa, colecao, receita_grp
Categorias:
${catList}

Para despesas: grupo pessoal, casa ou colecao. Para entradas: grupo receita_grp, tipo="receita".
Data de hoje: ${today()}. Se não tiver ano no doc, use o atual.

Retorne APENAS JSON puro sem markdown:
{"lancamentos":[{"descricao":"..."","valor":0.00,"tipo":"despesa","grupo":"pessoal","cat":"Alimentação","data":"YYYY-MM-DD","obs":""}]}
${textInput ? '\nTexto:\n' + textInput : ''}`

    try {
      const msgs = [{
        role: 'user',
        content: imgB64
          ? [{ type: 'image', source: { type: 'base64', media_type: imgType, data: imgB64 } }, { type: 'text', text: prompt }]
          : [{ type: 'text', text: prompt }]
      }]
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, messages: msgs }),
      })
      const data = await resp.json()
      const raw = data.content?.map(b => b.text || '').join('').trim()
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
      const items = parsed.lancamentos || []
      if (!items.length) { setStatus('Nenhum lançamento identificado.'); setLoading(false); return }
      setResults(items)
      setSelected(items.map((_, i) => i))
      setStatus(`${items.length} lançamento${items.length > 1 ? 's' : ''} encontrado${items.length > 1 ? 's' : ''}. Confirme os que deseja importar:`)
    } catch (e) { setStatus('Erro: ' + e.message) }
    setLoading(false)
  }

  const importSelected = async () => {
    let count = 0
    for (const i of selected) {
      try { await addEntry(results[i]); count++ } catch {}
    }
    toast(`${count} lançamento${count > 1 ? 's' : ''} importado${count > 1 ? 's' : ''}!`)
    clear()
  }

  return (
    <div className="card">
      <div className="card-title">✦ Leitura automática por IA</div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: '1rem' }}>
        Anexe foto de fatura, extrato, comprovante ou print de app. A IA identifica os lançamentos automaticamente.
      </p>

      {/* drop zone */}
      <label style={{
        display: 'block', border: '1.5px dashed var(--border2)', borderRadius: 'var(--radius-lg)',
        padding: '1.75rem', textAlign: 'center', cursor: 'pointer', color: 'var(--muted)', fontSize: 13,
        transition: 'border-color .2s',
      }}>
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
        <div style={{ fontSize: 24, marginBottom: 6 }}>↑</div>
        Clique ou arraste aqui<br />
        <span style={{ fontSize: 11 }}>JPG, PNG • fatura, extrato, print de app bancário</span>
      </label>

      {imgPreview && <img src={imgPreview} alt="preview" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 'var(--radius)', marginTop: 8, objectFit: 'contain' }} />}

      <div style={{ marginTop: '1rem' }}>
        <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Ou cole o texto da fatura / extrato:</label>
        <textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="Cole aqui texto de PDF, e-mail ou extrato..." style={{ minHeight: 80 }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="btn-primary" style={{ flex: 1 }} onClick={runIA} disabled={loading}>
          {loading ? 'Analisando...' : '✦ Analisar com IA'}
        </button>
        <button className="btn-outline" onClick={clear}>Limpar</button>
      </div>

      {status && <div style={{ marginTop: 12, fontSize: 13, color: results.length ? 'var(--green)' : 'var(--muted)' }}>{status}</div>}

      {results.length > 0 && (
        <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '.875rem', marginTop: '.875rem' }}>
          {results.map((it, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              <input type="checkbox" checked={selected.includes(i)} onChange={e => setSelected(prev => e.target.checked ? [...prev, i] : prev.filter(x => x !== i))} style={{ accentColor: 'var(--accent)', width: 16, height: 16, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div>{it.descricao}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{it.cat} · {it.data}{it.obs ? ' · ' + it.obs : ''}</div>
              </div>
              <div style={{ fontWeight: 500, color: it.tipo === 'receita' ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
                {it.tipo === 'receita' ? '+' : '-'}{fmtBRL(it.valor)}
              </div>
            </div>
          ))}
          <button className="btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={importSelected}>
            Importar selecionados ({selected.length})
          </button>
        </div>
      )}
    </div>
  )
}

// ─── aba metas ────────────────────────────────────────────────
function Metas({ entries, metas, saveMeta }) {
  const [vals, setVals] = useState({})
  const [msg, setMsg] = useState('')

  useEffect(() => { setVals(Object.fromEntries(Object.entries(metas).map(([k, v]) => [k, v]))) }, [metas])

  const now = new Date()
  const me = entries.filter(e => {
    const d = new Date(e.data + 'T12:00:00')
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  const save = async () => {
    for (const [g, v] of Object.entries(vals)) {
      if (v && !isNaN(v)) await saveMeta(g, parseFloat(v))
    }
    setMsg('Metas salvas!')
    setTimeout(() => setMsg(''), 2000)
  }

  const grupos = ['pessoal', 'casa', 'colecao']

  return (
    <div>
      <div className="card">
        <div className="card-title">Orçamento mensal por grupo</div>
        {grupos.map(g => (
          <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <label style={{ width: 140, fontSize: 13, color: 'var(--text)', flexShrink: 0 }}>{GRUPO_LABELS[g]}</label>
            <input type="number" value={vals[g] || ''} onChange={e => setVals(p => ({ ...p, [g]: e.target.value }))} placeholder="R$ orçamento" min="0" />
          </div>
        ))}
        <button className="btn-primary" onClick={save}>Salvar metas</button>
        {msg && <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--green)' }}>{msg}</span>}
      </div>

      <div className="card">
        <div className="card-title">Progresso — {monthStr(now.getMonth(), now.getFullYear())}</div>
        {Object.keys(metas).filter(g => grupos.includes(g)).length ? Object.keys(metas).filter(g => grupos.includes(g)).map(g => {
          const gasto = me.filter(e => e.grupo === g && e.tipo === 'despesa').reduce((s, e) => s + Number(e.valor), 0)
          const pct = Math.min(Math.round(gasto / metas[g] * 100), 100)
          const over = gasto > metas[g]
          return (
            <div key={g} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{GRUPO_LABELS[g]}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtBRL(gasto)} / {fmtBRL(metas[g])} ({pct}%)</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, marginTop: 5, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: over ? 'var(--red)' : GRUPO_COLORS[g], borderRadius: 3 }} />
              </div>
              {over && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 2 }}>⚠ Acima em {fmtBRL(gasto - metas[g])}</div>}
            </div>
          )
        }) : <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--muted)', fontSize: 13 }}>Defina metas acima</div>}
      </div>
    </div>
  )
}

// ─── aba histórico ────────────────────────────────────────────
function Historico({ entries, deleteEntry, toast }) {
  const [filter, setFilter] = useState('todos')
  const filters = [
    { k: 'todos', l: 'Todos' }, { k: 'receita', l: 'Receitas' }, { k: 'despesa', l: 'Despesas' },
    { k: 'pessoal', l: 'Pessoal' }, { k: 'casa', l: 'Casa' }, { k: 'colecao', l: 'Coleção' },
  ]
  let list = entries
  if (filter === 'receita') list = list.filter(e => e.tipo === 'receita')
  else if (filter === 'despesa') list = list.filter(e => e.tipo === 'despesa')
  else if (['pessoal', 'casa', 'colecao'].includes(filter)) list = list.filter(e => e.grupo === filter)

  const del = async id => {
    if (!confirm('Excluir este lançamento?')) return
    await deleteEntry(id)
    toast('Removido.')
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
        {filters.map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)} style={{
            padding: '3px 10px', borderRadius: 10, fontSize: 11, cursor: 'pointer',
            border: '1px solid var(--border2)', fontFamily: 'var(--font-mono)',
            background: filter === f.k ? 'var(--accent)' : 'transparent',
            color: filter === f.k ? '#fff' : 'var(--muted)',
          }}>{f.l}</button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{list.length} lançamento{list.length !== 1 ? 's' : ''}</div>
      {list.length ? list.map(e => (
        <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 5, fontSize: 12, flexWrap: 'wrap' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: e.tipo === 'receita' ? 'var(--green)' : 'var(--red)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 80 }}>
            <div>{e.descricao}</div>
            {e.obs && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{e.obs}</div>}
          </div>
          <div style={{ fontSize: 11, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '2px 7px', color: 'var(--muted)' }}>{e.cat}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{new Date(e.data + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
          <div style={{ fontWeight: 500, color: e.tipo === 'receita' ? 'var(--green)' : 'var(--red)', minWidth: 75, textAlign: 'right' }}>
            {e.tipo === 'receita' ? '+' : '-'}{fmtBRL(e.valor)}
          </div>
          <button className="btn-sm btn-danger" onClick={() => del(e.id)}>✕</button>
        </div>
      )) : <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--muted)', fontSize: 13 }}>Nenhum lançamento encontrado</div>}
    </div>
  )
}

// ─── aba config ───────────────────────────────────────────────
function Config({ cats, addCat, removeCat }) {
  const [newCat, setNewCat] = useState({})

  const handleAdd = async g => {
    const v = (newCat[g] || '').trim()
    if (!v) return
    await addCat(g, v)
    setNewCat(p => ({ ...p, [g]: '' }))
  }

  return (
    <div className="card">
      <div className="card-title">Grupos e categorias</div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: '1rem' }}>Adicione ou remova categorias conforme sua necessidade.</p>
      {Object.entries(cats).map(([g, arr]) => (
        <div key={g} style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{GRUPO_LABELS[g] || g}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {arr.map(c => (
              <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, padding: '3px 10px', fontSize: 12 }}>
                {c}
                <button onClick={() => removeCat(g, c)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, padding: 0 }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={newCat[g] || ''} onChange={e => setNewCat(p => ({ ...p, [g]: e.target.value }))} placeholder="Nova categoria..." style={{ flex: 1, fontSize: 12 }} onKeyDown={e => e.key === 'Enter' && handleAdd(g)} />
            <button className="btn-sm" onClick={() => handleAdd(g)}>+ Adicionar</button>
          </div>
          {g !== 'receita_grp' && <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginTop: '1rem' }} />}
        </div>
      ))}
    </div>
  )
}

// ─── App principal ────────────────────────────────────────────
const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'lancar', label: 'Lançar' },
  { id: 'ia', label: '✦ IA' },
  { id: 'metas', label: 'Metas' },
  { id: 'historico', label: 'Histórico' },
  { id: 'config', label: 'Config' },
]

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [toastMsg, setToastMsg] = useState('')
  const { entries, metas, cats, loading, error, addEntry, deleteEntry, saveMeta, addCat, removeCat } = useFinanceiro()

  const toast = msg => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 2500) }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--muted)', fontSize: 13 }}>
      carregando...
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 8 }}>
      <div style={{ color: 'var(--red)', fontSize: 13 }}>Erro ao conectar com o Supabase:</div>
      <div style={{ color: 'var(--muted)', fontSize: 12 }}>{error}</div>
      <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 8 }}>Verifique seu arquivo .env</div>
    </div>
  )

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 1rem 4rem' }}>
      {/* header */}
      <div style={{ padding: '1.5rem 0 1rem', borderBottom: '1px solid var(--border)', marginBottom: '1.25rem' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, letterSpacing: '.04em', color: 'var(--accent)' }}>NANDAVERSE</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>controle financeiro pessoal</div>
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '7px 14px', fontSize: 12, cursor: 'pointer', border: 'none', fontFamily: 'var(--font-mono)',
            background: 'none', borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === t.id ? 'var(--text)' : 'var(--muted)', marginBottom: -1, whiteSpace: 'nowrap',
            fontWeight: tab === t.id ? 500 : 400,
          }}>{t.label}</button>
        ))}
      </div>

      {/* conteúdo */}
      {tab === 'dashboard' && <Dashboard entries={entries} metas={metas} cats={cats} />}
      {tab === 'lancar'    && <Lancar cats={cats} addEntry={addEntry} toast={toast} />}
      {tab === 'ia'        && <IAFatura cats={cats} addEntry={addEntry} toast={toast} />}
      {tab === 'metas'     && <Metas entries={entries} metas={metas} saveMeta={saveMeta} />}
      {tab === 'historico' && <Historico entries={entries} deleteEntry={deleteEntry} toast={toast} />}
      {tab === 'config'    && <Config cats={cats} addCat={addCat} removeCat={removeCat} />}

      <Toast msg={toastMsg} />
    </div>
  )
}
