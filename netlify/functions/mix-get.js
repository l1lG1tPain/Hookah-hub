import { createClient } from '@supabase/supabase-js';
const supaAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export const handler = async (event) => {
    try {
        const id = new URL(event.rawUrl).searchParams.get('id');
        if (!id) return { statusCode: 400, body: JSON.stringify({ ok:false, error:'id required' }) };

        const { data: mix, error } = await supaAnon
            .from('mixes').select('*').eq('id', id).single();
        if (error || !mix) return { statusCode: 404, body: JSON.stringify({ ok:false, error:'not found' }) };

        const { data: ingredients } = await supaAnon
            .from('mix_ingredients')
            .select('percent, custom_title, tobaccos(name:tobacco_name, brands(name:brand_name))')
            .eq('mix_id', id).order('pos', { ascending:true });

        const norm = (ingredients||[]).map(r => ({
            percent: r.percent,
            custom_title: r.custom_title,
            tobacco_name: r?.tobaccos?.name || null,
            brand_name: r?.tobaccos?.brands?.name || null
        }));

        const { data: agg } = await supaAnon.rpc('mix_rating_aggregate', { p_mix_id: id }).single().catch(()=>({ data:null }));
        // ↑ сделай SQL-функцию/вьюху позже; временно можно вернуть пустые счётчики

        return { statusCode: 200, body: JSON.stringify({ ok:true, mix: { ...mix, ingredients: norm }, ratings: agg || {} }) };
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ ok:false, error:String(e) }) };
    }
};
