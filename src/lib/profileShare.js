/* Шторка «Моя страница»: картинка-визитка со стильным QR, ссылка, «Поделиться» и «Скачать» */
import { html, icon, sheet, toast, copyText, profileUrl, plural } from './ui.js';

export function profileShareSheet(a, avg = null) {
    const url = profileUrl(a);
    const stats = [`${a.mixes ?? 0} ${plural(a.mixes ?? 0, 'микс', 'микса', 'миксов')}`, avg ? `★ ${avg.toFixed(1)}` : ''].filter(Boolean).join(' · ');
    let blob = null, objUrl = '';
    const s = sheet(html`<div class="pshare">
        <h2 class="h2">${a.handle ? '@' + a.handle : a.name}</h2>
        <div class="pshare__card"><div class="skel"></div></div>
        <div class="pshare__url mono">${url.replace(/^https?:\/\//, '')}</div>
        <div class="pshare__btns">
          <button class="btn btn--accent btn--lg" id="psShare">${icon('share')} ${navigator.share ? 'Поделиться' : 'Скачать картинку'}</button>
          <button class="btn btn--ghost" id="psCopy">${icon('copy')} Ссылка</button>
          ${navigator.share ? html`<button class="btn btn--ghost" id="psSave">Скачать</button>` : ''}
        </div>
        ${a.handle ? '' : html`<p class="muted small">Задайте ник в профиле — ссылка станет короткой и красивой: /u/ник.</p>`}
      </div>`, { onClose: () => { if (objUrl) URL.revokeObjectURL(objUrl); } });

    const $ = (q) => s.body.querySelector(q);
    const download = () => {
        const link = Object.assign(document.createElement('a'), { href: objUrl, download: `hookah-hub-${a.handle || 'profile'}.png` });
        link.click(); toast('Картинка сохранена');
    };
    (async () => {
        try {
            const { makeProfileCard } = await import('./sharecard.js');
            blob = await makeProfileCard(a, url, stats);
            objUrl = URL.createObjectURL(blob);
            $('.pshare__card').innerHTML = '';
            $('.pshare__card').append(Object.assign(new Image(), { src: objUrl, alt: 'Визитка с QR', draggable: false }));
        } catch { $('.pshare__card').textContent = 'Не удалось собрать картинку'; }
    })();

    $('#psCopy').onclick = async () => { const ok = await copyText(url); toast(ok ? 'Ссылка скопирована' : 'Не удалось скопировать', ok ? '' : 'err'); };
    $('#psSave')?.addEventListener('click', () => blob && download());
    $('#psShare').onclick = async () => {
        if (!blob) return;
        const file = new File([blob], 'hookah-hub.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
            try { await navigator.share({ files: [file], title: a.name, text: `${a.name} в Hookah Hub\n${url}` }); }
            catch (e) { if (e?.name !== 'AbortError') toast('Не удалось поделиться', 'err'); }
        } else download();
    };
}
