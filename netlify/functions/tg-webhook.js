// netlify/functions/tg-webhook.js
// ESM-функция Netlify

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TG_FILE = `https://api.telegram.org/file/bot${BOT_TOKEN}`;
const BRAND = '🦈 Hookah Hub';
const APP_URL = process.env.PUBLIC_BASE_URL || 'https://hookahhub.netlify.app';
const PROFILE_URL = `${APP_URL}/#/profile`;
const BUCKET = 'images'; // бакет для аватаров

/** Отправка сообщения (HTML) */
async function sendMessage(chatId, html, opts = {}) {
    try {
        const payload = {
            chat_id: chatId,
            text: html,
            parse_mode: 'HTML',
            ...opts,
        };
        await fetch(`${TG_API}/sendMessage`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch {
        // глушим — телеге ок отвечать 200, чтобы не было ретраев
    }
}

/** Простая «обёртка» над методами Telegram API */
async function tg(method, body) {
    const res = await fetch(`${TG_API}/${method}`, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
}

/** Скачивает фото профиля через Telegram API и кладёт в Supabase Storage; возвращает public URL или null */
async function fetchAvatarAndStore(tgId) {
    // 1) есть ли фото профиля
    const photos = await tg('getUserProfilePhotos', { user_id: tgId, limit: 1 });
    if (!photos?.ok || photos.result.total_count === 0) return null;

    // 2) берём самую большую версию
    const sizes = photos.result.photos[0];
    const biggest = sizes[sizes.length - 1];
    const fileInfo = await tg('getFile', { file_id: biggest.file_id });
    if (!fileInfo?.ok) return null;

    const filePath = fileInfo.result.file_path;
    const imgRes = await fetch(`${TG_FILE}/${filePath}`);
    if (!imgRes.ok) return null;

    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const path = `avatars/${tgId}.jpg`;

    // удалим старый (если был) и зальём новый
    try { await supabase.storage.from(BUCKET).remove([path]); } catch {}
    const up = await supabase.storage.from(BUCKET).upload(path, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
    });
    if (up.error) return null;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
}

/** Обрабатывает deep-link: /start login_<state> */
async function handleLoginStart(msg, state) {
    const chatId = msg.chat.id;
    const tg = msg.from; // {id, first_name, username, ...}
    const tgId = tg.id;

    // 1) проверим state
    const { data: login, error: e1 } = await supabase
        .from('login_states')
        .select('*')
        .eq('state', state)
        .single();

    if (e1 || !login || login.status !== 'new') {
        await sendMessage(
            chatId,
            `${BRAND}\n\n❌ Сессия не найдена или уже использована.\n\nОткрой профиль на сайте и начни вход заново:\n${PROFILE_URL}`,
            {
                reply_markup: {
                    inline_keyboard: [[{ text: 'Открыть профиль', url: PROFILE_URL }]],
                },
            }
        );
        return 'invalid';
    }

    // 2) апсерт пользователя (+ попробуем подтянуть аватар)
    const name = tg.first_name || tg.username || `user_${tgId}`;

    // если в users нет аватара, подтянем
    let avatarUrl = null;
    try {
        const existing = await supabase
            .from('users')
            .select('id, avatar_url')
            .eq('tg_id', tgId)
            .maybeSingle();
        if (!existing.data || !existing.data.avatar_url) {
            avatarUrl = await fetchAvatarAndStore(tgId);
        } else {
            avatarUrl = existing.data.avatar_url;
        }
    } catch {
        // игнор
    }

    const { data: user, error: e2 } = await supabase
        .from('users')
        .upsert(
            { tg_id: tgId, name, avatar_url: avatarUrl ?? null },
            { onConflict: 'tg_id' }
        )
        .select()
        .single();
    if (e2) {
        await sendMessage(chatId, `${BRAND}\n\n⚠️ Внутренняя ошибка. Попробуйте ещё раз позже.`);
        return 'error';
    }

    // 3) отмечаем state = ok
    await supabase
        .from('login_states')
        .update({ tg_id: tgId, user_id: user.id, status: 'ok' })
        .eq('state', state);

    // 4) красиво ответим
    await sendMessage(
        chatId,
        `${BRAND}\n\n✅ <b>Вход выполнен</b>\n\nМожете вернуться в браузер — профиль уже разблокирован.`,
        {
            reply_markup: {
                inline_keyboard: [[{ text: 'Открыть профиль', url: PROFILE_URL }]],
            },
        }
    );

    return 'ok';
}

/** Ответ на простой /start (без payload) */
async function handleStartPlain(msg) {
    const chatId = msg.chat.id;
    await sendMessage(
        chatId,
        `${BRAND}\n\nПривет! Я помогу войти в приложение и сохранять ваши миксы.\n\n` +
        `Чтобы войти:\n1) Откройте профиль на сайте\n2) Нажмите «Открыть в Telegram»\n3) Подтвердите вход здесь\n\n` +
        `После подтверждения вернитесь в браузер — вы будете залогинены.`,
        {
            reply_markup: {
                inline_keyboard: [[{ text: 'Открыть профиль', url: PROFILE_URL }]],
            },
        }
    );
}

/** /help */
async function handleHelp(msg) {
    const chatId = msg.chat.id;
    await sendMessage(
        chatId,
        `${BRAND}\n\n<b>Помощь</b>\n\n` +
        `• Вход в приложение — через кнопку «Открыть в Telegram» на странице профиля\n` +
        `• Избранное и оценки — в приложении\n` +
        `• Вопросы/идеи — смело пишите разработчику 👨‍💻`,
        {
            reply_markup: {
                inline_keyboard: [[{ text: 'Открыть профиль', url: PROFILE_URL }]],
            },
        }
    );
}

export const handler = async (event) => {
    try {
        // (Опционально) жёсткая проверка секрета вебхука
        const secret = process.env.TG_WEBHOOK_SECRET;
        if (secret) {
            const got = event.headers['x-telegram-bot-api-secret-token'];
            if (got !== secret) {
                // неправильный секрет — молча отвечаем 200 (чтобы Телега не ретраила), но игнорим
                return { statusCode: 200, body: 'ok' };
            }
        }

        if (event.httpMethod !== 'POST') {
            // Telegram иногда дергает GET/HEAD-healthcheck — просто ответим ok
            return { statusCode: 200, body: 'ok' };
        }

        const update = JSON.parse(event.body || '{}');
        const msg = update.message || update.edited_message;
        if (!msg || !msg.text) {
            // неинтересные апдейты игнорим
            return { statusCode: 200, body: 'ok' };
        }

        const raw = msg.text.trim();
        const [cmd, payload] = raw.split(/\s+/, 2);

        // /start с deep-link
        if (cmd === '/start' && payload?.startsWith('login_')) {
            const state = payload.slice('login_'.length);
            await handleLoginStart(msg, state);
            return { statusCode: 200, body: 'ok' };
        }

        // простой /start
        if (cmd === '/start') {
            await handleStartPlain(msg);
            return { statusCode: 200, body: 'ok' };
        }

        // /help
        if (cmd === '/help') {
            await handleHelp(msg);
            return { statusCode: 200, body: 'ok' };
        }

        // дефолтный ответ на всё остальное
        await sendMessage(
            msg.chat.id,
            `${BRAND}\n\nЯ сейчас отвечаю только на команды:\n` +
            `• /start — начать\n` +
            `• /help — помощь\n\n` +
            `Чтобы войти — откройте профиль на сайте.`,
            {
                reply_markup: {
                    inline_keyboard: [[{ text: 'Открыть профиль', url: PROFILE_URL }]],
                },
            }
        );

        return { statusCode: 200, body: 'ok' };
    } catch {
        // Всегда 200, чтобы Telegram не ретраил; логи смотри в Netlify → Functions → Logs
        return { statusCode: 200, body: 'ok' };
    }
};
