// netlify/functions/profile-name-change.js
import { createClient } from '@supabase/supabase-js';
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

export const handler = async (event) => {
    try {
        const tgId = event.headers['x-tg-id'];
        if (!tgId) return { statusCode: 401, body: JSON.stringify({ ok:false, error:'unauthorized' }) };
        const { name } = JSON.parse(event.body || '{}');
        if (!name || name.trim().length < 2) return { statusCode: 400, body: JSON.stringify({ ok:false, error:'bad name' }) };

        const { data: u } = await supa.from('users').select('*').eq('tg_id', tgId).single();
        if (!u) return { statusCode: 404, body: JSON.stringify({ ok:false, error:'user not found' }) };
        if (u.name_changed) return { statusCode: 400, body: JSON.stringify({ ok:false, error:'already changed' }) };

        const { data, error } = await supa.from('users').update({ name, name_changed: true }).eq('tg_id', tgId).select().single();
        if (error) throw error;

        return { statusCode: 200, body: JSON.stringify({ ok:true, user: data }) };
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ ok:false, error:String(e) }) };
    }
};
