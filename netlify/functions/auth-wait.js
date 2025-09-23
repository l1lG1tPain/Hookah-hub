// netlify/functions/auth-wait.js
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

function resp(status, body) {
    return {
        statusCode: status,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    };
}

export const handler = async (event) => {
    try {
        const { state } = event.queryStringParameters || {};
        if (!state) return resp(400, { ok: false, error: 'no_state' });

        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE;
        if (!url || !key) {
            console.error('auth-wait: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE');
            return resp(500, { ok: false, error: 'srv_env_missing' });
        }

        const supabase = createClient(url, key);

        // 1) запись о логине
        const { data: st, error: stErr } = await supabase
            .from('login_states')
            .select('*')
            .eq('state', state)
            .maybeSingle();

        if (stErr) {
            console.error('auth-wait: login_states select error', stErr);
            return resp(500, { ok: false, error: 'db_login_states', details: stErr.message || String(stErr) });
        }
        if (!st) return resp(404, { ok: false, error: 'state_not_found' });

        // TTL 10 минут (если есть created_at)
        const createdMs = st.created_at ? new Date(st.created_at).getTime() : null;
        const isExpiredByTime = createdMs ? (Date.now() - createdMs > 10 * 60 * 1000) : false;
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
        if (uErr) {
            console.error('auth-wait: users select error', uErr);
            return resp(500, { ok: false, error: 'db_users', details: uErr.message || String(uErr) });
        }
        if (!user) return resp(200, { ok: false, error: 'user_not_found' });

        // 3) создадим сессию (opaque token), 30 дней
        const token = crypto.randomBytes(24).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const { error: sErr } = await supabase
            .from('sessions')
            .insert({ token, user_id: user.id, expires_at: expiresAt });

        if (sErr) {
            console.error('auth-wait: sessions insert error', sErr);
            return resp(500, { ok: false, error: 'db_sessions', details: sErr.message || String(sErr) });
        }

        // 4) погасим state, чтобы не переиспользовали
        await supabase.from('login_states').update({ status: 'consumed' }).eq('state', state);

        // 5) фронту отдаём РОВНО то, что он ждёт
        return resp(200, { ok: true, status: 'ok', session: token });
    } catch (e) {
        console.error('auth-wait fatal', e);
        return resp(500, { ok: false, error: 'fatal', details: e?.message || String(e) });
    }
};
