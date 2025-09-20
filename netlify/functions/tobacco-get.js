import { createClient } from '@supabase/supabase-js';
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

export async function handler(event) {
    try {
        const id = (event.queryStringParameters?.id || '').trim();
        if (!id) return { statusCode: 400, body: 'id required' };

        const { data, error } = await supa.from('tobaccos_api').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        if (!data) return { statusCode: 404, body: 'not found' };

        return { statusCode: 200, headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(data) };
    } catch (e) {
        return { statusCode: 500, body: String(e) };
    }
}
