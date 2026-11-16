# mAI Stream UI

Mobil uygulamaların kullandığı `ask_stream` endpoint'ini ekip içinde denemek için hazırlanmış sohbet arayüzü. `ask_stream` yeni futbol agent'ını eski mobil sözleşmesiyle döndürür: cevap kelime kelime akmaz, final mesaj tek satır düz metindir. Koyu temalı masaüstü düzeninde solda sohbet geçmişi, sağda sohbet ve altta mesaj alanı bulunur. Telefon ekranlarında geçmiş açılır menüye dönüşür.

## Yerelde çalıştırma

Node.js 20.9 veya üstü gerekir. API'nin çalıştığı makinede:

```bash
npm install
npm run dev
```

Arayüz `http://localhost:3000` adresindedir. `.env.example` dosyasını `.env.local` adıyla kopyalayın; `MAI_API_BASE_URL` şu anda `http://139.162.189.11:4000` adresine ayarlıdır. Bu değişken sunucu tarafında okunur; tarayıcıya verilmez.

## Kullanım

- **Yeni sohbet** yeni bir `session_id` açar. Aynı sohbetteki takip soruları aynı oturumu kullanır.
- **Test ayarları** bölümüne maç UUID'si, lig UUID'si ve maç durumu girilebilir. Bağlam değişirse mevcut mesajların anlamını korumak için yeni sohbet açılır.
- **Kart modu** `use_predefined: true` gönderir. Kartın yanındaki **Bu karttan sohbete devam et** eylemi, endpoint'in mevcut `question_id` alanıyla devam eder.
- Yanıt `assistant_delta` olaylarıyla parça parça gösterilir. Son `message` olayı taslağı kesin yanıtla değiştirir. Hata ve durdurma durumu ekranda gösterilir.
- Akış ve kesin yanıt aynı Markdown gösterimini kullanır; paragraflar, listeler ve tablolar biçimlendirilir. Geniş tablolar yatay kaydırılabilir. Satır sonları korunur.
- Sohbet listesi bu tarayıcının yerel depolamasında saklanır. Agent'ın sunucudaki konuşma belleği farklı bir süre sonunda sona erebilir.

### Futbol / Basketbol

- Sayfa her açılışta **Futbol** ile başlar. Sol üstteki **mAI** logosuna tıklanınca Futbol/Basketbol menüsü açılır.
- Yan panel kapalıyken ve telefonda aynı seçici üst çubukta da görünür.
- **Basketbol** sekmesi EuroLeague 2026/27 istatistikleri ve fantasy soruları içindir:
  - turuncu vurgu kullanır;
  - kendi sohbet listesini tutar (`Conversation.sport`);
  - boş ekranda fantasy önerileri gösterir;
  - maç bağlamı, kart modu ve maç ayarları bu sekmede gizlidir.

### Fransızca ve Arapça test (yalnızca futbol)

Fransa uygulaması için futbol cevapları Fransızca ve Arapça da denenebilir. Arapça, Fransa'da yaşayan Arapça konuşan kullanıcılar içindir. Arayüz Türkçe kalır; yalnızca istekler ve cevaplar değişir. Dil seçenekleri `lib/locale.ts`'tedir.

- **Sohbet:** mesaj alanındaki **TR | FR | AR** seçicisi veya **Test ayarları → Cevap dili**. FR veya AR seçiliyken `/ask_stream` isteğine `locale: "fr"` / `locale: "ar"` eklenir. Üst çubukta **FR** veya **AR** etiketi görünür. Boş ekranda o dilde örnek sorular çıkar.
- **Arapça:** cevaplar standart Arapça gelir ve sağdan sola gösterilir. Soru Arapça, lehçeyle, Latin harfli Arapça (Arabizi) ya da Fransızca yazılabilir.
- Dil, sohbet bağlamının parçasıdır. Mesajı olan bir sohbette dil değişirse aynı maç bağlamıyla yeni sohbet açılır, çünkü API geçmişi ve kart önbelleği dile göre ayrı tutulur.
- **Mobil maç ekranı:** üst çubukta aynı **TR | FR | AR** seçicisi bulunur. FR veya AR'de hazır sorular `predefined_questions_stream` ucundan `locale` ile o dilde gelir. Kart cevapları da o dilde istenir. **Sohbete devam et** adrese `locale=fr` / `locale=ar` ekler; sohbet aynı dilde açılır. Bir dilde cevaplanan karttan başka dilde sohbete devam edilmez.
- Cevaplardaki maç saatleri Fransa saatidir (Europe/Paris). Maç listesindeki saatler Türkiye saati olarak kalır.
- Maç önü ve maç sonu kartlarının Fransızca ve Arapça cevapları ilk dokunuşta üretilir ve önbelleğe alınır (`fr-card:` / `ar-card:` anahtarları). Bu yüzden ilk dokunuş Türkçeden yavaş olabilir. Canlı maç kartları her seferinde canlı üretilir.
- TR seçiliyken istek gövdesine `locale` alanı eklenmez; mobil uygulamanın bugünkü isteğiyle aynıdır. Basketbolda dil seçimi yoktur.

