import { createClient } from '@supabase/supabase-js';
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

export const handler = async (event) => {
    try {
        const url = new URL(event.rawUrl);
        const state = url.searchParams.get('state');
        if (!state) return { statusCode: 400, body: JSON.stringify({ ok:false, error:'state required' }) };

        const { data: row } = await supa.from('login_states').select('*').eq('state', state).single();
        if (!row) return { statusCode: 404, body: JSON.stringify({ ok:false, error:'not found' }) };

        if (row.status === 'ok' && row.user_id) {
            const { data: user } = await supa.from('users').select('*').eq('id', row.user_id).single();
            return { statusCode: 200, body: JSON.stringify({ ok:true, user }) };
        }
        return { statusCode: 200, body: JSON.stringify({ ok:false, pending:true }) };
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ ok:false, error:String(e) }) };
    }
};
