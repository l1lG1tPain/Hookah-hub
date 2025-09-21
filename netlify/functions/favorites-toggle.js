// netlify/functions/favorites-toggle.js
import { createClient } from '@supabase/supabase-js';
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

export async function handler(event){
    try{
        if (event.httpMethod !== 'POST') return res(405, { ok:false, error:'method not allowed' });

        const tgId = event.headers['x-tg-id'];
        if (!tgId) return res(401, { ok:false, error:'unauthorized' });

        const { item_type, item_id } = JSON.parse(event.body || '{}');
        if (!['mix','tobacco'].includes(item_type) || !item_id) {
            return res(400, { ok:false, error:'bad payload' });
        }

        const { data: user, error: eU } = await supa.from('users').select('id').eq('tg_id', tgId).maybeSingle();
        if (eU) throw eU;
        if (!user) return res(404, { ok:false, error:'user not found' });

        const { data: exists, error: e1 } = await supa
            .from('favorites')
            .select('user_id')
            .eq('user_id', user.id)
            .eq('item_type', item_type)
            .eq('item_id', item_id)
            .maybeSingle();
        if (e1) throw e1;

        if (exists){
            const { error } = await supa
                .from('favorites')
                .delete()
                .eq('user_id', user.id)
                .eq('item_type', item_type)
                .eq('item_id', item_id);
            if (error) throw error;
            return res(200, { ok:true, favored:false });
        } else {
            const { error } = await supa
                .from('favorites')
                .insert({ user_id: user.id, item_type, item_id });
            if (error) throw error;
            return res(200, { ok:true, favored:true });
        }
    }catch(e){
        return res(500, { ok:false, error:String(e) });
    }
}

function res(code, body){
    return {
        statusCode: code,
        headers: { 'content-type':'application/json; charset=utf-8' },
        body: JSON.stringify(body)
    };
}
