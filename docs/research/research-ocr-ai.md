# Research: OCR + AI extraction of Thai/English medical documents for MediFirstCard
Date: 2026-09-03. Audience: orchestrator + Claude Opus 4.8 implementation agent. Project context: React Native (Expo SDK 57 / RN 0.86), Android-first on Windows 10 (no Xcode), Node.js/Express backend, PostgreSQL, zero budget, demo 7 Oct 2026, repo 11 Oct 2026. Rubric relevance: Category 4 (AI/ML inference API, confidence score display, basic explainability, chatbot explanation) + Category 2 (custom Express backend, REST) + Category 5 (consent/privacy screen, summary report with limitations).

Verification legend: [FETCHED-TODAY] = primary source fetched in this run; [DIGEST] = fetched by the previous agent (evidence visible in digest); [UNVERIFIED] = not confirmed by a fetched primary source.

---
## 0. Executive summary

1. **On-device OCR cannot do Thai on Android.** Google ML Kit Text Recognition v2 supports only Latin, Chinese, Devanagari, Japanese, Korean scripts; Thai is absent from the languages page (last updated 2024-07-10) [DIGEST: https://developers.google.com/ml-kit/vision/text-recognition/v2/languages]. Every RN wrapper (`@react-native-ml-kit/text-recognition` 2.0.0, `@infinitered/react-native-mlkit-text-recognition` 5.0.1) inherits that limit. Apple Vision/Live Text DOES list Thai (https://www.apple.com/ios/feature-availability/) but iOS is a stretch goal for this team. Therefore Thai OCR must be server-side or cloud.
2. **Tesseract 'tha' is unusable on real documents.** Thai-TrOCR model card reports Tesseract CER 0.92 on "Real Document" and 1.06 on EN-TH PDFs (adjusted mean 1.27) [DIGEST: https://huggingface.co/openthaigpt/thai-trocr]. Do not build the demo on tesseract.js for Thai.
3. **Best free Thai-specialised OCR: Typhoon OCR 1.5 via the Typhoon API** (`typhoon-ocr` model, base URL `https://api.opentyphoon.ai/v1`, "research showcase and free to use", 2 RPS / 20 RPM, returns layout-aware Markdown, Apache-2.0 open weights on HF/Ollama) [FETCHED-TODAY: https://docs.opentyphoon.ai/en/faq/ , https://docs.opentyphoon.ai/en/quickstart/ ; DIGEST: https://docs.opentyphoon.ai/en/ocr/ , https://docs.opentyphoon.ai/en/rate-limits/]. It does not return structured fields or bounding boxes, so it is a text layer, not the extractor.
4. **Best structured extractor: a vision LLM with JSON-schema output.** Two adapters behind one interface:
   - **Gemini** (`@google/genai` 2.21.0): `gemini-2.5-flash` / `gemini-2.5-flash-lite` / `gemini-3.5-flash-lite` / `gemini-3.8-flash` all have a free tier ("Free of charge"), but free-tier content is "used to improve our products" and the Gemini API Terms say "Do not submit sensitive, confidential, or personal information to the Unpaid Services" [FETCHED-TODAY: https://ai.google.dev/gemini-api/docs/pricing ; DIGEST: https://ai.google.dev/gemini-api/terms effective 2026-03-23]. Use free tier ONLY with synthetic/demo documents; paid tier ($0.10/$0.40 per MTok for 2.5 Flash-Lite) does not train on data.
   - **Claude** (`@anthropic-ai/sdk` 0.123.0): `claude-haiku-4-5` $1/$5 per MTok, `claude-sonnet-5` $2/$10 per MTok; guaranteed JSON via `output_config.format` (json_schema) with no beta header; images cost ceil(w/28)*ceil(h/28) tokens (1000x1000 = 1296 tokens ~ $0.0013 on Haiku); inputs not used for training, 30-day default retention; Thailand is a supported API country [FETCHED-TODAY: pricing, vision, supported-countries pages; DIGEST: structured-outputs, api-and-data-retention pages]. Estimated ~USD 0.005-0.01 per document on Haiku 4.5. New accounts get "a small amount of free credits".
5. **Thai quality evidence:** ThaiOCRBench (2,808 samples, 13 tasks; IJCNLP-AACL 2025) found Gemini 2.5 Pro best overall, GPT-4o close, Qwen2.5-VL-72B best open model, and "all models struggle with Thai complexity" (missing diacritics, similar glyphs) [FETCHED-TODAY: https://arxiv.org/abs/2511.04479 ; DIGEST: https://opentyphoon.ai/blog/en/thaiocrbench]. Typhoon OCR 1.5 (Qwen3-VL-2B base) reports BLEU 0.870 / Levenshtein 0.035 on Thai government forms and overall BLEU 0.644 [DIGEST: https://opentyphoon.ai/blog/en/typhoon-ocr-release ; FETCHED-TODAY: https://arxiv.org/abs/2601.14722]. Claude's published multilingual table has no Thai row; Thai OCR quality for Claude is unverified and must be tested on the team's own samples.
6. **Recommended pipeline (Section 4):** capture (Expo camera / ML Kit Document Scanner for auto-crop) -> resize to 1600 px long edge JPEG q0.85 with `expo-image-manipulator` 57.0.15 -> multipart upload to Express (`multer` 2.3.0, `sharp` 0.35.4 blur check + EXIF strip) -> parallel: Typhoon OCR text layer + LLM JSON extraction (schema in Section 6) -> per-field confidence = LLM self-score x validator x OCR-agreement x quality -> review/edit screen with colour-coded confidence and source snippet per field -> save to PostgreSQL with `raw_ocr_text`, `extraction_json`, `model`, `timestamps`.

---
## 1. Thai medical document types and fields (what to extract)

Sources: hdmall.co.th blog on ใบรับรองแพทย์ [DIGEST: https://hdmall.co.th/blog/health/what-is-medical-certificate/]; TDL Service description of the Medical Council of Thailand (แพทยสภา) standard form revised May 2021 [DIGEST: https://tdl-service.com/medical-certificate/form-and-requirements]; MFA bilingual form PDF [DIGEST: https://image.mfa.go.th/mfa/0/7pRkP4tkCe/Form(s)/ENG/Medical-Certificate-form.pdf]; physician verification portal https://checkmd.tmc.or.th/v2 [DIGEST search].

Document types to classify:
- `medical_certificate_sick_leave` (ใบรับรองแพทย์ทั่วไป / ใบลาป่วย): patient name, HN, hospital/clinic name + address, examination date, diagnosis (Thai and/or English, sometimes ICD-10 in parentheses), physician opinion ("ควรพักรักษาตัว ... วัน" -> rest_days, with from/to dates), follow-up date, doctor name, licence number "ใบอนุญาตประกอบวิชาชีพเวชกรรมเลขที่ ว. NNNNN", signature/stamp.
- `medical_certificate_5_disease` (ใบรับรองแพทย์ 5 โรค, Medical Council form): patient section (name, nationality, ID/passport, DOB, address), physician section (name, licence no., clinic, exam date, declaration of absence of 5 conditions: mental disability, chronic alcoholism/drug addiction, contagious leprosy, contagious tuberculosis, symptomatic elephantiasis), fitness statement, stamp. Used for driver licence / job applications.
- `prescription` / `medication_label` (ฉลากยา): patient name, hospital, dispense date, drug name (generic/brand, often English), strength, dosage form, dose + frequency in Thai ("รับประทานครั้งละ 1 เม็ด วันละ 3 ครั้ง หลังอาหาร"), quantity, warnings.
- `lab_result`, `receipt`, `other_medical`, `not_medical`.

Thai-specific parsing rules the implementation must encode:
- Dates are frequently Buddhist Era (พ.ศ.) - e.g. "3 กันยายน 2569" = 2026-09-03. Rule: if year > 2400 subtract 543. Also accept "03/09/69" (2-digit BE) and ISO.
- Thai month names: มกราคม, กุมภาพันธ์, มีนาคม, เมษายน, พฤษภาคม, มิถุนายน, กรกฎาคม, สิงหาคม, กันยายน, ตุลาคม, พฤศจิกายน, ธันวาคม (abbrev. ม.ค. ... ธ.ค.).
- Licence number: regex `/ว\.?\s*\d{4,6}/` (e.g. "ว.12345"); dentists use "ท.", nurses "พย.". Optional later feature: link to https://checkmd.tmc.or.th/v2 for manual verification.
- ICD-10 regex: `/\b[A-TV-Z][0-9][0-9AB](\.[0-9A-Z]{1,4})?\b/`.
- Rest days: patterns "พัก(รักษาตัว|ผ่อน)\s*(\d+)\s*วัน", "หยุดงาน ... วัน", "rest for N days".

---
## 2. Option-by-option findings

### 2.1 Google ML Kit Text Recognition v2 (on-device) - NOT viable for Thai
- Scripts: Latin, Chinese, Devanagari, Japanese, Korean only; Thai not in Supported/Experimental/Mapped lists; page last updated 2024-07-10 [DIGEST: https://developers.google.com/ml-kit/vision/text-recognition/v2/languages ; https://developers.google.com/ml-kit/vision/text-recognition/v2]. A 2025/2026 search found no announcement of Thai support [DIGEST search].
- RN wrappers: `@react-native-ml-kit/text-recognition` 2.0.0 (published 2025-09-01; bare RN, no Expo config plugin mentioned; scripts via `TextRecognitionScript` enum; result = blocks/lines with `frame`) [DIGEST: https://raw.githubusercontent.com/a7medev/react-native-ml-kit/main/text-recognition/README.md ; npm registry]. `@infinitered/react-native-mlkit-text-recognition` 5.0.1 (2025-11-25) is an Expo module; repo README maps Expo SDK ^56 -> mlkit ^6.0.0 and warns "Android support is currently under active development, some modules may not function as intended" and iOS simulator unsupported [DIGEST: https://raw.githubusercontent.com/infinitered/react-native-mlkit/main/README.md ; FETCHED-TODAY: https://docs.infinite.red/react-native-mlkit/text-recognition/ - `recognizeText(imagePath)` returns blocks/lines/elements with `frame {left, top, right, bottom}`]. No SDK 57 row published yet -> pin Expo SDK 56 if using it, or skip.
- Use for: English-only fallback / offline demo of "on-device" (e.g. reading English medicine labels), not Thai certificates.

### 2.2 ML Kit Document Scanner (Android) - recommended for capture
- Android only, delivered via Google Play services, edge detection, auto-crop, rotation, filters, multi-page, "No camera permission is required from your app" [DIGEST: https://developers.google.com/ml-kit/vision/doc-scanner]. RN options: `react-native-document-scanner-plugin` 2.0.4 (2026-01-02, Android+iOS; Expo via config plugin per Scanbot tutorial [DIGEST search: https://scanbot.io/techblog/how-to-use-react-native-document-scanner-plugin-with-expo/]) or `@infinitered/react-native-mlkit-document-scanner` 5.0.0 (2025-11-17, Expo module) [npm registry]. Fallback: `expo-camera` / `expo-image-picker` plain photo.

### 2.3 Apple Vision / Live Text (iOS) - Thai supported, but iOS is stretch
- Apple's iOS feature-availability page lists Thai among Live Text languages [DIGEST: https://www.apple.com/ios/feature-availability/]. Known issue: Vision misidentifies Khmer as Thai with `automaticallyDetectsLanguage` [DIGEST: https://developer.apple.com/forums/thread/811666]. `@react-native-ml-kit/text-recognition` on iOS still uses ML Kit (no Thai); a custom Expo module wrapping `VNRecognizeTextRequest` would be needed. Not recommended given no Xcode.

### 2.4 tesseract.js (server-side) - free, offline, but poor Thai
- v7.0.0 (2025-12-15), Node >= 16; `createWorker('tha')` (multi-lang 'tha+eng'); options `langPath`, `cachePath`, `gzip`; `recognize(image, {}, {blocks:true})` returns blocks->paragraphs->lines->words with `bbox` + `confidence` [DIGEST: https://raw.githubusercontent.com/naptha/tesseract.js/master/docs/api.md ; README]. Thai traineddata: https://github.com/tesseract-ocr/tessdata_best/blob/main/tha.traineddata.
- Quality: Thai-TrOCR card CER: Tesseract 0.76 (PDF), 1.06 (EN-TH PDF), 0.92 (real document), adjusted mean 1.27 vs EasyOCR 0.30 vs Thai-TrOCR 0.12 [DIGEST: https://huggingface.co/openthaigpt/thai-trocr]. A 2025 paper reports improving Tesseract on Thai via preprocessing [DIGEST search: https://www.sciencedirect.com/science/article/abs/pii/S2214579625000036]. Verdict: only as a "no-internet" degraded fallback for English text and to show word-level bounding boxes in the demo; never the primary Thai path.

### 2.5 Google Cloud Vision (TEXT_DETECTION / DOCUMENT_TEXT_DETECTION)
- Thai listed: "ไทย | Thai | th | Thai" (page updated 2026-08-26); `imageContext.languageHints: ["th","en"]` optional [DIGEST: https://docs.cloud.google.com/vision/docs/languages ; https://docs.cloud.google.com/vision/docs/ocr]. Response: fullTextAnnotation -> pages -> blocks -> paragraphs -> words -> symbols each with `boundingBox` vertices and `confidence` -> real bounding boxes for explainability.
- Price: first 1,000 units/month free, then $1.50 per 1,000 [DIGEST: https://cloud.google.com/vision/pricing]. Free Tier requires a billing account + credit card verification; $300 trial for 90 days [DIGEST: https://docs.cloud.google.com/free/docs/free-cloud-features]. Node client `@google-cloud/vision` 6.0.0 (2026-08-10): `client.documentTextDetection(path)`.
- Document AI: Thai supported for Enterprise Document OCR, Form Parser, Layout Parser [DIGEST: https://docs.cloud.google.com/document-ai/docs/languages]; pricing page fetch failed today -> pricing unverified. Overkill for this project.

### 2.6 Azure AI Vision Read / Document Intelligence
- Azure Vision language-support page fetched (ms.date 2025-09-26, updated 2026-06-05) and Document Intelligence Read/Layout language page (ms.date 2026-04-18); full Thai row text was truncated in the digest, so Thai printed-text support is [UNVERIFIED] from this research though Microsoft Q&A threads discuss Thai support [DIGEST: https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/language-support ; https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/language-support/ocr?view=doc-intel-4.0.0]. Document Intelligence F0: "0 - 500 pages free per month" [FETCHED-TODAY: https://azure.microsoft.com/en-us/pricing/details/ai-document-intelligence/]. Requires Azure account + card. Not recommended (extra vendor, unverified Thai).

### 2.7 AWS Textract - NOT viable
- Supported languages: "English, German, French, Spanish, Italian and Portuguese" for printed text/forms/tables; English only for invoices/IDs/queries; Thai absent [DIGEST: https://aws.amazon.com/textract/faqs/].

### 2.8 Typhoon OCR (SCB 10X) + Typhoon API - recommended free Thai text layer
- Model: Typhoon OCR 1.5, 2B params on Qwen3-VL-2B, Apache-2.0, released Nov 2025 (blog 2025-11-14); HF `scb10x/typhoon-ocr1.5-2b`; Ollama `scb10x/typhoon-ocr1.5-3b`; playground https://playground.opentyphoon.ai/ocr [DIGEST: https://huggingface.co/typhoon-ai/typhoon-ocr1.5-2b ; https://opentyphoon.ai/blog/en/typhoon-ocr-release ; https://ollama.com/scb10x]. Paper arXiv 2601.14722 (submitted 2026-01-21) claims "performance comparable to or exceeding larger frontier proprietary models" on Thai financial reports, government forms, books, infographics, handwriting [FETCHED-TODAY: https://arxiv.org/abs/2601.14722].
- Benchmarks (Typhoon blog): Thai Gov Forms BLEU 0.870 / ROUGE-L 0.967 / Levenshtein 0.035; Thai Books BLEU 0.746; Handwritten BLEU 0.522 (v1 7B: 0.321); Infographics 0.408; Overall BLEU 0.644 / ROUGE-L 0.774 / Lev 0.251 (v1: 0.558/0.686/0.332) [DIGEST].
- API: base URL `https://api.opentyphoon.ai/v1`, key from https://playground.opentyphoon.ai/api-key ; model id `typhoon-ocr` (v1.5); `typhoon-ocr-preview` (v1 7B) deprecated 2025-12-31; no `task_type` needed for 1.5; accepts PNG/JPEG/PDF; output "structured, layout-aware Markdown" (HTML tables, `<page_number>` wrappers); rate limit 2 RPS / 20 RPM; "The Typhoon API is a research showcase and free to use"; "we are collecting usage data from the Typhoon API. We use this data to improve the model"; production use -> Together AI [FETCHED-TODAY: quickstart, FAQ ; DIGEST: ocr, rate-limits pages]. Python helper `pip install typhoon-ocr` -> `ocr_document("test.png")`. For Node, call the OpenAI-compatible chat completions endpoint with the image as an `image_url` data URI and `model: "typhoon-ocr"` (the exact prompt/param contract for the Node path is [UNVERIFIED]; the safe path is a tiny Python microservice or child_process using `typhoon-ocr`, or a self-hosted Ollama `scb10x/typhoon-ocr1.5-3b` on the dev PC).
- Privacy: usage data collected -> same consent treatment as other cloud providers; not for real PHI in the demo.
- No bounding boxes, no field extraction, no per-word confidence.

### 2.9 Gemini API (vision LLM) - recommended free extractor for demo data
- Models (all image-capable, stable): `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`; `gemini-2.0-flash*` shut down [DIGEST: https://ai.google.dev/gemini-api/docs/models].
- Pricing [FETCHED-TODAY: https://ai.google.dev/gemini-api/docs/pricing]: 2.5 Flash-Lite free tier "Free of charge", paid $0.10 in / $0.40 out per MTok; 2.5 Flash free, paid $0.30/$2.50; 3.5 Flash-Lite free, paid $0.30/$2.50; 3.8 Flash free, paid $0.75/$3.75 (through 2026-12-31). Free tier rows: "Used to improve our products: Yes"; paid: No.
- Terms (effective 2026-03-23): Unpaid Services content used "to provide, improve, and develop Google products and services and machine learning technologies", human reviewers may read; "Do not submit sensitive, confidential, or personal information to the Unpaid Services." Paid: "Google doesn't use your prompts ... or responses to improve our products" [DIGEST: https://ai.google.dev/gemini-api/terms].
- Rate limits: not published on the docs page; "can be viewed in Google AI Studio" (https://aistudio.google.com/rate-limit); Tier 1 needs a linked billing account [DIGEST: https://ai.google.dev/gemini-api/docs/rate-limits]. Third-party summaries say Flash models ~5-15 RPM and up to 1,000 RPD on free tier, no credit card needed [DIGEST search, UNVERIFIED]. Thailand is an available region [DIGEST: https://ai.google.dev/gemini-api/docs/available-regions].
- Image tokens: <=384 px both sides = 258 tokens; larger images tiled into 768x768 tiles at 258 tokens each; max 20 MB inline; JPEG/PNG/WEBP/HEIC; object detection returns `[ymin, xmin, ymax, xmax]` normalized 0-1000 [DIGEST: https://ai.google.dev/gemini-api/docs/image-understanding].
- Structured output: `config.responseMimeType: "application/json"` + `config.responseJsonSchema` (JSON Schema) or `responseSchema` on `GenerateContentConfig` [DIGEST: https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html]; supported keywords: types string/number/integer/boolean/object/array/null, title, description, properties, required, additionalProperties, enum, format, minimum, maximum, items, prefixItems, minItems, maxItems; "Very large or deeply nested schemas may be rejected" [FETCHED-TODAY: https://ai.google.dev/gemini-api/docs/structured-output - note the docs' JS examples now show a newer `client.interactions.create({ response_format: {type:'text', mime_type:'application/json', schema} })` API; both paths exist in `@google/genai` 2.21.0 (2026-09-02, Node >= 20; 3.x will require Node 22)].
- Thai quality: ThaiOCRBench ranks Gemini 2.5 Pro first; Flash variants not separately quoted [FETCHED-TODAY arXiv abstract; DIGEST blog].

### 2.10 Claude API (vision LLM) - recommended paid/privacy-safe extractor + chatbot
- Pricing [FETCHED-TODAY: https://platform.claude.com/docs/en/about-claude/pricing]: Haiku 4.5 $1 in / $5 out / $0.10 cache-hit per MTok; Sonnet 5 $2/$10 (introductory price made permanent; 4.7+ tokenizer ~30% more tokens); Sonnet 4.6 $3/$15; Opus 4.8 $5/$25; Batch API 50% off; "New users receive a small amount of free credits".
- Vision [FETCHED-TODAY: https://platform.claude.com/docs/en/build-with-claude/vision]: JPEG/PNG/GIF/WebP; 10 MB per image base64; tokens = ceil(width/28) x ceil(height/28); standard tier (Haiku 4.5, Sonnet 4.6 and earlier) max long edge 1568 px / 1568 tokens; high-res tier (4.7+, Sonnet 5, Opus 4.8) 2576 px / 4784 tokens; 1000x1000 = 1296 tokens "about $1.30 USD per thousand images" on Haiku 4.5; warns heavy JPEG compression hurts text legibility; limitations: "might hallucinate ... very small images under 200 pixels", spatial outputs approximate, "not designed to interpret complex diagnostic scans"; "Anthropic does not use uploaded images to train models"; images "not stored beyond the duration of the API request".
- Bounding boxes [DIGEST: https://platform.claude.com/docs/en/build-with-claude/vision-coordinates]: ask for absolute pixel `[x1,y1,x2,y2]` (not normalized), pre-resize the image so coordinates map 1:1; combine with structured outputs.
- Structured outputs [DIGEST: https://platform.claude.com/docs/en/build-with-claude/structured-outputs]: `output_config.format = { type: "json_schema", schema }`; no beta header required now; supports enum/const/anyOf/$ref/format (date, date-time), `additionalProperties:false`; NOT supported: minimum/maximum, minLength/maxLength, recursive schemas. TS: `client.messages.parse({ ..., output_config: { format: zodOutputFormat(Schema) } })` from `@anthropic-ai/sdk/helpers/zod`; `response.parsed_output`. Supported models include claude-haiku-4-5-20251001, claude-sonnet-5, claude-opus-4-8.
- Data retention [DIGEST: https://platform.claude.com/docs/en/manage-claude/api-and-data-retention]: "Retained data is never used for model training without your express permission"; standard commercial retention 30 days; ZDR and HIPAA-ready arrangements exist (enterprise). Thailand: listed under "Countries ... where we currently offer commercial API access" [FETCHED-TODAY: https://www.anthropic.com/supported-countries].
- Thai quality: multilingual table lists 14 languages (no Thai) for Sonnet 4.5 / Haiku 4.5 [DIGEST: https://platform.claude.com/docs/en/build-with-claude/multilingual-support] -> Thai OCR accuracy [UNVERIFIED]; test on 10 real-format samples before the demo.
- Cost per document (computed from fetched prices): 1600x1200 px image on Haiku 4.5 = ceil(1600/28)=58 x ceil(1200/28)=43 = 2,494 image tokens ($0.0025) + ~900 prompt tokens ($0.0009) + ~700 output tokens ($0.0035) ~= USD 0.007/document; Sonnet 5 ~= USD 0.014 (plus 30% tokenizer uplift on text). 200 demo documents ~= USD 1.5 on Haiku.

### 2.11 OpenAI (for completeness)
- Pricing page blocked (403) and third-party pages inconsistent; gpt-4o-mini $0.15/$0.60 per MTok on developers.openai.com pricing page [DIGEST]; API data not used for training since 2023-03-01, 30-day abuse-monitoring retention, image inputs scanned for CSAM even under ZDR [DIGEST: https://developers.openai.com/api/docs/guides/your-data]. No free tier. Not recommended (no advantage over Gemini/Claude here).

### 2.12 On-device Gemini Nano (ML Kit GenAI Prompt API) - NOT viable
- Beta, Android API 26+, AICore + Gemini Nano on ~30 flagship devices; Summarization API "supports English, Japanese, and Korean"; Prompt API languages unspecified, input < 4,000 tokens; Thai not listed anywhere [DIGEST: https://developers.google.com/ml-kit/genai ; .../genai/prompt/android ; .../genai/summarization/android]. No RN/Expo wrapper. Skip.

### 2.13 Other free/open options
- OCR.space: Thai only on Engine 2 (Engine 3 claims 200+ languages); free 25,000 req/month, 1 MB file, 500 req/day/IP, 3 PDF pages [DIGEST: https://ocr.space/thai ; https://ocr.space/ocrapi]. Quality unknown; plausible zero-key fallback.
- Thai-TrOCR (`openthaigpt/thai-trocr`, 0.1B, Apache-2.0): CER 0.12 mean, line-level recognizer (needs a detector) [DIGEST]. PaddleOCR-VL (0.9B, 109 languages) [DIGEST search: https://huggingface.co/PaddlePaddle/PaddleOCR-VL] - Thai coverage unverified. Self-hosting either on a Windows laptop without GPU is too slow for a live demo; keep as "future work".

---
## 3. Comparison table

| Option | Thai | Structured fields | Boxes/conf | Free? | Expo/Win-Android OK | Verdict |
|---|---|---|---|---|---|---|
| ML Kit Text Rec v2 (on-device) | No | No | Boxes yes | Yes | Yes (Expo module, SDK<=56) | English-only fallback |
| ML Kit Document Scanner | n/a | n/a | n/a | Yes | Yes | Use for capture |
| Apple Vision | Yes | No | Boxes | Yes | iOS only, needs custom module | Stretch |
| tesseract.js tha | Very poor (CER ~0.9-1.3) | No | Word boxes + conf | Yes | Server | Offline fallback only |
| Cloud Vision DOCUMENT_TEXT_DETECTION | Yes | No | Symbol-level boxes + conf | 1,000 units/mo, needs card | Server | Optional boxes source |
| Azure Read / Doc Intelligence | Unverified | Forms yes | Yes | 500 pages/mo F0, needs card | Server | Skip |
| AWS Textract | No | - | - | - | - | Skip |
| Typhoon OCR API | Yes (specialised) | Markdown only | No | Free, 20 RPM | Server | Text layer + cross-check |
| Gemini 2.5/3.5 Flash(-Lite) | Yes (Gemini 2.5 Pro best on ThaiOCRBench) | JSON schema | Normalized boxes | Free tier (trains on data) / paid cheap | Server | Demo extractor (synthetic docs) |
| Claude Haiku 4.5 / Sonnet 5 | Likely, unverified | JSON schema (guaranteed) | Pixel boxes (approx.) | ~$0.007/doc, small free credits | Server | Privacy-safe extractor + chatbot |
| Gemini Nano on-device | No | - | - | Yes | No wrapper | Skip |
| OCR.space | Engine 2 | No | Yes | 25k/mo | Server | Emergency fallback |

---
## 4. Recommended architecture (client -> Express -> providers)

```
Expo app (SDK 57)
  Scan screen: @infinitered/react-native-mlkit-document-scanner (Android auto-crop) OR expo-image-picker (camera)
  -> expo-image-manipulator: resize longest edge 1600 px, JPEG compress 0.85, EXIF stripped by re-encode
  -> quick client check: reject if width < 800 px
  -> POST /api/documents/extract  (multipart/form-data, field "image", Bearer JWT, consentVersion)
Express (Node 22, TypeScript)
  multer 2.3.0 (memoryStorage, 8 MB limit, jpeg/png only)
  sharp 0.35.4: rotate() (uses EXIF then drops it), resize max 1600, toFormat('jpeg',{quality:85}); blur score = variance of Laplacian (sharp .convolve 3x3 laplacian -> .stats())
  if blur score < threshold -> 422 { code: "IMAGE_BLURRY" }
  Promise.allSettled([ typhoonOcr(imageBuffer), llmExtract(imageBuffer, schema) ])
  postProcess(): validators, BE->CE dates, OCR-agreement, confidence fusion
  persist: documents(id, user_id, type, image_path(encrypted at rest), raw_ocr_text, extraction_json, model, provider, created_at)
  respond: { extraction, fieldMeta, ocrText, warnings[] }
App
  Review screen: field list with confidence chip (green >=0.85 / amber 0.6-0.85 / red <0.6), tap = show source snippet (and highlight box if provider returned one), inline edit, "Save" -> PUT /api/documents/:id
  Explain screen: chatbot "อธิบายเอกสารนี้แบบง่าย ๆ" (uses extraction JSON, not the image)
```

Provider abstraction (`server/src/extract/providers/{gemini.ts,claude.ts,typhoon.ts,tesseract.ts}`) with env `EXTRACT_PROVIDER=gemini|claude` and `OCR_PROVIDER=typhoon|tesseract|none`. Fallback order on 429/5xx: primary LLM -> secondary LLM -> "manual entry" mode with OCR text prefilled.

Packages (exact, from npm registry 2026-09-03): `@google/genai@2.21.0`, `@anthropic-ai/sdk@0.123.0`, `zod@4.5.4`, `multer@2.3.0`, `sharp@0.35.4`, `tesseract.js@7.0.0` (optional), `@google-cloud/vision@6.0.0` (optional), `expo-image-manipulator@57.0.15`, `@infinitered/react-native-mlkit-document-scanner@5.0.0` (check SDK 57 compatibility; else `react-native-document-scanner-plugin@2.0.4` with its Expo config plugin; else plain `expo-image-picker`).

Commands:
```
# app
npx expo install expo-image-manipulator expo-image-picker expo-file-system
npm i @infinitered/react-native-mlkit-document-scanner   # then npx expo prebuild --platform android && npx expo run:android
# server
npm i express multer sharp zod @google/genai @anthropic-ai/sdk
npm i -D typescript tsx @types/express @types/multer
```

---
## 5. Extraction prompt (system + user) - Thai/English medical documents

System prompt (send once; cache with Claude `cache_control` or keep short for Gemini):
```
You are a medical-document extraction engine for a Thai patient app. Input: one photo of a Thai and/or English medical document (medical certificate ใบรับรองแพทย์, prescription, medicine label, lab result, receipt) or a non-medical image.
Rules:
1. Output ONLY JSON matching the provided schema. Never invent values: if a field is not visible, set value to null and confidence to 0.
2. For every field give `evidence`: the exact source text you read (verbatim, original language, max 120 chars) and `confidence` 0.0-1.0 reflecting legibility and certainty.
3. Dates: return ISO 8601 (YYYY-MM-DD). Thai Buddhist Era years (พ.ศ., or years > 2400) must be converted by subtracting 543; keep the original string in evidence.
4. Keep Thai text in Thai; do not translate diagnosis. Add `diagnosis_en` only if an English diagnosis is printed.
5. Doctor licence numbers look like "ว.12345" (ใบอนุญาตประกอบวิชาชีพเวชกรรม เลขที่). ICD-10 codes look like J06.9; only output a code that is printed.
6. Medications: one entry per drug with name, strength, dose, frequency (as printed, e.g. "1 เม็ด วันละ 3 ครั้ง หลังอาหาร"), duration/quantity.
7. If the image is not a medical document set document_type = "not_medical" and leave other fields null. If text is unreadable set image_quality = "poor" and explain in `warnings`.
8. This is an educational prototype; do not add medical advice.
```
User content: [image] + "Extract the document. Today is {ISO date}. Expected language: Thai/English."

---
## 6. JSON schema (shared by Gemini `responseJsonSchema` and Claude `output_config.format.schema`)

Design: every field is an object `{ value, confidence, evidence }` so per-field confidence and explainability come from the same call. Avoid `minimum/maximum/minLength` (Claude rejects them); avoid deep nesting (Gemini may reject).

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["document_type","language","image_quality","patient_name","hospital","doctor_name","doctor_license_no","visit_date","diagnosis","icd10_codes","medications","rest_days","rest_from","rest_to","follow_up_date","notes","warnings"],
  "properties": {
    "document_type": {"type":"string","enum":["medical_certificate_sick_leave","medical_certificate_5_disease","prescription","medication_label","lab_result","receipt","other_medical","not_medical"]},
    "language": {"type":"string","enum":["th","en","mixed","other"]},
    "image_quality": {"type":"string","enum":["good","fair","poor"]},
    "patient_name": {"$ref":"#/$defs/strField"},
    "hospital": {"$ref":"#/$defs/strField"},
    "doctor_name": {"$ref":"#/$defs/strField"},
    "doctor_license_no": {"$ref":"#/$defs/strField"},
    "visit_date": {"$ref":"#/$defs/dateField"},
    "diagnosis": {"$ref":"#/$defs/strField"},
    "icd10_codes": {"type":"array","items":{"$ref":"#/$defs/strField"}},
    "medications": {"type":"array","items":{
      "type":"object","additionalProperties":false,
      "required":["name","strength","dose","frequency","duration","confidence","evidence"],
      "properties":{
        "name":{"type":["string","null"]},"strength":{"type":["string","null"]},
        "dose":{"type":["string","null"]},"frequency":{"type":["string","null"]},
        "duration":{"type":["string","null"]},
        "confidence":{"type":"number"},"evidence":{"type":["string","null"]}}}},
    "rest_days": {"$ref":"#/$defs/intField"},
    "rest_from": {"$ref":"#/$defs/dateField"},
    "rest_to": {"$ref":"#/$defs/dateField"},
    "follow_up_date": {"$ref":"#/$defs/dateField"},
    "notes": {"$ref":"#/$defs/strField"},
    "warnings": {"type":"array","items":{"type":"string"}}
  },
  "$defs": {
    "strField": {"type":"object","additionalProperties":false,"required":["value","confidence","evidence"],
      "properties":{"value":{"type":["string","null"]},"confidence":{"type":"number"},"evidence":{"type":["string","null"]}}},
    "intField": {"type":"object","additionalProperties":false,"required":["value","confidence","evidence"],
      "properties":{"value":{"type":["integer","null"]},"confidence":{"type":"number"},"evidence":{"type":["string","null"]}}},
    "dateField": {"type":"object","additionalProperties":false,"required":["value","confidence","evidence"],
      "properties":{"value":{"type":["string","null"],"description":"ISO 8601 date YYYY-MM-DD, CE year"},"confidence":{"type":"number"},"evidence":{"type":["string","null"]}}}
  }
}
```
Gemini note: if `$ref/$defs` is rejected, inline the three field shapes (the supported keyword list does not mention `$ref`). Claude supports `$ref` [DIGEST].

Optional bounding boxes: add `"box": {"type":["array","null"],"items":{"type":"integer"}}` to each field. Claude: ask for absolute pixel `[x1,y1,x2,y2]` on the pre-resized 1600 px image. Gemini: `[ymin,xmin,ymax,xmax]` normalized 0-1000 -> multiply by image size / 1000. Treat as approximate; render as translucent highlight only.

Provider call snippets:
```ts
// Gemini (@google/genai 2.21.0)
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const r = await ai.models.generateContent({
  model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  contents: [{ role: "user", parts: [
    { inlineData: { mimeType: "image/jpeg", data: jpegBase64 } },
    { text: userPrompt } ] }],
  config: { systemInstruction: SYSTEM_PROMPT, responseMimeType: "application/json",
            responseJsonSchema: EXTRACTION_SCHEMA, temperature: 0 }
});
const json = JSON.parse(r.text);

// Claude (@anthropic-ai/sdk 0.123.0)
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();
const msg = await client.messages.create({
  model: "claude-haiku-4-5",  // or "claude-sonnet-5"
  max_tokens: 2048,
  system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
  messages: [{ role: "user", content: [
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpegBase64 } },
    { type: "text", text: userPrompt } ] }],
  output_config: { format: { type: "json_schema", schema: EXTRACTION_SCHEMA } }
});
const json = JSON.parse(msg.content.find(b => b.type === "text").text);
```
Validate both with `zod` (`ExtractionSchema.safeParse`) before trusting.

---
## 7. Per-field confidence fusion and explainability

`finalConfidence = clamp( llmConf * validatorFactor * agreementFactor * qualityFactor )`
- validatorFactor: 1.0 if regex/date parse passes; 0.5 if fails (licence regex `ว\.?\s*\d{4,6}`, ICD-10 regex, date parse + sanity: visit_date <= today, rest_to >= rest_from, rest_days == (rest_to - rest_from + 1) else 0.7).
- agreementFactor: 1.0 if normalized `value` (or `evidence`) is a substring of Typhoon OCR Markdown (strip spaces); 0.8 if fuzzy match (Levenshtein ratio >= 0.85); 0.6 if absent. Skip when OCR provider unavailable (factor 1.0, flag `ocr_unavailable`).
- qualityFactor: 1.0 good, 0.9 fair, 0.7 poor (from LLM `image_quality` and sharp blur score).
- Thresholds: >= 0.85 green "อ่านได้ชัดเจน"; 0.60-0.85 amber "โปรดตรวจสอบ"; < 0.60 red "ไม่แน่ใจ กรุณาแก้ไข"; null -> grey "ไม่พบข้อมูล".
- Explainability UI: each field row shows `evidence` in a quote bubble ("แหล่งที่มา: 'ควรพักรักษาตัว 3 วัน'"); tapping opens the document image with the highlight box when available; a "Why?" line summarises factors (e.g. "matched OCR text, valid date, image quality fair"). Document-level banner: "AI-extracted; verify before use; not medical advice".
- Log `{provider, model, latency_ms, tokens, confidence_hist}` to an `extraction_runs` table for the README's evaluation section (rubric: testing/error handling).

---
## 8. Error handling matrix

| Condition | Detection | Response / UX |
|---|---|---|
| Blurry / too small | sharp Laplacian variance < ~100 (tune on samples) or width < 800 px | 422 IMAGE_BLURRY -> "ภาพไม่ชัด กรุณาถ่ายใหม่ในที่สว่าง" with retake button |
| Not a medical document | `document_type == "not_medical"` | 200 with warning; offer "save as photo only" |
| Low confidence fields | finalConfidence < 0.6 | Red highlight, mandatory review before save; Save disabled until user confirms red fields |
| Schema/JSON failure | zod parse fails | retry once with "Return valid JSON only"; then fallback provider; then manual entry with OCR text |
| Rate limit 429 (Gemini free / Typhoon 20 RPM) | HTTP 429 | exponential backoff 1s,2s,4s (max 3); then switch provider; show "ระบบกำลังยุ่ง" |
| Provider outage / no internet | timeout 20 s | queue upload (expo-file-system + AsyncStorage), retry later; demo backup: cached sample extraction JSON |
| Wrong BE/CE date | year > 2400 or > today+1y | auto-convert; flag amber with evidence |
| Multi-page | user scans N pages | send each page separately; merge by document_id; LLM told "page i of N" |

Demo-day resilience: pre-extract 5 sample documents and store results in DB; add a "Use demo document" button that replays the pipeline from a stored image so the live demo still shows the API call even if the camera fails.

---
## 9. Privacy / responsible-use handling

- Thai PDPA Section 26: health data is sensitive personal data requiring explicit consent, with narrow exceptions (e.g. danger to life when the subject cannot consent) [DIGEST: https://pdpathailand.com/pdpa/content_eng/article26_eng.php]. Implement a Consent screen (Category 5) before first scan: what is sent (photo of document), to whom (named provider), retention, right to delete; store `consent_version`, `consented_at` in `users`.
- Provider policy facts to cite in README: Gemini Unpaid Services train on content and warn against personal data [DIGEST terms]; Gemini paid tier and Claude API do not train on inputs; Claude 30-day retention, images not stored beyond the request [FETCHED-TODAY vision FAQ; DIGEST retention page]; Typhoon collects usage data to improve the model [FETCHED-TODAY FAQ]; OpenAI 30-day abuse monitoring [DIGEST].
- Policy for this prototype: (a) all demo/testing uses synthetic or de-identified sample certificates created by the medical-consultant teammate; (b) `PRIVACY_MODE=strict` env forces the Claude adapter (or Gemini paid) and disables Typhoon; (c) minimal data: send only the image and the schema, never the user's profile; (d) strip EXIF (sharp re-encode) and GPS; (e) store images encrypted at rest (AES-256-GCM with a server key, or object storage with SSE) and serve over HTTPS only; (f) do not log raw OCR text at info level; (g) delete endpoint `DELETE /api/documents/:id` purges image + JSON; (h) in-app disclaimer: "ต้นแบบเพื่อการศึกษา ไม่ใช่เครื่องมือวินิจฉัยหรือรักษา".

---
## 10. "Explain this document in plain Thai" chatbot

- Same provider adapter; input = extraction JSON (not the image) + user question; system prompt: answer in simple Thai (ระดับผู้สูงอายุอ่านเข้าใจ), explain what each field means, what the rest days/follow-up mean, never diagnose or change medication, always end with "หากมีข้อสงสัย โปรดปรึกษาแพทย์หรือเภสัชกร"; refuse questions asking for dosage changes.
- Cost: ~1,000 input + 300 output tokens -> Haiku 4.5 ~ $0.0025/turn; Gemini Flash-Lite free tier $0 (synthetic data only).
- Rubric mapping: "Chatbot explanation for preliminary results" (Cat 4) + "Summary report that clearly states limitations and next steps" (Cat 5).
- Streaming is optional; a simple non-streaming call with a loading spinner is sufficient for the demo.

---
## 11. Effort estimate (AI-agent execution, calendar days)

| Item | Days | Tier |
|---|---|---|
| Express `/extract` with multer + sharp + Gemini adapter + zod validation + PostgreSQL persistence | 1.5 | guaranteed |
| Expo scan -> compress -> upload -> review/edit screen with confidence chips + evidence snippets | 2 | guaranteed |
| Claude adapter + provider fallback + PRIVACY_MODE + consent screen | 1 | likely |
| Typhoon OCR text layer + agreement scoring + "Why?" explanation | 1 | likely |
| Plain-Thai explanation chatbot screen | 0.5-1 | likely |
| Bounding-box highlight overlay (Gemini normalized boxes or Claude pixel boxes) | 1 | stretch |
| ML Kit Document Scanner (auto-crop) via infinitered module + prebuild | 0.5-1 | stretch |
| tesseract.js offline English fallback + word boxes | 0.5 | stretch |

---
## 12. Open gaps (not resolved by this research)
- Thai OCR accuracy of Claude Haiku 4.5 / Sonnet 5 and of Gemini 2.5 Flash-Lite specifically: no benchmark row found; must be tested on the team's sample documents (create 10 synthetic certificates + 5 medicine labels).
- Gemini free-tier exact RPM/RPD: only visible in AI Studio per project; third-party figures (5-15 RPM, 1,000 RPD) unverified.
- Typhoon API Node request contract for `typhoon-ocr` (chat-completions with image_url vs a dedicated /ocr route): only the Python helper is documented; verify with one curl before coding.
- Azure Read Thai printed-text support and Document AI pricing: pages fetched but rows truncated / fetch failed.
- `@infinitered/react-native-mlkit-*` compatibility with Expo SDK 57 (table ends at SDK 56 -> mlkit 6.x).
- ML Kit Document Scanner output format (JPEG/PDF) not confirmed from the fetched page.
- Claude bounding-box precision on Thai documents (docs say "approximate").
