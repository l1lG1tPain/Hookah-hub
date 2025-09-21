// netlify/functions/auth-wait.js
import { createClient } from '@supabase/supabase-js';

export const handler = async (event) => {
    try {
        const { state } = event.queryStringParameters || {};
        if (!state) return resp(400, { ok: false, error: 'no state' });

        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

        // 1) забираем запись
        const { data: st, error: stErr } = await supabase
            .from('login_states')
            .select('*')
            .eq('state', state)
            .maybeSingle();

        if (stErr) throw stErr;
        if (!st) return resp(404, { ok: false, error: 'not found' });

        // протухание (например, 10 минут)
        const isExpiredByTime = Date.now() - new Date(st.created_at).getTime() > 10 * 60 * 1000;
        if (st.status === 'new' && isExpiredByTime) {
            await supabase.from('login_states').update({ status: 'expired' }).eq('state', state);
            return resp(200, { ok: false, error: 'expired' });
        }

        if (st.status !== 'ok') {
            // ещё не подтвердили
            return resp(200, { ok: false, wait: true });
        }

        // 2) статус ok → достаём пользователя
        const { data: user, error: uErr } = await supabase
            .from('users')
            .select('id, tg_id, name, avatar_url')
            .eq('id', st.user_id)
            .maybeSingle();

        if (uErr) throw uErr;
        if (!user) return resp(200, { ok: false, error: 'user not found' });

        return resp(200, { ok: true, user });
    } catch (e) {
        console.error('auth-wait error', e);
        return resp(500, { ok: false, error: 'internal' });
    }
};

function resp(status, body) {
    return { statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
