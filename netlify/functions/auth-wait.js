// netlify/functions/auth-wait.js
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

export const handler = async (event) => {
    try {
        const { state } = event.queryStringParameters || {};
        if (!state) return resp(400, { ok: false, error: 'no state' });

        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

        // 1) запись о логине
        const { data: st, error: stErr } = await supabase
            .from('login_states')
            .select('*')
            .eq('state', state)
            .maybeSingle();
        if (stErr) throw stErr;
        if (!st) return resp(404, { ok: false, error: 'not found' });

        // TTL 10 минут
        const isExpiredByTime = Date.now() - new Date(st.created_at).getTime() > 10 * 60 * 1000;
        if (st.status === 'new' && isExpiredByTime) {
            await supabase.from('login_states').update({ status: 'expired' }).eq('state', state);
            return resp(200, { ok: false, error: 'expired' });
        }

        if (st.status !== 'ok') {
            // ещё ждём подтверждение в Telegram
            return resp(200, { ok: false, wait: true });
        }

        // 2) найдём пользователя
        const { data: user, error: uErr } = await supabase
            .from('users')
            .select('id')
            .eq('id', st.user_id)
            .maybeSingle();
        if (uErr) throw uErr;
        if (!user) return resp(200, { ok: false, error: 'user not found' });

        // 3) создадим сессию (opaque token), 30 дней
        const token = crypto.randomBytes(24).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const { error: sErr } = await supabase
            .from('sessions')
            .insert({ token, user_id: user.id, expires_at: expiresAt });
        if (sErr) throw sErr;

        // опционально: погасим state, чтобы не переиспользовали
        await supabase.from('login_states').update({ status: 'consumed' }).eq('state', state);

        // 4) фронту отдаём РОВНО то, что он ждёт
        return resp(200, { ok: true, status: 'ok', session: token });
    } catch (e) {
        console.error('auth-wait error', e);
        return resp(500, { ok: false, error: 'internal' });
    }
};

function resp(status, body) {
    return { statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
