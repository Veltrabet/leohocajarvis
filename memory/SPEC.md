# JARVIS — Q8Ka By Leohoca (living spec)

Kişisel AI işletim merkezi. FastAPI + MongoDB backend, Vite/React 19 + Tailwind v4 frontend.
Arayüz tamamen Türkçe, koyu futuristik cyan command center teması, mobil/PWA uyumlu.

## Auth
Tek operatör, PIN tabanlı. PIN `backend/.env` → `JARVIS_PIN` (varsayılan **1903**).
`POST /api/auth/login {pin}` httpOnly `jarvis_session` cookie'si kurar; `GET /api/auth/me`;
`POST /api/auth/logout`. Korumalı tüm route'lar `require_session` bağımlılığını kullanır.

## AI sağlayıcı soyutlaması (backend/lib/llm.py)
| Yetenek | Sağlayıcı | Model | Anahtar sırası |
|---|---|---|---|
| text | gemini | gemini-3-flash-preview | GEMINI_API_KEY (operatörün kendi anahtarı) → OPENAI_API_KEY → EMERGENT_LLM_KEY |
| image | gemini | gemini-2.5-flash-image | GEMINI_IMAGE_API_KEY → EMERGENT_LLM_KEY → GEMINI_API_KEY (operatör anahtarında görsel kotası yok: 429) |
| voice | tarayıcı | Web Speech API tr-TR / sq-AL / en-US | — (server anahtarı yok) |
| instagram | meta-graph | Instagram Graph API | INSTAGRAM_ACCESS_TOKEN (tanımlı değil → BAĞLI DEĞİL) |
| video | — | — | BAĞLI DEĞİL (bilinçli, sahte gösterilmiyor) |

`GET /api/system/capabilities` gerçek durumu döner; bağlı olmayan servis "BAĞLI DEĞİL" görünür.

## Veri modeli (Mongo koleksiyonları)
- `sessions` token, expires_at (TTL index)
- `projects` id, name, client, description, status(aktif|beklemede|tamamlandi), created_at
- `tasks` id, title, project_id, priority(kritik|yuksek|normal|dusuk), status(bekliyor|devam|tamam), due_date, notes, created_at
- `messages` id, role(user|assistant), content, created_at
- `memories` id, key(unique), value, category, source(manuel|otomatik), created_at
- `activities` id, kind, message, status(ok|error|pending), created_at
- `leads` id, name, company, channel, handle, email, phone, need, stage(yeni|iletisimde|teklif|kazanildi|kaybedildi), notes[], created_at
- `generated_texts` id, kind, topic, content, lang, created_at
- `studio_items` id, prompt, mime_type, data_url, edited, created_at

Her Pydantic modelinin TS karşılığı `frontend/src/lib/types.ts` içindedir.

## Endpointler (hepsi `/api` altında)
`GET /`, `GET /health`
`POST /auth/login`, `GET /auth/me`, `POST /auth/logout`
`GET|DELETE /chat/messages`, `POST /chat/stream` (SSE, token akışı)
`GET|POST /memory`, `DELETE /memory/{id}`
`GET /activity?limit=`
`POST /brief` (gerçek görev/proje/hafıza verisinden AI yönetici özeti)
`GET /system/capabilities`
`GET|POST /projects`, `PATCH|DELETE /projects/{id}`
`GET|POST /tasks`, `PATCH|DELETE /tasks/{id}`
`GET /studio/items`, `POST /studio/image`, `DELETE /studio/items/{id}`
`GET|POST /crm/leads`, `PATCH|DELETE /crm/leads/{id}`, `POST /crm/leads/{id}/notes`, `POST /crm/leads/{id}/outreach`
`GET /social/items`, `POST /social/generate`, `DELETE /social/items/{id}`

## Ana akışlar
1. **Giriş** `/login` → PIN keypad → cookie → `/` komuta merkezi.
2. **Komuta merkezi** `/` → JARVIS Orb (IDLE/LISTENING/THINKING/SPEAKING), metin+sesli komut,
   günlük özet, öncelikli görev matrisi, işlem günlüğü.
3. **Sohbet** `/chat` → SSE token akışı, kalıcı geçmiş, sesli yanıt (TTS), hızlı komutlar.
4. **Görevler** `/tasks` → görev + proje CRUD, durum/öncelik yönetimi.
5. **Stüdyo** `/studio` → görsel üretme ve yüklenen görseli talimatla düzenleme, geçmiş, indirme.
6. **Sosyal** `/social` → Instagram içerik ajansı: post/reels/caption/hashtag/7 günlük takvim/DM
   taslağı/biyografi üretimi + arşiv. Gönderim YOK.
7. **Müşteri** `/crm` → potansiyel müşteri kaydı, aşama takibi, notlar, AI iletişim taslağı
   (DM/e-posta/WhatsApp) — taslak otomatik not olarak kaydedilir, gönderilmez.
8. **Sistem** `/system` → servis durumu, kalıcı hafıza yönetimi, tam işlem günlüğü.

## Hafıza
Sohbette model, cevabının sonuna `###HAFIZA###` bloğu ekleyerek `anahtar: değer` kaydeder;
backend bu bloğu kullanıcıya göstermeden `memories` koleksiyonuna upsert eder. Her istekte
görevler + projeler + hafıza + son işlemler sistem promptuna gerçek veri olarak enjekte edilir.

## Dil
`frontend/src/lib/lang.ts` tek kaynak: auto | tr | sq (shqip) | en. Seçim localStorage'da,
header'daki LangSwitch ile değişir; hem `POST /chat/stream` (`lang`), `POST /brief?lang=`,
`/social/generate`, `/crm/.../outreach` isteklerine hem de Web Speech API locale'ine geçer
(tr-TR / sq-AL / en-US). `auto` = kullanıcının yazdığı dilde cevap.

## Etik sınırlar (bilinçli reddedildi)
- Kişi hakkında açık kaynak istihbaratı (telefon numarası / isim-soyisimden kişi araştırma) YOK.
- Kişi konumu bulma YOK.
- Instagram'da otomatik kitlesel DM / müşteri avı otomasyonu YOK (ToS ihlali). Yerine içerik
  ve taslak üretimi + operatörün kendi onayı ile manuel gönderim modeli var.

## Bilinçli kapsam dışı (sahte gösterilmedi)
Video üretimi, e-posta gönderme, Google Takvim, web araştırma, dosya (PDF/DOCX) analizi,
push bildirim, Instagram Graph API gönderimi. Bunlar UI'da "bağlı değil" olarak açıkça belirtilir.
