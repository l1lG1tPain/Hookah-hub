import { createClient } from '@supabase/supabase-js';
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function handler(event) {
    try {
        const id = (event.queryStringParameters?.id || '').trim();
        if (!UUID_RE.test(id)) {
            return res(400, { ok:false, error:'bad id' });
        }

        const { data: m, error: e1 } = await supa.from('mixes').select('*').eq('id', id).maybeSingle();
        if (e1) throw e1;
        if (!m || !m.is_published) return res(404, { ok:false, error:'not found' });

        const { data: ing, error: e2 } = await supa
            .from('mix_ingredients_api')
            .select('brand,tobacco,percent,pos,custom_title')
            .eq('mix_id', id)
            .order('pos', { ascending: true });
        if (e2) throw e2;

        const { data: agg, error: e3 } = await supa.rpc('mix_rating_aggregate', { p_mix_id: id });
        if (e3) throw e3;

        const mix = {
            id: m.id,
            name: m.title,
            cover_url: m.image_url,
            tags: m.taste_tags || [],
            description: m.description || '',
            is_published: m.is_published,
            created_at: m.created_at,
            updated_at: m.updated_at,
            ingredients: (ing || []).map(r => ({
                brand: r.brand,
                tobacco: r.tobacco ?? r.custom_title ?? '—',
                percent: r.percent,
                pos: r.pos
            })),
            ratings: agg || {}
        };

        // >>> ключевая строка: теперь как ждёт фронт
        return res(200, { ok:true, mix });
    } catch (e) {
        return res(500, { ok:false, error:String(e) });
    }
}

function res(code, body){
    return { statusCode: code, headers:{ 'content-type':'application/json; charset=utf-8' }, body: JSON.stringify(body) };
}
