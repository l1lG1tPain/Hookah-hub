import { createClient } from '@supabase/supabase-js';
const supabaseAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export const handler = async (event) => {
    try {
        const url = new URL(event.rawUrl);
        const type = url.searchParams.get('type') || 'mixes'; // mixes|tobaccos
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50',10), 100);

        let q = type === 'tobaccos'
            ? supabaseAnon.from('tobaccos').select('*').order('created_at', { ascending:false }).limit(limit)
            : supabaseAnon.from('mixes').select('*').eq('is_published', true).order('created_at', { ascending:false }).limit(limit);

        const { data, error } = await q;
        if (error) throw error;

        return { statusCode: 200, body: JSON.stringify({ ok: true, items: data }) };
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
    }
};
