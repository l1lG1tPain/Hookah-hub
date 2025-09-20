import { createClient } from '@supabase/supabase-js';
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

export async function handler(event) {
    try {
        const qp = event.queryStringParameters || {};
        const type = (qp.type || 'mixes').toLowerCase(); // 'mixes' | 'tobaccos'
        const q = (qp.q || '').trim();
        const brands = (qp.brands || '').split(',').map(s => s.trim()).filter(Boolean);
        const tags = (qp.tags || '').split(',').map(s => s.trim()).filter(Boolean);
        const sort = (qp.sort || 'new').toLowerCase(); // 'new' | 'top'
        const limit = Math.min(Number(qp.limit || 50), 100);

        if (type === 'mixes') {
            let req = supa.from('mixes_with_stats').select('*').eq('is_published', true);

            if (q) req = req.ilike('title', `%${q}%`);
            if (tags.length) req = req.contains('taste_tags', tags);

            if (sort === 'top') {
                req = req.order('votes', { ascending: false })
                    .order('avg_score', { ascending: false })
                    .order('created_at', { ascending: false });
            } else {
                req = req.order('created_at', { ascending: false });
            }

            req = req.limit(limit);
            const { data, error } = await req;
            if (error) throw error;

            const items = data.map(x => ({
                id: x.id,
                name: x.title,
                cover_url: x.image_url,
                tags: x.taste_tags || [],
                description: x.description || '',
                votes: x.votes || 0,
                avg_score: x.avg_score
            }));

            return ok(items);
        }

        // tobaccos
        let req = supa.from('tobaccos_api').select('*');
        if (q) req = req.ilike('name', `%${q}%`);
        if (brands.length) req = req.in('brand_name', brands);
        if (tags.length) req = req.contains('tags', tags);

        const { data, error } = await req.order('created_at', { ascending: false }).limit(limit);
        if (error) throw error;

        return ok(data);
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e) }) };
    }
}

function ok(items) {
    return {
        statusCode: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ ok: true, items })
    };
}
