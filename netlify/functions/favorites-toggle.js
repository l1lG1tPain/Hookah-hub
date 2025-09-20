import { createClient } from '@supabase/supabase-js';
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

export const handler = async (event) => {
    try {
        const tgId = event.headers['x-tg-id'];
        if (!tgId) return { statusCode: 401, body: JSON.stringify({ ok:false, error:'unauthorized' }) };
        const { mix_id, tobacco_id } = JSON.parse(event.body || '{}');

        const isMix = !!mix_id, isTobacco = !!tobacco_id;
        if (!(isMix ^ isTobacco)) return { statusCode: 400, body: JSON.stringify({ ok:false, error:'specify mix_id OR tobacco_id' }) };

        const { data: user } = await supa.from('users').select('id').eq('tg_id', tgId).single();
        if (!user) return { statusCode: 404, body: JSON.stringify({ ok:false, error:'user not found' }) };

        const item_type = isMix ? 'mix' : 'tobacco';
        const item_id   = isMix ? mix_id : tobacco_id;

        // попытаемся удалить; если не было — вставим
        const del = await supa.from('favorites').delete()
            .eq('user_id', user.id).eq('item_type', item_type).eq('item_id', item_id).select();
        if (del.error) throw del.error;

        if (!del.data?.length) {
            const ins = await supa.from('favorites').insert({ user_id: user.id, item_type, item_id }).select();
            if (ins.error) throw ins.error;
            return { statusCode: 200, body: JSON.stringify({ ok:true, fav:true }) };
        }
        return { statusCode: 200, body: JSON.stringify({ ok:true, fav:false }) };
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ ok:false, error:String(e) }) };
    }
};
