// netlify/functions/tg-webhook.js
// ESM-функция Netlify

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TG_FILE = `https://api.telegram.org/file/bot${BOT_TOKEN}`;
const BRAND = '🦈 Hookah Hub';
const BUCKET = 'images'; // бакет для аватаров

/** Получаем origin сайта из входящего запроса (без env c публичным URL) */
function getSiteOrigin(event) {
    try {
        const u = new URL(event.rawUrl);
        return u.origin.replace(/\/$/, '');
    } catch {
        // Netlify автоматически прокидывает URL деплоя в эти переменные
        const fallback = (process.env.URL || process.env.DEPLOY_URL || '').replace(/\/$/, '');
        return fallback || ''; // если пусто — кнопка всё равно отработает, просто без URL
    }
}

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
    } catch { /* глушим — отвечаем 200, чтобы Телега не ретраила */ }
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
    const photos = await tg('getUserProfilePhotos', { user_id: tgId, limit: 1 });
    if (!photos?.ok || photos.result.total_count === 0) return null;

    const sizes = photos.result.photos[0];
    const biggest = sizes[sizes.length - 1];
    const fileInfo = await tg('getFile', { file_id: biggest.file_id });
    if (!fileInfo?.ok) return null;

    const filePath = fileInfo.result.file_path;
    const imgRes = await fetch(`${TG_FILE}/${filePath}`);
    if (!imgRes.ok) return null;

    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const path = `avatars/${tgId}.jpg`;

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
async function handleLoginStart(msg, state, profileUrl) {
    const chatId = msg.chat.id;
    const tg = msg.from;
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
            `${BRAND}\n\n❌ Сессия не найдена или уже использована.\n\nОткрой профиль на сайте и начни вход заново:`,
            profileUrl
                ? { reply_markup: { inline_keyboard: [[{ text: 'Открыть профиль', url: profileUrl }]] } }
                : undefined
        );
        return 'invalid';
    }

    // 2) находим или создаём профиль (имя, выбранное в приложении, не перетираем)
    const name = [tg.first_name, tg.last_name].filter(Boolean).join(' ') || tg.username || `user_${tgId}`;
    let user = null;
    try {
        const { data: existing } = await supabase
            .from('users').select('id, avatar_url').eq('tg_id', tgId).maybeSingle();
        if (existing) {
            user = existing;
            if (!existing.avatar_url) {
                const avatarUrl = await fetchAvatarAndStore(tgId).catch(() => null);
                if (avatarUrl) await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', existing.id);
            }
        } else {
            const avatarUrl = await fetchAvatarAndStore(tgId).catch(() => null);
            const { data: created, error } = await supabase
                .from('users')
                .insert({ tg_id: tgId, name, avatar_url: avatarUrl, provider: 'telegram' })
                .select('id').single();
            if (error) throw error;
            user = created;
        }
    } catch (e) {
        console.error('tg-webhook user upsert', e);
    }

    if (!user) {
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
        profileUrl
            ? { reply_markup: { inline_keyboard: [[{ text: 'Открыть профиль', url: profileUrl }]] } }
            : undefined
    );

    return 'ok';
}

/** Ответ на простой /start (без payload) */
async function handleStartPlain(msg, profileUrl) {
    const chatId = msg.chat.id;
    await sendMessage(
        chatId,
        `${BRAND}\n\nПривет! Я помогу войти в приложение и сохранять ваши миксы.\n\n` +
        `Чтобы войти:\n1) Откройте профиль на сайте\n2) Нажмите «Войти через Telegram»\n3) Подтвердите вход здесь\n\n` +
        `После подтверждения вернитесь в браузер — вы будете залогинены.`,
        profileUrl
            ? { reply_markup: { inline_keyboard: [[{ text: 'Открыть профиль', url: profileUrl }]] } }
            : undefined
    );
}

/** /help */
async function handleHelp(msg, profileUrl) {
    const chatId = msg.chat.id;
    await sendMessage(
        chatId,
        `${BRAND}\n\n<b>Помощь</b>\n\n` +
        `• Вход в приложение — через кнопку «Войти через Telegram» на странице профиля\n` +
        `• Избранное и оценки — в приложении\n` +
        `• Вопросы/идеи — смело пишите разработчику 👨‍💻`,
        profileUrl
            ? { reply_markup: { inline_keyboard: [[{ text: 'Открыть профиль', url: profileUrl }]] } }
            : undefined
    );
}

export const handler = async (event) => {
    try {
        // (Опционально) жёсткая проверка секрета вебхука
        const secret = process.env.TG_WEBHOOK_SECRET;
        if (secret) {
            const got = event.headers['x-telegram-bot-api-secret-token'];
            if (got !== secret) return { statusCode: 200, body: 'ok' };
        }

        if (event.httpMethod !== 'POST') {
            return { statusCode: 200, body: 'ok' };
        }

        const origin = getSiteOrigin(event);
        const profileUrl = origin ? `${origin}/#/profile` : null;

        const update = JSON.parse(event.body || '{}');
        const msg = update.message || update.edited_message;
        if (!msg || !msg.text) return { statusCode: 200, body: 'ok' };

        const raw = msg.text.trim();
        const [cmd, payload] = raw.split(/\s+/, 2);

        if (cmd === '/start' && payload?.startsWith('login_')) {
            const state = payload.slice('login_'.length);
            await handleLoginStart(msg, state, profileUrl);
            return { statusCode: 200, body: 'ok' };
        }

        if (cmd === '/start') {
            await handleStartPlain(msg, profileUrl);
            return { statusCode: 200, body: 'ok' };
        }

        if (cmd === '/help') {
            await handleHelp(msg, profileUrl);
            return { statusCode: 200, body: 'ok' };
        }

        await sendMessage(
            msg.chat.id,
            `${BRAND}\n\nЯ сейчас отвечаю только на команды:\n` +
            `• /start — начать\n` +
            `• /help — помощь\n\n` +
            `Чтобы войти — откройте профиль на сайте.`,
            profileUrl
                ? { reply_markup: { inline_keyboard: [[{ text: 'Открыть профиль', url: profileUrl }]] } }
                : undefined
        );

        return { statusCode: 200, body: 'ok' };
    } catch {
        return { statusCode: 200, body: 'ok' };
    }
};
