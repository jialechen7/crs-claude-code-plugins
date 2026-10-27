const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const { spawn } = require('node:child_process')

const bin = path.join(__dirname, '../crs-balance/bin/crs-balance')
const run = (args, env) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [bin, ...args], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
  let out = '', err = ''
  child.stdout.on('data', d => { out += d })
  child.stderr.on('data', d => { err += d })
  child.on('error', reject)
  child.on('close', code => resolve({ code, out, err }))
})

test('existing CRS token and aggregate behavior remain compatible', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'crs-plugin-'))
  const config = path.join(home, '.claude')
  fs.mkdirSync(config)
  fs.writeFileSync(path.join(config, 'settings.json'), JSON.stringify({env:{ANTHROPIC_AUTH_TOKEN:'cr_fixture'}}))
  const paths = []
  const api = http.createServer((req, res) => {
    paths.push(req.url)
    res.setHeader('content-type', 'application/json')
    if (req.url === '/stats/key/cr_fixture') {
      res.end(JSON.stringify([{key:{id:'id',name:'first'},account:{name:'demo',status:'active',schedulable:true,
        fiveHour:{utilization:20},sevenDay:{utilization:40}},fiveHour:{shareOfAccount:0.2},sevenDay:{shareOfAccount:0.3}}]))
    } else if (req.url === '/stats/aggregate/account/demo') {
      res.end(JSON.stringify({account:{name:'demo'},totals:{fiveHour:{accountUtilization:20,keys:[{name:'first',shareOfAccount:0.2}]},
        sevenDay:{accountUtilization:40,keys:[{name:'first',shareOfAccount:0.3}]}}}))
    } else {res.statusCode=404;res.end('{}')}
  })
  await new Promise(resolve => api.listen(0,'127.0.0.1',resolve))
  try {
    const env={HOME:home,CLAUDE_CONFIG_DIR:config,CRS_BACKEND:'auto',CRS_BASE_URL:`http://127.0.0.1:${api.address().port}`,
      MAGPIE_STATS_URL:'',CRS_API_KEY:'',ANTHROPIC_AUTH_TOKEN:'',ANTHROPIC_API_KEY:'',ANTHROPIC_BASE_URL:'',CRS_NO_COLOR:'1'}
    const result=await run(['--statusline'],env)
    assert.equal(result.code,0,result.err)
    assert.match(result.out,/crs.*5h.*mine 4\.0%.*7d.*mine 12\.0%/)
    assert.deepEqual(paths,['/stats/key/cr_fixture','/stats/aggregate/account/demo'])
  } finally {
    await new Promise(resolve => api.close(resolve))
    fs.rmSync(home,{recursive:true,force:true})
  }
})