### Mobil maç ekranı (`/mobil`)

mAI'nin mobil uygulamadaki maç deneyimini test etmek için ayrı ekran. Sohbet ekranında sol raydaki telefon simgesi ve yan paneldeki **Mobil maç ekranı** bağlantısı buraya açılır. Masaüstünde telefon çerçevesi içinde, telefonda tam ekran görünür.

- **Maç listesi:** bugün dahil 3 günün (İstanbul saati) maçları gün sekmeleriyle listelenir. Maçlar `/api/matches` ucundan gelir; bu uç mAI'nin kapsadığı ligleri (`lib/leagues.ts`, `etl/mai_consensus/config.py` LEAGUE_MAPPING ile aynı) Maçkolik `competition-service`'ten çeker ve 2 dakika önbellekte tutar. Yeni lig/sezon eklenince `lib/leagues.ts` de güncellenmelidir.
- **Maç ekranı:** maça girince hazır sorular `/api/predefined_questions` vekiliyle `predefined_questions_stream` ucundan maç durumuna göre (maç öncesi, canlı, maç sonu) gelir.
- **Cevap kartı:** soruya dokununca alttan kart açılır. İstek, mobil uygulamadaki gibi `/ask_stream`'e `use_predefined: true`, maç kimliği, maç durumu ve maçın ligiyle gider. Kartta cevap süresi, kopyalama ve **Tekrar sor** bulunur. Cevaplanan sorular listede işaretlenir.
- **Sohbete devam et:** maç ekranının altında ve cevap kartında bulunur. Sohbet ekranı `/?match_id=…&competition_id=…&match_status=…&title=…` adresiyle, maç bağlamı dolu yeni bir sohbetle açılır. Kart cevabından devam ediliyorsa adrese `question_id` eklenir. Kartın soru ve cevabı sohbetin başına konur, ilk mesaj bu `question_id` ile gider. Maç ekranındaki buton, o maçta en son cevaplanan kartı kullanır. Sohbet, mobil ekranla aynı kullanıcı kimliğini (`<kullanıcı>:mobil`) kullanır. API kart cevaplarını kullanıcı ve maç anahtarıyla sakladığı için uygulamadaki gibi karttan devam edilir (`lib/handoff.ts`).
- Geri tuşu önce kartı, sonra maç ekranını kapatır. Maç adresi `?mac=<uuid>` ile paylaşılabilir.

### API vekilleri

Futbol sekmesinde tarayıcı, `/api/ask_stream` yolundaki Next.js vekiline istek yapar. Vekil aynı istek gövdesini `MAI_API_BASE_URL/ask_stream` adresine iletir ve cevap akışını tamponlamadan tarayıcıya aktarır. Böylece API'de CORS değişikliği gerekmez. Basketbol sekmesi aynı şekilde `/api/ask_stream_mai_basketball` vekilini kullanır; istek `MAI_API_BASE_URL/ask_stream_mai_basketball` adresine gider. Zengin akışlı (`assistant_delta`, çok satırlı metin) `/api/ask_stream_mai` vekili de durur; futbol sekmesini ona döndürmek için `components/ChatApp.tsx` içindeki `SPORTS.football.endpoint` değiştirilir. Vekillerin ortak kodu `lib/proxy.ts` dosyasındadır; erişim kodu kontrolü de buradadır.

## Dağıtım için gereken ayarlar

Vercel projesinin kök dizini `mai-stream-ui` olmalı. `MAI_API_BASE_URL`, Vercel'deki sunucunun erişebildiği mAI API adresi olarak tanımlanmalı. İsteğe bağlı `MAI_UI_ACCESS_TOKEN` tanımlanırsa ekip üyeleri **Test ayarları** ekranına bu kodu girer; API vekili kodu kontrol eder. API'nin dağıtım ortamından erişilebilir ve yeterli süre açık kalan bir akış bağlantısı sunması gerekir.

Canlı arayüz: https://mai-stream-ui.vercel.app. Vercel'in Production ve Preview ortamlarında `MAI_API_BASE_URL=http://139.162.189.11:4000` tanımlıdır.
