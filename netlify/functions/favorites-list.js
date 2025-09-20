// netlify/functions/favorites-list.js
import { createClient } from '@supabase/supabase-js';
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

export async function handler(event){
    try{
        const tgId = event.headers['x-tg-id'];
        if (!tgId) return res(401, { ok:false, error:'unauthorized' });

        const tab = (event.queryStringParameters?.tab || 'mixes').toLowerCase(); // mixes | tobaccos

        const { data: user, error: eU } = await supa.from('users').select('id').eq('tg_id', tgId).maybeSingle();
        if (eU || !user) return res(404, { ok:false, error:'user not found' });

        if (tab === 'mixes'){
            const { data, error } = await supa
                .from('favorites')
                .select('created_at, item_id')
                .eq('user_id', user.id)
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
            .eq('user_id', user.id)
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
