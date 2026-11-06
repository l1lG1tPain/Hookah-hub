// Единый слой данных: каталог читается напрямую из Supabase (anon key),
// личные действия — через RPC с проверкой auth.uid() в базе.
import { supabase, DEMO } from './supabase.js';
import { demoMixes, demoTobaccos } from './demo.js';

/* ---------------- нормализация ---------------- */
const SCORE_KEYS = { 5: 'excellent', 4: 'good', 3: 'ok', 2: 'bad', 1: 'notgood' };

function distFrom(row) {
    if (!row) return null;
    const d = {};
    let any = false;
    for (const [n, k] of Object.entries(SCORE_KEYS)) {
        const v = row[k] ?? row[`score${n}`];
        if (v != null) any = true;
        d[n] = Number(v) || 0;
    }
    return any ? d : null;
}
function avgFromDist(d) {
    if (!d) return null;
    let s = 0, c = 0;
    for (const [n, v] of Object.entries(d)) { s += n * v; c += v; }
    return c ? s / c : null;
}

const normMix = (x) => ({
    type: 'mix',
    id: x.id,
    name: x.title ?? x.name,
    cover_url: x.image_url ?? x.cover_url ?? null,
    tags: x.taste_tags ?? x.tags ?? [],
    description: x.description || '',
    votes: Number(x.votes) || 0,
    avg_score: x.avg_score != null ? Number(x.avg_score) : null,
    created_at: x.created_at,
    author_id: x.author_id ?? null,
    dist: distFrom(x),
});

const normTobacco = (x) => ({
    type: 'tobacco',
    id: x.id,
    name: x.name,
    cover_url: x.cover_url ?? x.image_url ?? null,
    brand_name: x.brand_name || '',
    tags: x.tags ?? [],
    votes: Number(x.votes) || 0,
    avg_score: x.avg_score != null ? Number(x.avg_score) : null,
    created_at: x.created_at,
    dist: distFrom(x),
});

/* ---------------- каталог ---------------- */
const escLike = (s) => s.replace(/[,()]/g, ' ').replace(/[%_\\]/g, (m) => '\\' + m);

const demoUserMixes = () => { try { return JSON.parse(localStorage.getItem('hh-demo-mymixes')) || []; } catch { return []; } };
const demoAllMixes = () => [...demoUserMixes(), ...demoMixes];

export async function listMixes({ q = '', tags = [], sort = 'new', limit = 60, author = null } = {}) {
    if (DEMO) {
        let all = demoAllMixes().map(normMix);
        if (author) all = all.filter((m) => m.author_id === author);
        return demoFilter(all, { q, tags, sort }).slice(0, limit);
    }
    let r = supabase.from('mixes_with_stats').select('*').eq('is_published', true);
    if (author) r = r.eq('author_id', author);
    if (q) r = r.ilike('title', `%${escLike(q)}%`);
    if (tags.length) r = r.contains('taste_tags', tags);
    r = sort === 'top'
        ? r.order('avg_score', { ascending: false, nullsFirst: false }).order('votes', { ascending: false })
        : sort === 'popular'
            ? r.order('votes', { ascending: false }).order('avg_score', { ascending: false, nullsFirst: false })
            : r.order('created_at', { ascending: false });
    const { data, error } = await r.limit(limit);
    if (error) throw error;
    return data.map(normMix);
}

export async function listTobaccos({ q = '', tags = [], brands = [], sort = 'new', limit = 60 } = {}) {
    if (DEMO) {
        let items = demoTobaccos.map(normTobacco);
        if (brands.length) items = items.filter((x) => brands.includes(x.brand_name));
        return demoFilter(items, { q, tags, sort }).slice(0, limit);
    }
    let r = supabase.from('tobaccos_api').select('*');
    if (q) r = r.or(`name.ilike.%${escLike(q)}%,brand_name.ilike.%${escLike(q)}%`);
    if (brands.length) r = r.in('brand_name', brands);
    if (tags.length) r = r.contains('tags', tags);
    r = sort === 'top'
        ? r.order('avg_score', { ascending: false, nullsFirst: false }).order('votes', { ascending: false })
        : sort === 'popular'
            ? r.order('votes', { ascending: false })
            : r.order('created_at', { ascending: false });
    const { data, error } = await r.limit(limit);
    if (error) throw error;
    return data.map(normTobacco);
}

