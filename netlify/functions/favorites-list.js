// netlify/functions/favorites-list.js
import { createClient } from '@supabase/supabase-js';
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

export const handler = async (event) => {
    try {
        const tgId = event.headers['x-tg-id'];
        if (!tgId) return { statusCode: 401, body: JSON.stringify({ ok:false, error:'unauthorized' }) };
        const { data: user } = await supa.from('users').select('id').eq('tg_id', tgId).single();
        if (!user) return { statusCode: 404, body: JSON.stringify({ ok:false, error:'user not found' }) };

        const { data, error } = await supa
            .from('favorites')
            .select('mixes(id,name,cover_url,tags)')
            .eq('user_id', user.id);
        if (error) throw error;

        const items = (data || []).map(r => r.mixes).filter(Boolean);
        return { statusCode: 200, body: JSON.stringify({ ok:true, items }) };
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ ok:false, error:String(e) }) };
    }
};
