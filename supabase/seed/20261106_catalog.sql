-- Hookah Hub: расширение каталога (табаки Darkside / Black Burn / Musthave + миксы)
-- Идемпотентно: существующие табаки и миксы с тем же названием не дублируются.
begin;
insert into public.brands (id, name) select gen_random_uuid(), 'Black Burn' where not exists (select 1 from public.brands where lower(name) = 'black burn');
create temp table _t (brand text, name text, descr text, tags text[]) on commit drop;
insert into _t values
  ('DarkSide', 'Supernova', 'Ледяная свежесть, чистый холодок', array['свежий','мятный']::text[]),
  ('DarkSide', 'Bananapapa', 'Спелый сливочный банан', array['сладкий','фруктовый','десертный']::text[]),
  ('DarkSide', 'Kalee Grapefruit', 'Розовый грейпфрут', array['кислый','цитрус']::text[]),
  ('DarkSide', 'Lemonblast', 'Сочный лимон', array['кислый','цитрус']::text[]),
  ('DarkSide', 'Mango Lassi', 'Манговый йогуртовый напиток', array['сладкий','тропический','десертный']::text[]),
  ('DarkSide', 'Bounty Hunter', 'Кокос с шоколадом', array['сладкий','десертный']::text[]),
  ('DarkSide', 'Blueberry Blast', 'Черника', array['ягодный','сладкий']::text[]),
  ('DarkSide', 'Glitch Ice Tea', 'Персиковый холодный чай', array['напиток','фруктовый','свежий']::text[]),
  ('DarkSide', 'Goosebumps', 'Фруктовый микс с цитрусовыми нотами', array['фруктовый','цитрус']::text[]),
  ('DarkSide', 'Guava Rebel', 'Гуава, кисло-сладкая', array['тропический','кислосладкий']::text[]),
  ('DarkSide', 'Falling Star', 'Манго и маракуйя', array['тропический','сладкий']::text[]),
  ('DarkSide', 'Wild Forest', 'Земляника и лесные ягоды', array['ягодный','кислосладкий']::text[]),
  ('DarkSide', 'Generis Raspberry', 'Спелая малина', array['ягодный','сладкий']::text[]),
  ('DarkSide', 'Barvy Orange', 'Апельсин', array['цитрус','сладкий']::text[]),
  ('DarkSide', 'Breaking Red', 'Гранат', array['кислосладкий','фруктовый']::text[]),
  ('DarkSide', 'Goal', 'Энергетик', array['напиток','кислосладкий']::text[]),
  ('DarkSide', 'Cosmo Flower', 'Черника, роза и жасмин', array['цветочный','ягодный']::text[]),
  ('DarkSide', 'Cyber Kiwi', 'Киви-смузи', array['кислосладкий','фруктовый']::text[]),
  ('DarkSide', 'Space Lychee', 'Личи', array['тропический','сладкий']::text[]),
  ('DarkSide', 'Needles', 'Хвоя, пряная свежесть', array['травяной','пряный']::text[]),
  ('DarkSide', 'Redberry', 'Красная смородина', array['ягодный','кислый']::text[]),
  ('DarkSide', 'Blacktorrent', 'Чёрная смородина', array['ягодный','кислосладкий']::text[]),
  ('DarkSide', 'Acot', 'Абрикос и зелёное яблоко', array['фруктовый','яблочный']::text[]),
  ('DarkSide', 'Admiral Acbar', 'Хлопья с фруктами', array['сладкий','десертный']::text[]),
  ('DarkSide', 'Dark Passion', 'Маракуйя', array['тропический','кислосладкий']::text[]),
  ('DarkSide', 'Nordberry', 'Охлаждённый клюквенный морс', array['ягодный','кислый','свежий']::text[]),
  ('DarkSide', 'Astro Tea', 'Зелёный чай с лимоном', array['напиток','цитрус']::text[]),
  ('DarkSide', 'Cherry Rocks', 'Вишнёвые леденцы с кислинкой', array['кислосладкий','ягодный']::text[]),
  ('DarkSide', 'Red Rush', 'Кислые ягодные конфеты, барбарис', array['кислый','ягодный']::text[]),
  ('DarkSide', 'Desert Eagle', 'Сладкий кактус', array['фруктовый','свежий']::text[]),
  ('DarkSide', 'Pineapple Pulse', 'Терпкий ананас', array['ананасовый','кислосладкий']::text[]),
  ('Black Burn', 'Lemon Shock', 'Ультракислый лимон', array['кислый','цитрус']::text[]),
  ('Black Burn', 'Kiwi Stoner', 'Киви-смузи', array['кислосладкий','фруктовый']::text[]),
  ('Black Burn', 'Real Passion Fruit', 'Сочная маракуйя', array['тропический','кислосладкий']::text[]),
  ('Black Burn', 'Haribon', 'Мармелад со вкусом колы', array['сладкий','напиток']::text[]),
  ('Black Burn', 'Blackberry Lemonade', 'Ежевичный лимонад', array['ягодный','напиток','свежий']::text[]),
  ('Black Burn', 'Juzy Smoozy', 'Клубника, папайя, кокос', array['тропический','сладкий']::text[]),
  ('Black Burn', 'Tropical Jack', 'Джекфрут, банан и ананас', array['тропический','сладкий']::text[]),
  ('Black Burn', 'Lemon Sweets', 'Лимонный мармелад', array['цитрус','сладкий']::text[]),
  ('Black Burn', 'Peach Yogurt', 'Персиковый йогурт', array['десертный','фруктовый']::text[]),
  ('Black Burn', 'Blueberry Yogurt', 'Черничный йогурт', array['десертный','ягодный']::text[]),
  ('Black Burn', 'Summer Basket', 'Черника, клубника, малина, арбуз', array['ягодный','сладкий']::text[]),
  ('Black Burn', 'Ice Baby', 'Грейпфрут с ягодами', array['цитрус','ягодный','свежий']::text[]),
  ('Black Burn', 'Pineapple Shock', 'Кислый ананас', array['ананасовый','кислый']::text[]),
  ('Black Burn', 'Apple Shock', 'Кислое зелёное яблоко', array['яблочный','кислый']::text[]),
  ('Black Burn', 'Apple Strudel', 'Яблоко, тесто и корица', array['яблочный','десертный','пряный']::text[]),
  ('Black Burn', 'Barberry Shock', 'Очень кислая барбарисовая конфета', array['кислый','ягодный']::text[]),
  ('Black Burn', 'Cranberry Shock', 'Кислая клюква', array['кислый','ягодный']::text[]),
  ('Black Burn', 'Currant Shock', 'Кислая чёрная смородина', array['кислый','ягодный']::text[]),
  ('Black Burn', 'Elderberry Shock', 'Бузина', array['ягодный','кислосладкий']::text[]),
  ('Black Burn', 'Its Not Black Currant', 'Чёрная смородина', array['ягодный','кислосладкий']::text[]),
  ('Black Burn', 'Melon Halls', 'Арбуз с холодком', array['фруктовый','свежий']::text[]),
  ('Black Burn', 'Cupper Grupper', 'Виноградный лимонад с медовым послевкусием', array['фруктовый','напиток']::text[]),
  ('Black Burn', 'Something Bear', 'Лесные ягоды: черника, ежевика, малина, смородина', array['ягодный','кислосладкий']::text[]),
  ('Black Burn', 'Give Me Guava', 'Киви, гуава и лайм', array['тропический','кислосладкий']::text[]),
  ('Black Burn', 'Malibu', 'Клубника со сливками', array['ягодный','десертный']::text[]),
  ('Black Burn', 'Peach Killer', 'Персик', array['фруктовый','сладкий']::text[]),
  ('Black Burn', 'Rose Tea', 'Роза', array['цветочный','напиток']::text[]),
  ('Black Burn', 'Strawberry Jam', 'Клубничный джем', array['ягодный','сладкий']::text[]),
  ('Black Burn', 'Raspberry', 'Малина', array['ягодный','сладкий']::text[]),
  ('Black Burn', 'Green Tea', 'Зелёный чай', array['напиток','травяной']::text[]),
  ('Black Burn', 'Rising Star', 'Манго', array['тропический','сладкий']::text[]),
  ('Black Burn', 'Cane Mint', 'Мята', array['мятный','свежий']::text[]),
  ('Black Burn', 'Brownie', 'Шоколадный брауни', array['десертный','сладкий']::text[]),
  ('MustHave', 'Pinkman', 'Розовый грейпфрут, клубника и малина', array['кислосладкий','ягодный','цитрус']::text[]),
  ('MustHave', 'Pineapple Rings', 'Консервированный ананас', array['ананасовый','кислосладкий']::text[]),
  ('MustHave', 'Milky Rice', 'Молочный рис', array['десертный','сладкий']::text[]),
  ('MustHave', 'Space Flavor', 'Манго, роза, маракуйя и личи', array['тропический','цветочный']::text[]),
  ('MustHave', 'Raspberry', 'Малина', array['ягодный','сладкий']::text[]),
  ('MustHave', 'Tropic Juice', 'Ананас и маракуйя', array['тропический','сладкий']::text[]),
  ('MustHave', 'Kiwi Smoothie', 'Киви-смузи', array['кислосладкий','фруктовый']::text[]),
  ('MustHave', 'Melonade', 'Арбуз, дыня и барбарис', array['фруктовый','свежий']::text[]),
  ('MustHave', 'Lemon Pie', 'Лимонный пирог', array['цитрус','десертный']::text[]),
  ('MustHave', 'Cherry Cola', 'Вишнёвая кола', array['напиток','сладкий']::text[]),
  ('MustHave', 'Choco Mint', 'Шоколад с мятой', array['мятный','десертный']::text[]),
  ('MustHave', 'Pistachio Pie', 'Фисташковый пирог', array['десертный','сладкий']::text[]),
  ('MustHave', 'Feijoa', 'Фейхоа', array['фруктовый','кислосладкий']::text[]),
  ('MustHave', 'Banana Mama', 'Спелый банан', array['фруктовый','сладкий']::text[]),
  ('MustHave', 'Strawberry', 'Клубника', array['ягодный','сладкий']::text[]),
  ('MustHave', 'Blackberry', 'Ежевика', array['ягодный','кислосладкий']::text[]),
  ('MustHave', 'Forest Berries', 'Лесные ягоды', array['ягодный','кислосладкий']::text[]),
  ('MustHave', 'Black Currant', 'Чёрная смородина', array['ягодный','кислый']::text[]),
  ('MustHave', 'Elderberry', 'Бузина', array['ягодный','кислосладкий']::text[]),
  ('MustHave', 'Ruby Grape', 'Красный виноград', array['фруктовый','сладкий']::text[]),
  ('MustHave', 'Garnet Grape', 'Насыщенный красный виноград', array['фруктовый','сладкий']::text[]),
  ('MustHave', 'Cinnamon', 'Корица', array['пряный','десертный']::text[]),
  ('MustHave', 'Tarragon', 'Тархун', array['травяной','свежий']::text[]),
  ('MustHave', 'Morocco', 'Пряности', array['пряный','травяной']::text[]),
  ('MustHave', 'Berry Holls', 'Ягодные леденцы с холодком', array['ягодный','мятный']::text[]),
  ('MustHave', 'Sea Buckthorn Tea', 'Облепиховый чай', array['напиток','кислосладкий']::text[]),
  ('MustHave', 'Caribbean Rum', 'Ром', array['пряный','напиток']::text[]),
  ('MustHave', 'Apple Drops', 'Яблочные леденцы', array['яблочный','сладкий']::text[]),
  ('MustHave', 'Cherry Juice', 'Вишнёвый сок', array['ягодный','напиток']::text[]),
  ('MustHave', 'Mulled Wine', 'Глинтвейн', array['пряный','напиток']::text[]),
  ('MustHave', 'Araram', 'Арбуз, виноград, чернослив и мята', array['фруктовый','мятный']::text[]),
  ('MustHave', 'Jumango', 'Тропическое манго', array['тропический','сладкий']::text[]),
  ('MustHave', 'Paradise', 'Тропический фруктовый микс', array['тропический','фруктовый']::text[]),
  ('MustHave', 'Marula', 'Марула', array['тропический','фруктовый']::text[]),
  ('MustHave', 'Strawberry Lychee', 'Клубника и личи', array['ягодный','тропический']::text[]);
