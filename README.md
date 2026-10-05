# mAI Stream UI

`ask_stream_mai` endpoint'ini ekip içinde denemek için hazırlanmış sohbet arayüzü. Koyu temalı masaüstü düzeninde solda sohbet geçmişi, sağda sohbet ve altta mesaj alanı bulunur. Telefon ekranlarında geçmiş açılır menüye dönüşür.

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

Tarayıcı, `/api/ask_stream_mai` yolundaki Next.js vekiline istek yapar. Vekil aynı istek gövdesini `MAI_API_BASE_URL/ask_stream_mai` adresine iletir ve cevap akışını tamponlamadan tarayıcıya aktarır. Böylece API'de CORS değişikliği gerekmez.

## Dağıtım için gereken ayarlar

Vercel projesinin kök dizini `mai-stream-ui` olmalı. `MAI_API_BASE_URL`, Vercel'deki sunucunun erişebildiği mAI API adresi olarak tanımlanmalı. İsteğe bağlı `MAI_UI_ACCESS_TOKEN` tanımlanırsa ekip üyeleri **Test ayarları** ekranına bu kodu girer; API vekili kodu kontrol eder. API'nin dağıtım ortamından erişilebilir ve yeterli süre açık kalan bir akış bağlantısı sunması gerekir.

Canlı arayüz: https://mai-stream-ui.vercel.app. Vercel'in Production ve Preview ortamlarında `MAI_API_BASE_URL=http://139.162.189.11:4000` tanımlıdır.
