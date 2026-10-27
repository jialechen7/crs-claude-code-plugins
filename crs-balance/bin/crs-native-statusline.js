#!/usr/bin/env node
// Render local Claude statusline input only; this program never uses network.
const path = require('node:path')
let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', chunk => { input += chunk })
process.stdin.on('end', () => {
  let data
  try { data = JSON.parse(input) } catch (_) { return }
  if (!data || typeof data !== 'object') return
  const clean = x => typeof x === 'string' ? x.replace(/[\x00-\x1f\x7f]/g, '').trim() : ''
  const model = clean(data.model && (data.model.display_name || data.model.id))
  let cwd = clean((data.workspace && data.workspace.current_dir) || data.cwd)
  const home = process.env.HOME || ''
  if (home && (cwd === home || cwd.startsWith(home + path.sep))) cwd = '~' + cwd.slice(home.length)
  const window = data.context_window || {}
  const size = Number(window.context_window_size)
  const pct = window.used_percentage
  let context = ''
  if (Number.isFinite(size) && size > 0) {
    const formatted = size >= 1000 ? `${Number((size / 1000).toFixed(1))}k` : String(size)
    context = `context ${typeof pct === 'number' && Number.isFinite(pct) ? `${pct.toFixed(0)}% / ` : ''}${formatted}`
  }
  const parts = [model, cwd, context].filter(Boolean)
  if (parts.length) console.log(parts.join(' · '))
})
