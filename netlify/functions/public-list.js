import { createClient } from '@supabase/supabase-js';
const supabaseAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export const handler = async (event) => {
    try {
        const url = new URL(event.rawUrl);
        const type  = url.searchParams.get('type') || 'mixes'; // mixes|tobaccos
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50',10), 100);
        const q     = (url.searchParams.get('q') || '').trim();
        const brands= (url.searchParams.get('brands')||'').split(',').filter(Boolean);
        const tags  = (url.searchParams.get('tags')||'').split(',').filter(Boolean);
        const sort  = url.searchParams.get('sort') || 'new';  // new|top

        let query = (type === 'tobaccos')
            ? supabaseAnon.from('tobaccos').select('*')
            : supabaseAnon.from('mixes').select('*').eq('is_published', true);

        if (q) {
            // простая фильтрация по названию (потом можно расширить до полнотекстового)
            query = (type === 'tobaccos') ? query.ilike('name', `%${q}%`) : query.ilike('name', `%${q}%`);
        }
        if (brands.length) {
            query = (type === 'tobaccos')
                ? query.in('brand_id', brands)
                : query.in('author_id', brands); // при необходимости поменяешь поле под бренды в миксах
        }
        if (tags.length) {
            const arrayColumn = (type === 'tobaccos') ? 'taste_tags' : 'tags';
            query = query.contains(arrayColumn, tags);
        }
        if (sort === 'top') {
            // предполагается вьюха/колонка c score/votes (добавишь позже). Пока сортируем по created_at.
            query = query.order('created_at', { ascending:false });
        } else {
            query = query.order('created_at', { ascending:false });
        }

        const { data, error } = await query.limit(limit);
        if (error) throw error;

        return { statusCode: 200, body: JSON.stringify({ ok:true, items: data }) };
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ ok:false, error:String(e) }) };
    }
};
