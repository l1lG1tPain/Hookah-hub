// По пятницам: «Новое в каталоге», если за неделю добавились табаки
import { init, send, SITE } from './_lib/push.js';

export default async () => {
    const db = init();
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    const { count } = await db.from('tobaccos').select('id', { count: 'exact', head: true }).gt('created_at', since);
    if (!count) return;
    const { data: subs } = await db.from('push_subscriptions').select('*').eq('notify_news', true);
    const word = count % 10 === 1 && count % 100 !== 11 ? 'новый табак' : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? 'новых табака' : 'новых табаков';
    const payload = { title: 'Новое в каталоге', body: `За неделю добавили ${count} ${word}. Загляните!`, url: `${SITE}/#/`, tag: 'news' };
    let sent = 0;
    for (const s of subs || []) if (await send(db, s, payload)) sent++;
    console.log('push-news sent', sent);
};

export const config = { schedule: '0 15 * * 5' };
