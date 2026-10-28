// Reuse the installed balance plugin, without running the user's statusLine command.
// In particular, no model or Anthropic API is called by this mod.
const RUN = `
set -u
config_dir="\${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
plugin_dir="$(ls -d "$config_dir"/plugins/cache/crs-tools/crs-balance/*/bin/crs-balance 2>/dev/null | awk -F/ '{print $(NF-2) "\t" $0}' | sort -t. -k1,1n -k2,2n -k3,3n | tail -1 | cut -f2-)"
[ -n "$plugin_dir" ] || exit 20
export PATH="$HOME/.local/bin/node/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
command -v node >/dev/null 2>&1 || exit 21
export CRS_BAR_CELLS="\${CRS_BAR_CELLS:-8}"
exec node "$plugin_dir" --statusline
`;

let segments = [];
let running = false;
let hasReading = false;
let lastFailed = false;
let lastSuccessAt = 0;

// crs-balance only emits these SGR colours. Strip all other terminal escapes,
// so account names and backend errors cannot emit control sequences in the UI.
export function parseLine(line) {
  const pieces = [];
  const sgr = /\x1b\[([0-9;]*)m/g;
  let style = {};
  let offset = 0;
  for (const match of line.matchAll(sgr)) {
    const text = line.slice(offset, match.index).replace(/[\x00-\x1f\x7f]/g, '');
    if (text) pieces.push({ ...style, text });
    const code = match[1];
    if (code === '0' || code === '') style = {};
    else if (code === '2') style = { dimColor: true };
    else if (code === '36') style = { color: '#2a9d9a' };
    else if (code === '38;5;80') style = { color: '#2a9d9a' };
    else if (code === '32') style = { color: '#3c9472' };
    else if (code === '33') style = { color: '#bd8735' };
    else if (code === '31') style = { color: '#c65d55' };
    offset = match.index + match[0].length;
  }
  const tail = line.slice(offset).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x1f\x7f]/g, '');
  if (tail) pieces.push({ ...style, text: tail });
  return pieces;
}

async function refresh($) {
  if (running) return;
  running = true;
  try {
    // A surface attaches shortly after session.start; never run for CLI sessions.
    const surfaces = await $.session.surfaces();
    if (!surfaces.includes('desktop')) return;
    const result = await $.process.run(['/bin/bash', '-c', RUN], { timeoutMs: 15000 });
    const line = result.stdout.split('\n').find(value => value.trim());
    if (result.exitCode !== 0 || !line) throw new Error('balance unavailable');
    // The CLI returns its token and API errors as text with exit code zero.
    // Display those errors directly, especially an invalid/revoked token.
    if (line.startsWith('CRS ')) {
      segments = [{ text: line.slice(0, 200), dimColor: true }];
      hasReading = true;
      lastSuccessAt = 0;
    } else {
      segments = parseLine(line.slice(0, 2000));
      hasReading = true;
      lastSuccessAt = await $.clock.now();
    }
    lastFailed = false;
  } catch (_) {
    // Keep the most recent successful reading for at most five minutes.
    if (!lastSuccessAt || (await $.clock.now()) - lastSuccessAt > 300000) hasReading = false;
    lastFailed = true;
  } finally {
    running = false;
    $.ui.invalidate('ui.render');
  }
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    const result = await next(e);
    $.clock.after(1500, () => refresh($));
    $.clock.every(30000, () => refresh($));
    return result;
  });
  on('turn.complete', async ($, e, next) => {
    const result = await next(e);
    await refresh($);
    return result;
  });
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const prior = await next(e);
    if (e.surface !== 'desktop' || e.props.hasSurvey || (!hasReading && !lastFailed)) return prior;
    const { Box, Text } = $.ui.resolve(e);
    const content = hasReading ? segments : [{ text: '用量暂不可用', dimColor: true }];
    const row = content.map(({ text, ...style }) => Text({ ...style, children: [text] }));
    if (lastFailed && hasReading) row.push(Text({ dimColor: true, children: [' · 缓存'] }));
    return Box({ flexDirection: 'column', children: [prior, Box({ flexDirection: 'row', children: row })] });
  });
}