test('Magpie statusline preserves original layout and uses bearer authentication', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'magpie-plugin-'))
  const config = path.join(home, '.claude')
  fs.mkdirSync(config)
  fs.writeFileSync(path.join(config, 'settings.json'), JSON.stringify({ env: {
    ANTHROPIC_BASE_URL: 'https://www.woodlandfield.top', ANTHROPIC_API_KEY: 'sample-gateway-key'
  } }))
  let seen = 0
  const api = http.createServer((req, res) => {
    seen++
    assert.equal(req.url, '/stats/magpie/key')
    assert.equal(req.headers.authorization, 'Bearer sample-gateway-key')
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify([{ key: {id:'one', name:'one'}, account: {id:'account',name:'local',status:'active',schedulable:true,
      fiveHour:{utilization:20,resetsAt:'2099-01-01T00:00:00Z'}, sevenDay:{utilization:40,resetsAt:'2099-01-02T00:00:00Z'}},
      fiveHour:{shareOfAccount:0.25}, sevenDay:{shareOfAccount:0.25}, dataQuality:{costType:'estimated_api_equivalent',snapshotAt:'2026-10-27T09:30:00Z'} }]))
  })
  await new Promise(resolve => api.listen(0, '127.0.0.1', resolve))
  try {
    const env = { HOME:home, CLAUDE_CONFIG_DIR:config, MAGPIE_STATS_URL:`http://127.0.0.1:${api.address().port}`,
      CRS_BACKEND:'auto', CRS_BASE_URL:'', CRS_API_KEY:'', ANTHROPIC_AUTH_TOKEN:'', ANTHROPIC_API_KEY:'', ANTHROPIC_BASE_URL:'', CRS_NO_COLOR:'1' }
    const result = await run(['--statusline'], env)
    assert.equal(result.code, 0, result.err)
    assert.match(result.out, /^magpie › local · 5h /)
    assert.match(result.out, /5h.*mine 5\.0%/)
    assert.match(result.out, /7d.*mine 10\.0%/)
    assert.doesNotMatch(result.out, /占已用|快照|缓存过期|magpie~/)
    assert.equal(seen, 1)
    assert.doesNotMatch(result.out, /sample-gateway-key/)
    const denied = await run(['--backend','magpie','--base-url','https://api.anthropic.com','--json'], env)
    assert.notEqual(denied.code, 0)
    assert.match(denied.err, /禁止将用量查询发送到 Anthropic/)
    assert.equal(seen, 1)
  } finally {
    await new Promise(resolve => api.close(resolve))
    fs.rmSync(home, {recursive:true,force:true})
  }
})

test('installer wires the installed plugin into the statusline without running Claude', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'magpie-install-'))
  const config = path.join(home, '.claude')
  const fakeBin = path.join(home, 'bin')
  fs.mkdirSync(config)
  fs.mkdirSync(fakeBin)
  fs.writeFileSync(path.join(config, 'settings.json'), JSON.stringify({env:{
    ANTHROPIC_BASE_URL:'https://www.woodlandfield.top', ANTHROPIC_API_KEY:'install-fixture'
  }}))
  fs.writeFileSync(path.join(fakeBin, 'claude'), `#!/bin/sh\ncase "$*" in\n  'plugin list --json') echo '[]' ;;\n  'plugin install '*) mkdir -p "$CLAUDE_CONFIG_DIR/plugins/cache/crs-tools/crs-balance/0.7.2"; cp -R "$PLUGIN_SOURCE"/. "$CLAUDE_CONFIG_DIR/plugins/cache/crs-tools/crs-balance/0.7.2/" ;;\nesac\n`, {mode:0o755})
  const api = http.createServer((req,res) => {
    assert.equal(req.headers.authorization, 'Bearer install-fixture')
    res.setHeader('content-type','application/json')
    res.end(JSON.stringify([{key:{name:'one'},account:{name:'local',status:'active',schedulable:true,
      fiveHour:{utilization:20},sevenDay:{utilization:40}},fiveHour:{shareOfAccount:0.25},
      sevenDay:{shareOfAccount:0.25},dataQuality:{costType:'estimated_api_equivalent'}}]))
  })
  await new Promise(resolve => api.listen(0,'127.0.0.1',resolve))
  const exec = (command,args,env,input='{}') => new Promise((resolve,reject) => {
    const child = spawn(command,args,{env,stdio:['pipe','pipe','pipe']})
    let out='',err=''; child.stdout.on('data',d=>out+=d); child.stderr.on('data',d=>err+=d)
    child.on('error',reject); child.on('close',code=>resolve({code,out,err})); child.stdin.end(input)
  })
  try {
    const env={...process.env, HOME:home, CLAUDE_CONFIG_DIR:config, PLUGIN_SOURCE:path.join(__dirname,'../crs-balance'),
      PATH:`${fakeBin}:${path.dirname(process.execPath)}:${process.env.PATH}`, MAGPIE_STATS_URL:`http://127.0.0.1:${api.address().port}`,
      CRS_BACKEND:'auto', CRS_BASE_URL:'', CRS_API_KEY:'', ANTHROPIC_API_KEY:'', ANTHROPIC_AUTH_TOKEN:'', ANTHROPIC_BASE_URL:'', CRS_NO_COLOR:'1'}
    const install = await exec('bash',[path.join(__dirname,'../install.sh')],env)
    assert.equal(install.code,0,install.err)
    const settings = JSON.parse(fs.readFileSync(path.join(config,'settings.json'),'utf8'))
    assert.equal(settings.statusLine.command,path.join(config,'crs-statusline.sh'))
    const input=JSON.stringify({model:{display_name:'Claude Test'},workspace:{current_dir:path.join(home,'project')},context_window:{context_window_size:200000,used_percentage:34}})
    const status = await exec(settings.statusLine.command,[],env,input)
    assert.equal(status.code,0,status.err)
    assert.match(status.out,/^Claude Test · ~\/project · context 34% \/ 200k\n/)
    assert.match(status.out,/magpie.*5h.*mine 5\.0%.*7d.*mine 10\.0%/)
    fs.writeFileSync(path.join(config,'crs-statusline.upstream'), "printf 'original statusline\\n'\n")
    const withUpstream=await exec(settings.statusLine.command,[],env,input)
    assert.match(withUpstream.out,/^original statusline\nmagpie/)
    assert.doesNotMatch(withUpstream.out,/Claude Test/)
  } finally {
    await new Promise(resolve=>api.close(resolve))
    fs.rmSync(home,{recursive:true,force:true})
  }
})