insert into public.tobaccos (id, brand_id, name, taste_tags)
select gen_random_uuid(), b.id, t.name, t.tags
  from _t t join public.brands b on lower(b.name) = lower(t.brand)
 where not exists (select 1 from public.tobaccos x where x.brand_id = b.id and lower(x.name) = lower(t.name));
create temp table _m (title text, descr text, tags text[], ing jsonb) on commit drop;
insert into _m values
  ('Pink Rings', 'Главная классика сезона: розовый грейпфрут с ягодами и консервированный ананас. Кисло-сладко, сочно, с лёгкой мятой.', array['кислосладкий','ягодный','ананасовый']::text[], '[{"b": "MustHave", "t": "Pinkman", "p": 50}, {"b": "MustHave", "t": "Pineapple Rings", "p": 40}, {"b": "Black Burn", "t": "Cane Mint", "p": 10}]'::jsonb),
  ('Банановый пудинг', 'Мягкий десерт: сливочный банан и молочный рис. Для вечера без кислинки.', array['десертный','сладкий']::text[], '[{"b": "DarkSide", "t": "Bananapapa", "p": 60}, {"b": "MustHave", "t": "Milky Rice", "p": 40}]'::jsonb),
  ('Ледяной грейпфрут', 'Бодрый цитрус с мощным холодом. Хорош в жару и после еды.', array['цитрус','свежий','кислый']::text[], '[{"b": "DarkSide", "t": "Kalee Grapefruit", "p": 60}, {"b": "DarkSide", "t": "Supernova", "p": 15}, {"b": "MustHave", "t": "Pinkman", "p": 25}]'::jsonb),
  ('Лимонный пирог с малиной', 'Десертный лимон и сладкая малина — как ягодный тарт.', array['десертный','цитрус','ягодный']::text[], '[{"b": "MustHave", "t": "Lemon Pie", "p": 60}, {"b": "DarkSide", "t": "Generis Raspberry", "p": 40}]'::jsonb),
  ('Тропики', 'Манго, маракуйя и ананас — плотный тропический микс без холода.', array['тропический','сладкий']::text[], '[{"b": "DarkSide", "t": "Falling Star", "p": 50}, {"b": "MustHave", "t": "Tropic Juice", "p": 30}, {"b": "MustHave", "t": "Pineapple Rings", "p": 20}]'::jsonb),
  ('Кислый взрыв', 'Для любителей кислого: лимон, барбарис и капля холода.', array['кислый','цитрус','ягодный']::text[], '[{"b": "Black Burn", "t": "Lemon Shock", "p": 50}, {"b": "Black Burn", "t": "Barberry Shock", "p": 40}, {"b": "DarkSide", "t": "Supernova", "p": 10}]'::jsonb),
  ('Киви-лимонад', 'Киви-смузи с ежевичным лимонадом — свежо и легко.', array['кислосладкий','напиток','свежий']::text[], '[{"b": "MustHave", "t": "Kiwi Smoothie", "p": 50}, {"b": "Black Burn", "t": "Blackberry Lemonade", "p": 50}]'::jsonb),
  ('Персиковый чай со льдом', 'Холодный персиковый чай, освежённый мятой.', array['напиток','фруктовый','свежий']::text[], '[{"b": "DarkSide", "t": "Glitch Ice Tea", "p": 70}, {"b": "Black Burn", "t": "Cane Mint", "p": 30}]'::jsonb),
  ('Кокосовый брауни', 'Кокос с шоколадом и брауни — плотный десерт.', array['десертный','сладкий']::text[], '[{"b": "DarkSide", "t": "Bounty Hunter", "p": 60}, {"b": "Black Burn", "t": "Brownie", "p": 40}]'::jsonb),
  ('Лесная поляна', 'Земляника, лесные ягоды и чёрная смородина с кислинкой.', array['ягодный','кислосладкий']::text[], '[{"b": "DarkSide", "t": "Wild Forest", "p": 40}, {"b": "Black Burn", "t": "Something Bear", "p": 40}, {"b": "MustHave", "t": "Black Currant", "p": 20}]'::jsonb),
  ('Манго ласси', 'Манговый йогурт с личи — сливочно и экзотично.', array['тропический','десертный']::text[], '[{"b": "DarkSide", "t": "Mango Lassi", "p": 70}, {"b": "DarkSide", "t": "Space Lychee", "p": 30}]'::jsonb),
  ('Кола с вишней', 'Вишнёвая кола и мармелад-кола — вкус газировки из детства.', array['напиток','сладкий']::text[], '[{"b": "MustHave", "t": "Cherry Cola", "p": 60}, {"b": "Black Burn", "t": "Haribon", "p": 40}]'::jsonb),
  ('Ягодный йогурт', 'Черничный и персиковый йогурт — нежный и сладкий.', array['десертный','ягодный']::text[], '[{"b": "Black Burn", "t": "Blueberry Yogurt", "p": 50}, {"b": "Black Burn", "t": "Peach Yogurt", "p": 50}]'::jsonb),
  ('Арбузный холод', 'Арбуз с дыней и холодком — летняя классика.', array['фруктовый','свежий']::text[], '[{"b": "MustHave", "t": "Melonade", "p": 60}, {"b": "Black Burn", "t": "Melon Halls", "p": 40}]'::jsonb),
  ('Клюквенный морс', 'Охлаждённая клюква и кислая смородина — бодрит.', array['кислый','ягодный','свежий']::text[], '[{"b": "DarkSide", "t": "Nordberry", "p": 60}, {"b": "Black Burn", "t": "Currant Shock", "p": 40}]'::jsonb),
  ('Зелёный чай с лимоном', 'Чайный микс: зелёный чай, лимон и тархун.', array['напиток','цитрус','травяной']::text[], '[{"b": "DarkSide", "t": "Astro Tea", "p": 50}, {"b": "Black Burn", "t": "Green Tea", "p": 30}, {"b": "MustHave", "t": "Tarragon", "p": 20}]'::jsonb),
  ('Гранат и гуава', 'Кисло-сладкий гранат с тропической гуавой.', array['кислосладкий','тропический']::text[], '[{"b": "DarkSide", "t": "Breaking Red", "p": 50}, {"b": "DarkSide", "t": "Guava Rebel", "p": 50}]'::jsonb),
  ('Яблочный штрудель', 'Яблоко, тесто и корица — как из пекарни.', array['десертный','яблочный','пряный']::text[], '[{"b": "Black Burn", "t": "Apple Strudel", "p": 70}, {"b": "MustHave", "t": "Cinnamon", "p": 30}]'::jsonb),
  ('Глинтвейн', 'Тёплый пряный микс на холодный вечер.', array['пряный','напиток']::text[], '[{"b": "MustHave", "t": "Mulled Wine", "p": 60}, {"b": "MustHave", "t": "Cherry Juice", "p": 40}]'::jsonb),
  ('Клубника со сливками', 'Клубничный джем и сливки — сладкий десерт.', array['ягодный','десертный']::text[], '[{"b": "Black Burn", "t": "Malibu", "p": 60}, {"b": "Black Burn", "t": "Strawberry Jam", "p": 40}]'::jsonb),
  ('Энергетик', 'Энергетик с маракуйей и лимоном — громкий и яркий.', array['напиток','кислосладкий']::text[], '[{"b": "DarkSide", "t": "Goal", "p": 60}, {"b": "Black Burn", "t": "Real Passion Fruit", "p": 25}, {"b": "DarkSide", "t": "Lemonblast", "p": 15}]'::jsonb),
  ('Фисташковое мороженое', 'Фисташковый пирог с холодком — как пломбир.', array['десертный','свежий']::text[], '[{"b": "MustHave", "t": "Pistachio Pie", "p": 80}, {"b": "DarkSide", "t": "Supernova", "p": 20}]'::jsonb),
  ('Цветочный сад', 'Роза, жасмин и черника — для любителей необычного.', array['цветочный','ягодный']::text[], '[{"b": "DarkSide", "t": "Cosmo Flower", "p": 60}, {"b": "Black Burn", "t": "Rose Tea", "p": 40}]'::jsonb),
  ('Абрикосовый джем', 'Абрикос с зелёным яблоком и киви.', array['фруктовый','кислосладкий']::text[], '[{"b": "DarkSide", "t": "Acot", "p": 60}, {"b": "DarkSide", "t": "Cyber Kiwi", "p": 40}]'::jsonb),
  ('Виноградный лимонад', 'Виноград с медовым послевкусием и холодком.', array['фруктовый','напиток','свежий']::text[], '[{"b": "Black Burn", "t": "Cupper Grupper", "p": 60}, {"b": "MustHave", "t": "Ruby Grape", "p": 30}, {"b": "DarkSide", "t": "Supernova", "p": 10}]'::jsonb),
  ('Шоколадная мята', 'Шоколад с мятой — классика After Eight в чаше.', array['мятный','десертный']::text[], '[{"b": "MustHave", "t": "Choco Mint", "p": 80}, {"b": "Black Burn", "t": "Cane Mint", "p": 20}]'::jsonb);
do $$
declare m record; v_id uuid; v_author uuid; i record;
begin
  select author_id into v_author from public.mixes where author_id is not null order by created_at limit 1;
  for m in select * from _m loop
    if exists (select 1 from public.mixes where lower(title) = lower(m.title)) then continue; end if;
    insert into public.mixes (id, author_id, title, description, taste_tags, is_published, created_at)
    values (gen_random_uuid(), v_author, m.title, m.descr, m.tags, true, now() - (random() * interval '20 days'))
    returning id into v_id;
    for i in select e.ord, e.val from jsonb_array_elements(m.ing) with ordinality as e(val, ord) loop
      insert into public.mix_ingredients (mix_id, tobacco_id, percent, pos)
      select v_id, t.id, (i.val->>'p')::numeric, i.ord
        from public.tobaccos t join public.brands b on b.id = t.brand_id
       where lower(b.name) = lower(i.val->>'b') and lower(t.name) = lower(i.val->>'t')
       limit 1;
    end loop;
  end loop;
end $$;
commit;
select (select count(*) from public.tobaccos) as tobaccos,
       (select count(*) from public.mixes) as mixes,
       (select count(*) from public.mix_ingredients) as ingredients;
