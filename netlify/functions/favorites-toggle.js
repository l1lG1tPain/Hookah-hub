// netlify/functions/favorites-toggle.js
import { createClient } from '@supabase/supabase-js';
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

async function getUserId(event) {
    const session = event.headers['x-session'];
    if (session) {
        const { data, error } = await supa
            .from('sessions')
            .select('user_id')
            .eq('token', session)
            .maybeSingle();
        if (data?.user_id) return data.user_id;
    }
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
        if (event.httpMethod !== 'POST') return res(405, { ok:false, error:'method not allowed' });

        const userId = await getUserId(event);
        if (!userId) return res(401, { ok:false, error:'unauthorized' });

        const { item_type, item_id } = JSON.parse(event.body || '{}');
        if (!['mix','tobacco'].includes(item_type) || !item_id) {
            return res(400, { ok:false, error:'bad payload' });
        }

        const { data: exists, error: e1 } = await supa
            .from('favorites')
            .select('user_id')
            .eq('user_id', userId)
            .eq('item_type', item_type)
            .eq('item_id', item_id)
            .maybeSingle();
        if (e1) throw e1;

        if (exists){
            const { error } = await supa
                .from('favorites')
                .delete()
                .eq('user_id', userId)
                .eq('item_type', item_type)
                .eq('item_id', item_id);
            if (error) throw error;
            return res(200, { ok:true, favored:false });
        } else {
            const { error } = await supa
                .from('favorites')
                .insert({ user_id: userId, item_type, item_id });
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
