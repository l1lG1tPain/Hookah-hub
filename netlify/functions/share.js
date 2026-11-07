// /m/<id>, /t/<id> и /u/<ник>: страница-«визитка» для ссылок в мессенджерах (Open Graph) + мгновенный редирект в приложение.
// Мессенджеры не исполняют JS, поэтому читают превью отсюда; человека скрипт сразу переводит на #/mix?id=…, #/tobacco?id=… или #/author?h=…
const SITE = process.env.SITE_URL || 'https://hookahhub.netlify.app';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HANDLE = /^[a-z0-9_]{3,20}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function rest(path) {
    const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const r = await fetch(`${process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!r.ok) return [];
    return r.json();
}

async function rpc(name, args) {
    const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const r = await fetch(`${process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args),
    });
    return r.ok ? r.json() : null;
}

export const handler = async (event) => {
    // Netlify не всегда подставляет :id в query редиректа, поэтому берём тип и id из самого пути (/m/<id>, /t/<id>)
    const qs = event.queryStringParameters || {};
    const pm = String(event.rawUrl || event.path || '').split('?')[0].match(/\/([mtu])\/([^/?#]+)\/?$/);
    const code = pm ? pm[1] : qs.type;
    const type = code === 'u' ? 'user' : code === 't' ? 'tobacco' : 'mix';
    let id = '';
    try { id = decodeURIComponent(pm ? pm[2] : String(qs.id || '')).trim(); } catch { id = ''; }
    const target = type === 'user' ? `${SITE}/#/author?h=${encodeURIComponent(id)}` : `${SITE}/#/${type}?id=${encodeURIComponent(id)}`;
    let title = 'Hookah Hub', desc = 'Миксы, табаки и честный рейтинг от любителей кальяна.', image = `${SITE}/og.png`;

    try {
        if (type === 'user') {
            if (HANDLE.test(id)) {
                const a = await rpc('hh_author_by_handle', { p_handle: id });
                if (a) {
                    title = `${a.name} (@${a.handle}) — миксы на Hookah Hub`;
                    const n = Number(a.mixes) || 0;
                    desc = a.bio || (n ? `Авторские миксы: ${n}. Смотрите составы и оценки сообщества.` : desc);
                    if (a.avatar_url) image = a.avatar_url;
                }
            }
        } else if (UUID.test(id)) {
            if (type === 'mix') {
                const [m] = await rest(`mixes_with_stats?id=eq.${id}&select=title,description,votes,avg_score,image_url`);
                if (m) {
                    const ing = await rest(`mix_ingredients_api?mix_id=eq.${id}&select=brand,tobacco,percent,custom_title&order=pos`);
                    title = `Микс «${m.title}» — Hookah Hub`;
                    const comp = ing.map((i) => `${i.tobacco || i.custom_title} ${i.percent}%`).join(' · ');
                    const rate = Number(m.votes) >= 3 && m.avg_score != null ? `★ ${Number(m.avg_score).toFixed(1)}/5 (${m.votes}) · ` : '';
                    desc = `${rate}${comp || m.description || desc}`;
                    if (m.image_url) image = m.image_url;
                }
            } else {
                const [t] = await rest(`tobaccos_api?id=eq.${id}&select=name,brand_name,line_name,description,votes,avg_score,cover_url`);
                if (t) {
                    title = `${t.brand_name ? t.brand_name + ' ' : ''}${t.name} — Hookah Hub`;
                    const rate = Number(t.votes) >= 3 && t.avg_score != null ? `★ ${Number(t.avg_score).toFixed(1)}/5 (${t.votes}) · ` : '';
                    desc = `${rate}${t.line_name ? t.line_name + '. ' : ''}${t.description || desc}`;
                    if (t.cover_url) image = t.cover_url;
                }
            }
        }
    } catch (e) { console.error('share', e); }
    desc = desc.length > 200 ? desc.slice(0, 197) + '…' : desc;

    const body = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${esc(desc)}">
<meta property="og:site_name" content="Hookah Hub"><meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}"><meta property="og:url" content="${SITE}/${type === 'user' ? 'u' : type === 'mix' ? 'm' : 't'}/${esc(id)}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
<script>location.replace(${JSON.stringify(target)})</script></head>
<body style="background:#16110e;color:#f3e7dc;font:16px system-ui;padding:32px"><a href="${esc(target)}" style="color:#ff9a5c">Открыть в Hookah Hub</a></body></html>`;
    return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' }, body };
};
