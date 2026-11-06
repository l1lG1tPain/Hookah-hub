// Встроенные данные для демо-режима (без Supabase)
const T = (id, name, brand, tags, d) => ({ id, name, brand_name: brand, cover_url: null, tags, created_at: `2026-10-${String(30 - id.length).padStart(2, '0')}`, ...dist(d) });
function dist([e, g, o, b, n]) {
    const votes = e + g + o + b + n;
    const avg = votes ? (5 * e + 4 * g + 3 * o + 2 * b + n) / votes : null;
    return { votes, excellent: e, good: g, ok: o, bad: b, notgood: n, avg_score: avg };
}

export const demoTobaccos = [
    T('t1', 'Pinkman', 'Darkside', ['ягодный', 'кислосладкий'], [42, 18, 6, 2, 1]),
    T('t2', 'Supernova', 'Darkside', ['мятный', 'свежий'], [30, 22, 10, 3, 2]),
    T('t3', 'Lemon Pie', 'Musthave', ['цитрус', 'сладкий'], [25, 20, 5, 1, 0]),
    T('t4', 'Pineapple Rings', 'Musthave', ['ананасовый', 'сладкий'], [19, 15, 9, 2, 1]),
    T('t5', 'Green Apple', 'Black Burn', ['яблочный', 'кислый'], [11, 14, 8, 4, 2]),
    T('t6', 'Red Tea', 'Element', ['табачный', 'пряный'], [8, 12, 11, 3, 1]),
    T('t7', 'Grape Core', 'Sebero', ['ягодный', 'сладкий'], [14, 9, 4, 1, 0]),
    T('t8', 'Ice Baby', 'Black Burn', ['мятный', 'свежий'], [6, 10, 7, 5, 3]),
];

const M = (id, title, tags, description, ing, d, days) => ({
    id, title, image_url: null, taste_tags: tags, description, is_published: true,
    created_at: new Date(Date.now() - days * 864e5).toISOString(),
    ingredients: ing.map(([brand, tobacco, percent], pos) => ({ brand, tobacco, percent, pos })),
    ...dist(d),
});

export const demoMixes = [
    M('m1', 'Розовый лимонад', ['кислосладкий', 'ягодный', 'свежий'],
        'Яркий летний микс: ягодная кислинка Pinkman, лимонный десерт и лёгкий холодок. Отлично заходит в компании.',
        [['Darkside', 'Pinkman', 50], ['Musthave', 'Lemon Pie', 30], ['Darkside', 'Supernova', 20]], [58, 21, 6, 2, 1], 2),
    M('m2', 'Тропический ветер', ['ананасовый', 'фруктовый', 'сладкий'],
        'Сочный ананас с виноградом, без холода — для тех, кто любит чистый фруктовый вкус.',
        [['Musthave', 'Pineapple Rings', 60], ['Sebero', 'Grape Core', 40]], [31, 18, 8, 2, 0], 5),
    M('m3', 'Пряный чай', ['пряный', 'табачный'],
        'Вечерний микс с чайными и пряными нотами. Плотный, согревающий, с табачным характером.',
        [['Element', 'Red Tea', 70], ['Black Burn', 'Green Apple', 30]], [12, 15, 9, 3, 1], 9),
    M('m4', 'Ледяное яблоко', ['яблочный', 'мятный', 'свежий'],
        'Зелёное яблоко и мощный холод. Классика, которая не надоедает.',
        [['Black Burn', 'Green Apple', 55], ['Black Burn', 'Ice Baby', 25], ['Darkside', 'Supernova', 20]], [22, 25, 12, 4, 2], 1),
    M('m5', 'Цитрусовый взрыв', ['цитрус', 'кислый'],
        'Кисло, бодро, громко. Лимон и холод в равных пропорциях.',
        [['Musthave', 'Lemon Pie', 50], ['Darkside', 'Supernova', 50]], [9, 8, 7, 4, 3], 14),
    M('m6', 'Виноградная ночь', ['ягодный', 'сладкий'],
        'Насыщенный виноград с лёгкой ягодной подложкой.',
        [['Sebero', 'Grape Core', 70], ['Darkside', 'Pinkman', 30]], [4, 6, 2, 1, 0], 20),
];