export async function listBrands() {
    if (DEMO) return [...new Set(demoTobaccos.map((t) => t.brand_name))].sort();
    const { data, error } = await supabase.from('tobaccos_api').select('brand_name').limit(1000);
    if (error) return [];
    return [...new Set(data.map((x) => x.brand_name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export async function getMix(id) {
    if (DEMO) {
        const m = demoAllMixes().find((x) => x.id === id);
        if (!m) return null;
        return { ...normMix(m), ingredients: m.ingredients };
    }
    const [{ data: m, error }, { data: ing }, { data: agg }] = await Promise.all([
        supabase.from('mixes_with_stats').select('*').eq('id', id).maybeSingle(),
        supabase.from('mix_ingredients_api').select('brand,tobacco,percent,pos,custom_title').eq('mix_id', id).order('pos'),
        supabase.rpc('hh_mix_distribution', { p_mix_id: id }),
    ]);
    if (error) throw error;
    if (!m || m.is_published === false) return null;
    const mix = normMix(m);
    mix.dist = distFrom(agg) || mix.dist;
    if (mix.dist && mix.avg_score == null) mix.avg_score = avgFromDist(mix.dist);
    mix.ingredients = (ing || []).map((r) => ({
        brand: r.brand, tobacco: r.tobacco ?? r.custom_title ?? '—', percent: Number(r.percent) || 0,
    }));
    return mix;
}

export async function getTobacco(id) {
    if (DEMO) {
        const t = demoTobaccos.find((x) => x.id === id);
        return t ? normTobacco(t) : null;
    }
    const { data, error } = await supabase.from('tobaccos_api').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? normTobacco(data) : null;
}

export async function getItemsByIds(type, ids) {
    if (!ids.length) return [];
    if (DEMO) {
        const src = type === 'mix' ? demoAllMixes().map(normMix) : demoTobaccos.map(normTobacco);
        return ids.map((id) => src.find((x) => x.id === id)).filter(Boolean);
    }
    const table = type === 'mix' ? 'mixes_with_stats' : 'tobaccos_api';
    const { data, error } = await supabase.from(table).select('*').in('id', ids);
    if (error) throw error;
    const norm = type === 'mix' ? normMix : normTobacco;
    const map = new Map(data.map((x) => [String(x.id), norm(x)]));
    return ids.map((id) => map.get(String(id))).filter(Boolean);
}

function demoFilter(items, { q, tags, sort }) {
    const ql = q.toLowerCase();
    let r = items.filter((x) =>
        (!ql || x.name.toLowerCase().includes(ql) || (x.brand_name || '').toLowerCase().includes(ql)) &&
        tags.every((t) => x.tags.includes(t)));
    if (sort === 'top') r.sort((a, b) => (b.avg_score ?? 0) - (a.avg_score ?? 0) || b.votes - a.votes);
    else if (sort === 'popular') r.sort((a, b) => b.votes - a.votes);
    else r.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return r;
}

/* ---------------- личное (нужна авторизация) ---------------- */
const demoLS = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem('hh-demo-' + k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem('hh-demo-' + k, JSON.stringify(v)); } catch {} },
};

async function rpc(name, args) {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw error;
    return data;
}

export async function fetchMe() {
    if (DEMO) {
        const u = demoLS.get('user', null);
        if (!u) return null;
        return { ...u, favorites: demoLS.get('favs', []).length, ratings: Object.keys(demoLS.get('ratings', {})).length, mixes: demoUserMixes().length };
    }
    return rpc('hh_me');
}

export async function updateName(name) {
    if (DEMO) { demoLS.set('user', { ...demoLS.get('user', {}), name }); return; }
    return rpc('hh_update_name', { p_name: name });
}

export async function myFavorites() {
    if (DEMO) return demoLS.get('favs', []);
    return (await rpc('hh_my_favorites')) || [];
}

export async function toggleFavorite(type, id) {
    if (DEMO) {
        const favs = demoLS.get('favs', []);
        const i = favs.findIndex((f) => f.item_type === type && f.item_id === id);
        if (i >= 0) favs.splice(i, 1); else favs.unshift({ item_type: type, item_id: id, created_at: new Date().toISOString() });
        demoLS.set('favs', favs);
        return i < 0;
    }
    return rpc('hh_toggle_favorite', { p_type: type, p_item_id: String(id) });
}

export async function rate(type, id, score) {
    if (DEMO) { const r = demoLS.get('ratings', {}); r[`${type}:${id}`] = score; demoLS.set('ratings', r); return; }
    return rpc('hh_rate', { p_type: type, p_item_id: String(id), p_score: score });
}

export async function myRatings() {
    if (DEMO) {
        return Object.entries(demoLS.get('ratings', {})).map(([k, score]) => {
            const [item_type, item_id] = k.split(':');
            return { item_type, item_id, score };
        });
    }
    return (await rpc('hh_my_ratings')) || [];
}

export const demoAuth = {
    signIn(provider) {
        demoLS.set('user', {
            id: '00000000-demo-0000-0000-00000000a1b2', short: '00a1b2', name: 'Гость Демо',
            avatar_url: null, provider, email: provider === 'email' ? 'demo@example.com' : null,
            created_at: new Date().toISOString(),
        });
    },
    signOut() { demoLS.set('user', null); },
};

/** Миксы, в составе которых есть этот табак */
export async function mixesWithTobacco(name, brand) {
    if (DEMO) {
        return demoMixes.filter((m) => m.ingredients.some((i) => i.tobacco === name && (!brand || i.brand === brand))).map(normMix);
    }
    let r = supabase.from('mix_ingredients_api').select('mix_id').eq('tobacco', name);
    if (brand) r = r.eq('brand', brand);
    const { data, error } = await r.limit(30);
    if (error || !data?.length) return [];
    const ids = [...new Set(data.map((x) => x.mix_id))];
    const { data: mx } = await supabase.from('mixes_with_stats').select('*').in('id', ids).eq('is_published', true);
    return (mx || []).map(normMix).sort((a, b) => (b.avg_score ?? 0) - (a.avg_score ?? 0));
}


/* ---------------- авторы и свои миксы ---------------- */
export async function getAuthor(id) {
    if (DEMO) {
        const u = demoLS.get('user', null);
        if (u && u.id === id) return { id, name: u.name, avatar_url: null, created_at: u.created_at, mixes: demoUserMixes().length };
        return { id, name: 'Hookah Hub', avatar_url: null, created_at: null, mixes: demoMixes.length };
    }
    const { data, error } = await supabase.rpc('hh_author', { p_id: id });
    if (error) throw error;
    return data;
}

export async function authorsByIds(ids) {
    const uniq = [...new Set(ids.filter(Boolean))];
    if (!uniq.length) return new Map();
    if (DEMO) return new Map(await Promise.all(uniq.map(async (id) => [id, await getAuthor(id)])));
    const { data } = await supabase.rpc('hh_authors', { p_ids: uniq });
    return new Map((data || []).map((a) => [a.id, a]));
}

/** Все табаки для выбора в конструкторе микса */
export async function listAllTobaccos() {
    if (DEMO) return demoTobaccos.map(normTobacco);
    const { data, error } = await supabase.from('tobaccos_api').select('id,name,brand_name').order('brand_name').order('name').limit(2000);
    if (error) throw error;
    return data.map((x) => ({ id: x.id, name: x.name, brand_name: x.brand_name || '' }));
}

/** ingredients: [{ tobacco_id?, custom_title?, percent }] */
export async function createMix({ title, description, tags, ingredients }) {
    if (DEMO) {
        const u = demoLS.get('user', {});
        const all = demoTobaccos;
        const id = 'u' + Date.now().toString(36);
        const mix = {
            id, title, image_url: null, taste_tags: tags, description, is_published: true,
            created_at: new Date().toISOString(), author_id: u.id,
            ingredients: ingredients.map((i, pos) => {
                const t = all.find((x) => x.id === i.tobacco_id);
                return { brand: t?.brand_name || null, tobacco: t?.name || i.custom_title, percent: i.percent, pos };
            }),
            votes: 0, avg_score: null,
        };
        localStorage.setItem('hh-demo-mymixes', JSON.stringify([mix, ...demoUserMixes()]));
        return id;
    }
    return rpc('hh_create_mix', { p_title: title, p_description: description, p_tags: tags, p_ingredients: ingredients });
}

export async function deleteMix(id) {
    if (DEMO) { localStorage.setItem('hh-demo-mymixes', JSON.stringify(demoUserMixes().filter((m) => m.id !== id))); return; }
    return rpc('hh_delete_mix', { p_id: id });
}
