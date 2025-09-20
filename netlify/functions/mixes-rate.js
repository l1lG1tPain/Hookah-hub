import { createClient } from '@supabase/supabase-js';
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

export const handler = async (event) => {
    try {
        const tgId = event.headers['x-tg-id'];
        if (!tgId) return { statusCode: 401, body: JSON.stringify({ ok:false, error:'unauthorized' }) };
        const { mix_id, score } = JSON.parse(event.body || '{}');
        if (!mix_id || ![1,2,3,4,5].includes(Number(score))) {
            return { statusCode: 400, body: JSON.stringify({ ok:false, error:'bad payload' }) };
        }
        const { data: user } = await supa.from('users').select('id').eq('tg_id', tgId).single();
        if (!user) return { statusCode: 404, body: JSON.stringify({ ok:false, error:'user not found' }) };

        const { error } = await supa.from('mix_ratings')
            .upsert({ mix_id, user_id: user.id, score: Number(score) }, { onConflict: 'mix_id,user_id' });
        if (error) throw error;

        return { statusCode: 200, body: JSON.stringify({ ok:true }) };
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ ok:false, error:String(e) }) };
    }
};
