// netlify/functions/profile-name-change.js
import { createClient } from '@supabase/supabase-js';

export const handler = async (event) => {
    try {
        if (event.httpMethod !== 'POST') return json(405, { ok: false });

        const token = event.headers['x-session'] || event.headers['X-Session'];
        if (!token) return json(401, { ok: false });

        const { name } = JSON.parse(event.body || '{}');
        if (!name || String(name).trim().length < 2) return json(400, { ok: false, error: 'bad name' });

        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

        const { data: sess } = await supabase
            .from('sessions')
            .select('user_id, expires_at')
            .eq('token', token)
            .maybeSingle();
        if (!sess || new Date(sess.expires_at).getTime() < Date.now()) return json(401, { ok: false });

        const { error: uErr } = await supabase
            .from('users')
            .update({ name: String(name).trim() })
            .eq('id', sess.user_id);
        if (uErr) return json(500, { ok: false });

        return json(200, { ok: true });
    } catch {
        return json(500, { ok: false });
    }
};

function json(status, body) {
    return { statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
