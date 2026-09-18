import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const root = process.cwd();
const env = (() => {
  const file = ['.env.local', '.env'].map(name => join(root, name)).find(existsSync);
  return file ? readFileSync(file, 'utf8') : '';
})();
const envValue = name => (process.env[name] ?? env.match(new RegExp(`^${name}\\s*=\\s*(.+)$`, 'm'))?.[1] ?? '').trim().replace(/^['"]|['"]$/g, '');
const token = envValue('CARDTRADER_API_TOKEN');
const mypToken = envValue('MYP_API_TOKEN');
const supabaseUrl = envValue('SUPABASE_URL').replace(/\/$/, '');
const supabaseServiceRoleKey = envValue('SUPABASE_SERVICE_ROLE_KEY');
const apiBase = 'https://api.cardtrader.com/api/v2';
const mypApiBase = 'https://mypcards.com/api/v1';
const tickerMintApiBase = 'https://api.tickermint.cards';
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png' };
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || '0.0.0.0';

async function upstream(url, options, unavailable, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  catch (error) { throw new Error(error?.name === 'AbortError' ? `${unavailable}_TIMEOUT` : unavailable); }
  finally { clearTimeout(timer); }
}
async function cardTrader(path) {
  if (!token) return { status: 503, body: { error: 'CARDTRADER_NOT_CONFIGURED' } };
  try {
    const response = await upstream(`${apiBase}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept:'application/json' } }, 'CARDTRADER_UNAVAILABLE');
    if (!response.ok) return { status: response.status, body: { error: response.status === 401 ? 'CARDTRADER_UNAUTHORIZED' : response.status === 429 ? 'CARDTRADER_RATE_LIMITED' : 'CARDTRADER_REQUEST_FAILED' } };
    return { status: 200, body: await response.json() };
  } catch { return { status: 502, body: { error: 'CARDTRADER_UNAVAILABLE' } }; }
}
async function myp(path) {
  if (!mypToken) return { status: 503, body: { error: 'MYP_NOT_CONFIGURED' } };
  try {
    const response = await upstream(`${mypApiBase}${path}`, { headers: { 'X-Api-Token': mypToken, Accept: 'application/json' } }, 'MYP_UNAVAILABLE');
    if (!response.ok) return { status: response.status, body: { error: response.status === 401 || response.status === 403 ? 'MYP_UNAUTHORIZED' : 'MYP_REQUEST_FAILED' } };
    return { status: 200, body: await response.json() };
  } catch { return { status: 502, body: { error: 'MYP_UNAVAILABLE' } }; }
}
async function tickerMint(path) {
  try {
    const response = await upstream(`${tickerMintApiBase}${path}`, { headers: { Accept: 'application/json' } }, 'TICKERMINT_UNAVAILABLE');
    if (!response.ok) return { status: response.status, body: { error: response.status === 429 ? 'TICKERMINT_RATE_LIMITED' : 'TICKERMINT_REQUEST_FAILED' } };
    return { status: 200, body: await response.json() };
  } catch (error) { return { status: 502, body: { error: error.message || 'TICKERMINT_UNAVAILABLE' } }; }
}
async function supabase(path, options = {}) {
  if (!supabaseUrl || !supabaseServiceRoleKey) return { status: 503, body: { error: 'SUPABASE_NOT_CONFIGURED' } };
  try {
    const response = await upstream(`${supabaseUrl}/rest/v1${path}`, {
      ...options,
      headers: { apikey: supabaseServiceRoleKey, Authorization: `Bearer ${supabaseServiceRoleKey}`, Accept: 'application/json', ...(options.headers || {}) }
    }, 'SUPABASE_UNAVAILABLE');
    if (!response.ok) return { status: response.status, body: { error: 'SUPABASE_REQUEST_FAILED' } };
    return { status: 200, body: await response.json().catch(() => ({})) };
  } catch (error) { return { status: 502, body: { error: error.message || 'SUPABASE_UNAVAILABLE' } }; }
}
function json(res, status, body) { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(body)); }
const routes = {
  '/api/cardtrader/status': async () => { const result = await cardTrader('/info'); return result.status === 200 ? { status:200, body:{ connected:true } } : { status:result.status, body:{ connected:false, reason:result.body.error } }; },
  '/api/cardtrader/games': () => cardTrader('/games'),
  '/api/cardtrader/categories': () => cardTrader('/categories'),
  '/api/cardtrader/expansions': () => cardTrader('/expansions'),
  '/api/tickermint/status': async () => {
    const result = await tickerMint('/desk/movers?game=pokemon&days=7&min_market=5');
    return result.status === 200 ? { status: 200, body: { connected: true } } : { status: result.status, body: { connected: false, reason: result.body.error } };
  },
  '/api/supabase/status': async () => {
    const result = await supabase('/catalog_items?select=id&limit=1');
    return result.status === 200 ? { status: 200, body: { connected: true } } : { status: result.status, body: { connected: false, reason: result.body.error } };
  },
  '/api/myp/status': async () => {
    const result = await myp('/pokemon/edicoes');
    return result.status === 200 ? { status: 200, body: { connected: true } } : { status: result.status, body: { connected: false, reason: result.body.error } };
  },
};
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (routes[url.pathname]) { const result = await routes[url.pathname](); return json(res, result.status, result.body); }
  if (url.pathname === '/api/cardtrader/marketplace') {
    const blueprint = url.searchParams.get('blueprint_id');
    if (!/^\d+$/.test(blueprint ?? '')) return json(res, 400, { error:'BLUEPRINT_ID_REQUIRED' });
    const result = await cardTrader(`/marketplace/products?blueprint_id=${blueprint}`); return json(res, result.status, result.body);
  }
  if (url.pathname === '/api/cardtrader/marketplace-expansion') {
    const expansion = url.searchParams.get('expansion_id');
    if (!/^\d+$/.test(expansion ?? '')) return json(res, 400, { error:'EXPANSION_ID_REQUIRED' });
    const result = await cardTrader(`/marketplace/products?expansion_id=${expansion}`); return json(res, result.status, result.body);
  }
  if (url.pathname === '/api/cardtrader/blueprints') {
    const expansion = url.searchParams.get('expansion_id');
    if (!/^\d+$/.test(expansion ?? '')) return json(res, 400, { error:'EXPANSION_ID_REQUIRED' });
    const result = await cardTrader(`/blueprints/export?expansion_id=${expansion}`); return json(res, result.status, result.body);
  }
  if (url.pathname === '/api/myp/search') {
    const game = (url.searchParams.get('game') || '').toLowerCase();
    const name = (url.searchParams.get('name') || '').trim();
    const games = new Set(['pokemon', 'magic', 'yugioh', 'digimon', 'onepiece', 'lorcana', 'fab', 'riftbound', 'gundam', 'unionarena']);
    if (!games.has(game) || !name || name.length > 140) return json(res, 400, { error: 'MYP_SEARCH_PARAMS_INVALID' });
    const result = await myp(`/${game}/carta/${encodeURIComponent(name)}`);
    return json(res, result.status, result.body);
  }
  if (url.pathname === '/api/tickermint/search') {
    const game = (url.searchParams.get('game') || 'pokemon').toLowerCase();
    const query = (url.searchParams.get('q') || '').trim();
    const games = new Set(['pokemon', 'one-piece', 'lorcana', 'riftbound', 'gundam']);
    if (!games.has(game) || !query || query.length > 140) return json(res, 400, { error: 'TICKERMINT_SEARCH_PARAMS_INVALID' });
    const result = await tickerMint(`/products/search?q=${encodeURIComponent(query)}&game=${encodeURIComponent(game)}`);
    return json(res, result.status, result.body);
  }
  if (url.pathname === '/api/tickermint/prices') {
    const product = url.searchParams.get('product_id');
    if (!/^\d+$/.test(product ?? '')) return json(res, 400, { error: 'TICKERMINT_PRODUCT_ID_REQUIRED' });
    const result = await tickerMint(`/products/${product}/prices`);
    return json(res, result.status, result.body);
  }
  if (url.pathname === '/api/tickermint/product') {
    const product = url.searchParams.get('product_id');
    if (!/^\d+$/.test(product ?? '')) return json(res, 400, { error: 'TICKERMINT_PRODUCT_ID_REQUIRED' });
    const result = await tickerMint(`/products/${product}`);
    return json(res, result.status, result.body);
  }
  if (url.pathname === '/api/tickermint/sales') {
    const product = url.searchParams.get('product_id');
    if (!/^\d+$/.test(product ?? '')) return json(res, 400, { error: 'TICKERMINT_PRODUCT_ID_REQUIRED' });
    const result = await tickerMint(`/products/${product}/sales`);
    return json(res, result.status, result.body);
  }
  if (url.pathname === '/api/tickermint/ebay') {
    const product = url.searchParams.get('product_id');
    if (!/^\d+$/.test(product ?? '')) return json(res, 400, { error: 'TICKERMINT_PRODUCT_ID_REQUIRED' });
    const result = await tickerMint(`/products/${product}/ebay`);
    return json(res, result.status, result.body);
  }
  if (url.pathname === '/api/tickermint/movers') {
    const game = (url.searchParams.get('game') || 'pokemon').toLowerCase();
    const days = Number(url.searchParams.get('days') || '7');
    const games = new Set(['pokemon', 'one-piece', 'lorcana', 'riftbound', 'gundam']);
    if (!games.has(game) || !Number.isInteger(days) || days < 1 || days > 90) return json(res, 400, { error: 'TICKERMINT_MOVERS_PARAMS_INVALID' });
    const result = await tickerMint(`/desk/movers?game=${encodeURIComponent(game)}&days=${days}&min_market=5`);
    return json(res, result.status, result.body);
  }
  if (url.pathname === '/api/tickermint/sealed') {
    const game = (url.searchParams.get('game') || 'pokemon').toLowerCase();
    const games = new Set(['pokemon', 'one-piece', 'lorcana', 'riftbound', 'gundam']);
    if (!games.has(game)) return json(res, 400, { error: 'TICKERMINT_GAME_INVALID' });
    const result = await tickerMint(`/desk/sealed?game=${encodeURIComponent(game)}`);
    return json(res, result.status, result.body);
  }
  if (url.pathname === '/api/cardtrader/image') {
    const source = url.searchParams.get('src');
    try {
      const remote = new URL(source);
      const allowedHost = remote.hostname === 'cardtrader.com' || remote.hostname === 'www.cardtrader.com';
      if (!allowedHost || !remote.pathname.startsWith('/uploads/blueprints/')) return json(res, 400, { error:'IMAGE_SOURCE_NOT_ALLOWED' });
      const image = await fetch(remote, { headers:{ Accept:'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8', 'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36', Referer:'https://www.cardtrader.com/' } });
      const type = image.headers.get('content-type') || 'image/jpeg';
      if (!image.ok || !type.startsWith('image/')) return json(res, 502, { error:'IMAGE_UNAVAILABLE', upstream_status:image.status });
      res.writeHead(200, { 'Content-Type':type, 'Cache-Control':'public, max-age=86400' });
      res.end(Buffer.from(await image.arrayBuffer()));
    } catch { return json(res, 400, { error:'INVALID_IMAGE_SOURCE' }); }
    return;
  }
  if (url.pathname === '/api/exchange') {
    const base = (url.searchParams.get('base') || 'EUR').toUpperCase();
    if (!['EUR','USD','BRL'].includes(base)) return json(res, 400, { error:'UNSUPPORTED_CURRENCY' });
    try {
      const response = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL');
      if (response.ok) {
        const data = await response.json();
        const usdBrl = Number(data.USDBRL?.bid), eurBrl = Number(data.EURBRL?.bid);
        if (Number.isFinite(usdBrl) && Number.isFinite(eurBrl)) {
          const rates = base === 'BRL' ? { BRL:1, USD:1/usdBrl, EUR:1/eurBrl } : base === 'USD' ? { USD:1, BRL:usdBrl, EUR:usdBrl/eurBrl } : { EUR:1, BRL:eurBrl, USD:eurBrl/usdBrl };
          return json(res, 200, { base, provider:'AwesomeAPI', updated_at:data.EURBRL?.create_date || data.USDBRL?.create_date, rates });
        }
      }
      const fallback = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=BRL,EUR,USD`);
      if (!fallback.ok) return json(res, 502, { error:'EXCHANGE_UNAVAILABLE' });
      const data = await fallback.json();
      return json(res, 200, { base, provider:'Frankfurter fallback', updated_at:data.date, rates:{ ...data.rates, [base]:1 } });
    } catch { return json(res, 502, { error:'EXCHANGE_UNAVAILABLE' }); }
  }
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = normalize(join(root, requested));
  if (!file.startsWith(root)) return json(res, 403, { error:'FORBIDDEN' });
  try {
    const extension = extname(file);
    const content = await readFile(file);
    const cache = ['.html', '.js', '.css'].includes(extension) ? 'no-cache, no-store, must-revalidate' : 'public, max-age=86400';
    res.writeHead(200, {'Content-Type':types[extension] ?? 'application/octet-stream', 'Cache-Control':cache}); res.end(content);
  }
  catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, host, () => console.log(`Nukenin Trader running at http://${host}:${port}`));
