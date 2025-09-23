// netlify/functions/favorites-list.js
import { createClient } from '@supabase/supabase-js';
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

async function getUserId(event) {
    // сначала пробуем по сессии
    const session = event.headers['x-session'];
    if (session) {
        const { data, error } = await supa
            .from('sessions')
            .select('user_id')
            .eq('token', session)
            .maybeSingle();
        if (data?.user_id) return data.user_id;
    }

    // fallback на старый вариант (tg_id)
    const tgId = event.headers['x-tg-id'];
    if (tgId) {
        const { data, error } = await supa
            .from('users')
            .select('id')
            .eq('tg_id', tgId)
            .maybeSingle();
        if (data?.id) return data.id;
    }

    return null;
}

export async function handler(event){
    try{
        const userId = await getUserId(event);
        if (!userId) return res(401, { ok:false, error:'unauthorized' });

        const tab = (event.queryStringParameters?.tab || 'mixes').toLowerCase(); // mixes | tobaccos

        if (tab === 'mixes'){
            const { data, error } = await supa
                .from('favorites')
                .select('created_at, item_id')
                .eq('user_id', userId)
                .eq('item_type', 'mix')
                .order('created_at', { ascending:false });
            if (error) throw error;

            const ids = data.map(x=>x.item_id);
            if (!ids.length) return res(200, { ok:true, items: [] });

            const { data: mx, error: e2 } = await supa
                .from('mixes_with_stats')
                .select('*')
                .in('id', ids);
            if (e2) throw e2;

            const map = new Map(mx.map(m=>[m.id, m]));
            const items = data.map(row => {
                const m = map.get(row.item_id);
                return m ? {
                    id: m.id,
                    name: m.title,
                    cover_url: m.image_url,
                    tags: m.taste_tags || [],
                    description: m.description || '',
                    votes: m.votes || 0,
                    avg_score: m.avg_score,
                    favored_at: row.created_at
                } : null;
            }).filter(Boolean);

            return res(200, { ok:true, items });
        }

        // tobaccos
        const { data, error } = await supa
            .from('favorites')
            .select('created_at, item_id')
            .eq('user_id', userId)
            .eq('item_type', 'tobacco')
            .order('created_at', { ascending:false });
        if (error) throw error;

        const ids = data.map(x=>x.item_id);
        if (!ids.length) return res(200, { ok:true, items: [] });

        const { data: tb, error: e2 } = await supa
            .from('tobaccos_api')
            .select('*')
            .in('id', ids);
        if (e2) throw e2;

        const map = new Map(tb.map(t=>[t.id, t]));
        const items = data.map(row => {
            const t = map.get(row.item_id);
            return t ? { ...t, favored_at: row.created_at } : null;
        }).filter(Boolean);

        return res(200, { ok:true, items });
    }catch(e){
        return res(500, { ok:false, error:String(e) });
    }
}

function res(code, body){
    return { statusCode: code, headers:{ 'content-type':'application/json; charset=utf-8' }, body: JSON.stringify(body) };
}
