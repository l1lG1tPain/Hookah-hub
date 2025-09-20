import { createClient } from '@supabase/supabase-js';
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

// 5..1 → excellent..notgood
const MAP = { 5: 'excellent', 4: 'good', 3: 'ok', 2: 'bad', 1: 'notgood' };

export async function handler(event) {
    try {
        if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

        const tgId = event.headers['x-tg-id'];
        if (!tgId) return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'unauthorized' }) };

        const { mix_id, score } = JSON.parse(event.body || '{}');
        const s = MAP[Number(score)];
        if (!mix_id || !s) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'bad payload' }) };

        const { data: user } = await supa.from('users').select('id').eq('tg_id', tgId).maybeSingle();
        if (!user) return { statusCode: 404, body: JSON.stringify({ ok: false, error: 'user not found' }) };

        const { error } = await supa
            .from('mix_ratings')
            .upsert({ mix_id, user_id: user.id, score: s }, { onConflict: 'mix_id,user_id' });

        if (error) throw error;
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e) }) };
    }
}
