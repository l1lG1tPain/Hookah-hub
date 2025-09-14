import { createClient } from '@supabase/supabase-js';

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendMessage(chatId, text){
    try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text })
        });
    } catch {}
}

export const handler = async (event) => {
    try {
        const update = JSON.parse(event.body || '{}');
        const msg = update.message;
        if (!msg || !msg.text) return { statusCode: 200, body: 'ok' };

        // /start login_<state>
        const parts = msg.text.trim().split(' ');
        if (!parts[0].startsWith('/start') || !parts[1]?.startsWith('login_')) {
            return { statusCode: 200, body: 'ignored' };
        }

        const state = parts[1].slice('login_'.length);
        const tg = msg.from; // {id, first_name, username, ...}

        // есть ли такой state в БД?
        const { data: login, error: e1 } = await supa
            .from('login_states')
            .select('*').eq('state', state).single();
        if (e1 || !login || login.status !== 'new') {
            await sendMessage(msg.chat.id, 'Сессия не найдена или уже использована.');
            return { statusCode: 200, body: 'invalid' };
        }

        // upsert пользователя
        const name = tg.first_name || tg.username || `user_${tg.id}`;
        const { data: user, error: e2 } = await supa
            .from('users')
            .upsert({ tg_id: tg.id, name }, { onConflict: 'tg_id' })
            .select().single();
        if (e2) throw e2;

        // пометим state как ok
        await supa
            .from('login_states')
            .update({ tg_id: tg.id, user_id: user.id, status: 'ok' })
            .eq('state', state);

        await sendMessage(msg.chat.id, 'Готово! Вернись в браузер — ты вошёл 👌');
        return { statusCode: 200, body: 'ok' };
    } catch (e) {
        return { statusCode: 200, body: 'ok' }; // чтобы Telegram не спамил ретраями
    }
};
