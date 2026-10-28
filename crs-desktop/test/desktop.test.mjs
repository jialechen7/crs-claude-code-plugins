import { test } from 'node:test';
import assert from 'node:assert/strict';

async function harness() {
  const mod = await import(`../hooks/register.mjs?test=${Math.random()}`);
  const hooks = {};
  mod.register((name, matcher, fn) => { hooks[name] = typeof matcher === 'function' ? matcher : fn; });
  const timers = [];
  const calls = [];
  const state = { surfaces: [], result: { exitCode: 0, stdout: '\x1b[36mmagpie\x1b[0m · 5h \x1b[38;5;80m20.0%\x1b[0m · mine 4.0% · 7d 35.0%\n' } };
  const $ = {
    clock: { now: async () => state.now ?? 1000, after: (ms, fn) => timers.push({ ms, fn }), every: (ms, fn) => timers.push({ ms, fn }) },
    session: { surfaces: async () => state.surfaces },
    process: { run: async (argv, options) => { calls.push({argv, options}); if (state.error) throw Error('offline'); return state.result; } },
    ui: { invalidate: () => {}, resolve: () => ({ Box: props => ({ type: 'Box', ...props }), Text: props => ({ type: 'Text', ...props }), Button: props => ({ type: 'Button', ...props }) }) },
  };
  return { mod, hooks, timers, calls, state, $ };
}

test('desktop shows output while preserving the previous UI', async () => {
  const h = await harness();
  const original = { type: 'existing-mod' };
  await h.hooks['session.start'](h.$, {}, async () => original);
  assert.deepEqual(h.timers.map(x => x.ms), [1500, 30000]);
  await h.timers[0].fn();
  assert.equal(h.calls.length, 0);
  h.state.surfaces = ['desktop'];
  await h.timers[1].fn();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].options.timeoutMs, 15000);
  const out = await h.hooks['ui.render'](h.$, { surface: 'desktop', props: {} }, async () => original);
  assert.equal(out.children[0], original);
  assert.match(JSON.stringify(out), /magpie/);
  assert.match(JSON.stringify(out), /20.0%/);
  assert.match(JSON.stringify(out), /#2a9d9a/);
  assert.equal(await h.hooks['ui.render'](h.$, { surface: 'terminal', props: {} }, async () => original), original);
  assert.equal(await h.hooks['ui.render'](h.$, { surface: 'desktop', props: {hasSurvey: true} }, async () => original), original);
});

test('terminal sessions never run the balance process', async () => {
  const h = await harness();
  h.state.surfaces = ['terminal'];
  await h.hooks['session.start'](h.$, {}, async () => null);
  await h.timers[0].fn();
  await h.hooks['turn.complete'](h.$, {}, async () => null);
  assert.equal(h.calls.length, 0);
});

test('a failed refresh keeps and labels the last reading', async () => {
  const h = await harness();
  h.state.surfaces = ['desktop'];
  await h.hooks['turn.complete'](h.$, {}, async () => null);
  h.state.error = true;
  await h.hooks['turn.complete'](h.$, {}, async () => null);
  const out = await h.hooks['ui.render'](h.$, {surface:'desktop',props:{}}, async () => null);
  assert.match(JSON.stringify(out), /20.0%/);
  assert.match(JSON.stringify(out), /缓存/);
});

test('escape codes are translated without leaving raw control characters', async () => {
  const { mod } = await harness();
  const result = mod.parseLine('\x1b[2m5h\x1b[0m \x1b[38;5;80m20%\x1b[0m');
  assert.deepEqual(result, [{text:'5h',dimColor:true},{text:' '},{text:'20%',color:'#2a9d9a'}]);
  assert.doesNotMatch(JSON.stringify(result), /\\u001b/);
});


test('revoked token errors replace old values and are not labelled as a cache', async () => {
  const h = await harness();
  h.state.surfaces = ['desktop'];
  await h.hooks['turn.complete'](h.$, {}, async () => null);
  h.state.result = {exitCode: 0, stdout: 'CRS token 无效\n'};
  await h.hooks['turn.complete'](h.$, {}, async () => null);
  const out = await h.hooks['ui.render'](h.$, {surface:'desktop',props:{}}, async () => null);
  assert.match(JSON.stringify(out), /token 无效/);
  assert.doesNotMatch(JSON.stringify(out), /20.0%|缓存/);
});

test('stale data expires after five minutes if the process repeatedly fails', async () => {
  const h = await harness();
  h.state.surfaces = ['desktop'];
  await h.hooks['turn.complete'](h.$, {}, async () => null);
  h.state.error = true;
  h.state.now = 302000;
  await h.hooks['turn.complete'](h.$, {}, async () => null);
  const out = await h.hooks['ui.render'](h.$, {surface:'desktop',props:{}}, async () => null);
  assert.match(JSON.stringify(out), /用量暂不可用/);
  assert.doesNotMatch(JSON.stringify(out), /20.0%/);
});


test('refresh button requests a fresh stats snapshot rather than the local cache', async () => {
  const h = await harness();
  h.state.surfaces = ['desktop'];
  await h.hooks['turn.complete'](h.$, {}, async () => null);
  const out = await h.hooks['ui.render'](h.$, {surface:'desktop',props:{}}, async () => null);
  const button = out.children[1].children[1];
  assert.equal(button.key, 'crs-refresh');
  await button.onPress();
  assert.deepEqual(h.calls.at(-1).argv.slice(-2), ['--cache-seconds', '-1']);
  assert.equal(h.calls.length, 2);
});


test('compact single-line layout keeps usage and refresh visible in cached state', async () => {
  const h = await harness();
  h.state.surfaces = ['desktop'];
  h.state.result.stdout = '\x1b[36mmagpie\x1b[0m › \x1b[2mlongaccountname@example.org\x1b[0m · 5h ██▓░░░░ 37.0% \x1b[2m↻ 2.9h\x1b[0m · mine 19.0% · 7d █▓░░░░░ 21.0% · mine 7.2%\n';
  await h.hooks['turn.complete'](h.$, {}, async () => null);
  h.state.error = true;
  await h.hooks['turn.complete'](h.$, {}, async () => null);
  const out = await h.hooks['ui.render'](h.$, {surface:'desktop',props:{}}, async () => null);
  const row = out.children[1];
  assert.equal(row.flexDirection, 'row');
  assert.equal(row.children[1].key, 'crs-refresh');
  const text = JSON.stringify(row);
  assert.match(text, /longaccoun…@…/);
  assert.match(text, /37.0%/); assert.match(text, /21.0%/);
  assert.match(text, /缓存/); assert.match(text, /↻2.9h/);
});