test('temporary errors use a labelled same-key cache, but authorization failures do not', async () => {
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'magpie-cache-'))
  const config=path.join(home,'.claude'); fs.mkdirSync(config)
  fs.writeFileSync(path.join(config,'settings.json'),JSON.stringify({env:{ANTHROPIC_BASE_URL:'https://www.woodlandfield.top',ANTHROPIC_API_KEY:'fixture-key'}}))
  let code=200
  const api=http.createServer((req,res)=>{
    if (code === 0) return // Simulate a network request that never completes.
    res.statusCode=code; res.setHeader('content-type','application/json')
    res.end(code===200 ? JSON.stringify([{key:{name:'one'},account:{name:'local',status:'active',schedulable:true,
      fiveHour:{utilization:20},sevenDay:{utilization:40}},fiveHour:{shareOfAccount:0.25},sevenDay:{shareOfAccount:0.25}}]) : '{}')
  })
  await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve))
  try {
    const cache=path.join(home,'cache.json')
    const env={HOME:home,CLAUDE_CONFIG_DIR:config,CRS_CACHE_FILE:cache,MAGPIE_STATS_URL:`http://127.0.0.1:${api.address().port}`,
      CRS_BACKEND:'auto',CRS_BASE_URL:'',CRS_API_KEY:'',ANTHROPIC_AUTH_TOKEN:'',ANTHROPIC_API_KEY:'',ANTHROPIC_BASE_URL:'',CRS_NO_COLOR:'1'}
    assert.match((await run(['--statusline'],env)).out,/magpie.*mine 5\.0%/)
    const cached=JSON.parse(fs.readFileSync(cache)); cached.generatedAt=new Date(Date.now()-45000).toISOString(); fs.writeFileSync(cache,JSON.stringify(cached))
    code=503
    assert.match((await run(['--statusline'],env)).out,/magpie.*mine 5\.0%.*缓存/)
    code=0
    assert.match((await run(['--statusline'],env)).out,/magpie.*mine 5\.0%.*缓存/)
    code=401
    const denied=await run(['--statusline'],env)
    assert.match(denied.out,/CRS HTTP 401/)
    assert.doesNotMatch(denied.out,/缓存/)
    code=503
    cached.generatedAt=new Date(Date.now()-301000).toISOString(); fs.writeFileSync(cache,JSON.stringify(cached))
    assert.doesNotMatch((await run(['--statusline'],env)).out,/缓存/)
  } finally {
    await new Promise(resolve=>api.close(resolve)); fs.rmSync(home,{recursive:true,force:true})
  }
})
