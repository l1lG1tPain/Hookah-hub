// netlify/functions/tobaccos-rate.js
import { createClient } from '@supabase/supabase-js';

const ALLOWED = new Set(['excellent','good','ok','bad','notgood']);

export const handler = async (event) => {
    try {
        if (event.httpMethod !== 'POST') return resp(405, { ok:false });
        const tgId = event.headers['x-tg-id'];
        if (!tgId) return resp(401, { ok:false, error: 'auth' });

        const { tobacco_id, score } = JSON.parse(event.body || '{}');
        if (!tobacco_id || !ALLOWED.has(score)) return resp(400, { ok:false, error:'bad params' });

        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

        // найдём пользователя
        const { data: user } = await supabase.from('users').select('id').eq('tg_id', tgId).maybeSingle();
        if (!user) return resp(403, { ok:false, error: 'no user' });

        // upsert одна оценка на (tobacco_id, user_id)
        const { error: upErr } = await supabase
            .from('tobacco_ratings')
            .upsert({ tobacco_id, user_id: user.id, score }, { onConflict: 'tobacco_id,user_id' });

        if (upErr) throw upErr;

        // вернём свежую агрегацию
        const { data: agg, error: aggErr } = await supabase
            .from('tobaccos_api')
            .select('votes,excellent,good,ok,bad,notgood,avg_score')
            .eq('id', tobacco_id)
            .maybeSingle();

        if (aggErr) throw aggErr;

        return resp(200, { ok:true, ratings: agg });
    } catch (e) {
        console.error('tobaccos-rate error', e);
        return resp(500, { ok:false, error:'internal' });
    }
};

function resp(status, body){
    return { statusCode: status, headers: { 'content-type':'application/json' }, body: JSON.stringify(body) };
}
