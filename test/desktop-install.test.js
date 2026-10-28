const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = path.join(__dirname, '..')
function runInstall(plugins, failDesktop = false) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'crs-desktop-install-'))
  const config = path.join(home, '.claude')
  const bin = path.join(home, 'bin')
  fs.mkdirSync(config); fs.mkdirSync(bin)
  fs.writeFileSync(path.join(config, 'settings.json'), JSON.stringify({statusLine:{type:'command',command:'existing-statusline',padding:2}}))
  const balanceDir = path.join(config, 'plugins/cache/crs-tools/crs-balance/0.7.4')
  fs.mkdirSync(balanceDir, {recursive:true})
  fs.cpSync(path.join(root, 'crs-balance'), balanceDir, {recursive:true})
  fs.writeFileSync(path.join(config, 'plugins.json'), JSON.stringify(plugins))
  fs.writeFileSync(path.join(bin, 'claude'), `#!/bin/sh
printf '%s\\n' "$*" >> "$CLAUDE_CONFIG_DIR/commands.log"
case "$*" in
  'plugin list --json') cat "$CLAUDE_CONFIG_DIR/plugins.json" ;;
  'plugin install crs-desktop@crs-tools --scope user') [ "\${FAIL_DESKTOP:-}" != 1 ] || exit 3 ;;
esac
`, {mode:0o755})
  const result = spawnSync('/bin/bash', [path.join(root, 'install.sh')], {encoding:'utf8', env:{...process.env,
    HOME:home, CLAUDE_CONFIG_DIR:config, PATH:`${bin}:${path.dirname(process.execPath)}:${process.env.PATH}`,
    CRS_ENV_FILE:path.join(config,'balance.env'), FAIL_DESKTOP: failDesktop ? '1' : '0'}})
  const calls = fs.readFileSync(path.join(config,'commands.log'),'utf8').trim().split('\n')
  const settings = JSON.parse(fs.readFileSync(path.join(config,'settings.json'),'utf8'))
  const upstream = fs.existsSync(path.join(config,'crs-statusline.upstream')) ? fs.readFileSync(path.join(config,'crs-statusline.upstream'),'utf8').trim() : null
  fs.rmSync(home,{recursive:true,force:true})
  return {result,calls,settings,upstream,home}
}

test('fresh install installs both plugins and retains the existing statusline', () => {
  const {result,calls,settings,upstream,home} = runInstall([])
  assert.equal(result.status,0,result.stderr)
  assert.ok(calls.includes('plugin install crs-balance@crs-tools --scope user'))
  assert.ok(calls.includes('plugin install crs-desktop@crs-tools --scope user'))
  assert.equal(settings.statusLine.command,path.join(home,'.claude/crs-statusline.sh'))
  assert.equal(settings.statusLine.padding,2)
  assert.equal(upstream,'existing-statusline')
})

test('upgrade enables disabled plugin and migrates only the old local desktop preview', () => {
  const {result,calls} = runInstall([
    {id:'crs-balance@crs-tools',scope:'user',enabled:true},
    {id:'crs-desktop@crs-tools',scope:'user',enabled:false},
    {id:'crs-desktop@crs-desktop-local',scope:'user',enabled:true},
    {id:'other@market',scope:'user',enabled:true},
  ])
  assert.equal(result.status,0,result.stderr)
  assert.ok(calls.includes('plugin update crs-balance@crs-tools --scope user'))
  assert.ok(calls.includes('plugin update crs-desktop@crs-tools --scope user'))
  assert.ok(calls.includes('plugin enable crs-desktop@crs-tools --scope user'))
  const remove = calls.indexOf('plugin uninstall crs-desktop@crs-desktop-local --scope user --keep-data')
  assert.ok(remove > calls.indexOf('plugin update crs-desktop@crs-tools --scope user'))
  assert.equal(calls.filter(c=>c.startsWith('plugin uninstall ')).length,1)
})

test('failed desktop installation leaves the old preview and statusline in place', () => {
  const {result,calls,settings} = runInstall([{id:'crs-desktop@crs-desktop-local',scope:'user',enabled:true}],true)
  assert.notEqual(result.status,0)
  assert.ok(!calls.some(c=>c.startsWith('plugin uninstall ')))
  assert.equal(settings.statusLine.command,'existing-statusline')
})

test('project-only plugin does not prevent user-scope installation', () => {
  const {result,calls} = runInstall([{id:'crs-desktop@crs-tools',scope:'project',enabled:true}])
  assert.equal(result.status,0,result.stderr)
  assert.ok(calls.includes('plugin install crs-desktop@crs-tools --scope user'))
})
