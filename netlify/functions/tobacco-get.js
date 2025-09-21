// netlify/functions/tobacco-get.js
import { createClient } from '@supabase/supabase-js';

export const handler = async (event) => {
    try {
        const { id } = event.queryStringParameters || {};
        if (!id) return resp(400, { ok:false, error: 'no id' });

        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

        // читаем из tobaccos_api (уже с рейтингами)
        const { data, error } = await supabase
            .from('tobaccos_api')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        if (!data) return resp(404, { ok:false, error: 'not found' });

        // Нормализуем под фронт
        const tobacco = {
            id: data.id,
            name: data.name,
            cover_url: data.cover_url,
            tags: data.tags || [],
            brand_name: data.brand_name || null,
            ratings: {
                votes: data.votes || 0,
                excellent: data.excellent || 0,
                good: data.good || 0,
                ok: data.ok || 0,
                bad: data.bad || 0,
                notgood: data.notgood || 0,
                avg_score: data.avg_score ?? null
            }
        };

        return resp(200, tobacco);
    } catch (e) {
        console.error('tobacco-get error', e);
        return resp(500, { ok:false, error: 'internal' });
    }
};

function resp(status, body){
    return { statusCode: status, headers: { 'content-type':'application/json' }, body: JSON.stringify(body) };
}
