// netlify/functions/whoami.js
import { createClient } from '@supabase/supabase-js';

export const handler = async (event) => {
    try {
        const token = event.headers['x-session'] || event.headers['X-Session'];
        if (!token) return json(401, { ok: false });

        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

        // валидируем токен
        const { data: sess, error: sErr } = await supabase
            .from('sessions')
            .select('user_id, expires_at')
            .eq('token', token)
            .maybeSingle();
        if (sErr || !sess) return json(401, { ok: false });

        if (new Date(sess.expires_at).getTime() < Date.now()) {
            return json(401, { ok: false });
        }

        // отдаём safe-профиль
        const { data: user, error: uErr } = await supabase
            .from('users')
            .select('id, name, avatar_url')
            .eq('id', sess.user_id)
            .single();
        if (uErr || !user) return json(401, { ok: false });

        // короткий публичный id (можешь хранить предрассчитанный short_id в таблице)
        const short = (user.id || '').toString().slice(-6);
        return json(200, { ok: true, user: { id: user.id, short, name: user.name, avatar_url: user.avatar_url } });
    } catch (e) {
        return json(500, { ok: false });
    }
};

function json(status, body) {
    return { statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
