# Research: free Thai OCR and extraction stack (Typhoon OCR + Gemini free tier), verified 2026-09-03

# typhoon — Typhoon API (SCB 10X, https://docs.opentyphoon.ai) as of 2026-09-03 — OCR request shape, free text models, JSON output, rate limits, cost, Thai quality

- [confirmed] Base URL is https://api.opentyphoon.ai/v1 and the API is OpenAI-compatible (POST /v1/chat/completions, Authorization: Bearer <key>)
  - Quickstart shows curl to 'https://api.opentyphoon.ai/v1/chat/completions' with '--header Authorization: Bearer <YOUR_API_KEY>' and openai SDK usage with base_url='https://api.opentyphoon.ai/v1'; docs say the API is 'compatible with OpenAI's API format'. API reference (https://docs.opentyphoon.ai/en/api-reference/) lists params: model, messages, max_tokens, temperature (0-2, default 0.7), top_p, stream, stop, presence_penalty, frequency_penalty, repetition_penalty (1.0-2.0), n, user.
  - https://docs.opentyphoon.ai/en/quickstart/
- [confirmed] Typhoon OCR is called through the same /chat/completions endpoint with a multimodal user message: {type:'text'} prompt + {type:'image_url', image_url:{url:'data:image/png;base64,...'}}; there is no dedicated OCR route
  - Verified by downloading typhoon-ocr 0.4.1 wheel (pip download) and reading typhoon_ocr/ocr_utils.py: prepare_ocr_messages builds messages=[{role:'user',content:[{type:'text',text:prompt_text},{type:'image_url',image_url:{url:f'data:image/png;base64,{image_base64}'}}]}] and ocr_document calls openai.chat.completions.create(model='typhoon-ocr', messages=messages, max_tokens=16384, extra_body={'repetition_penalty': 1.1 (v1.5) or 1.2, 'temperature': 0.1, 'top_p': 0.6}) with base_url default 'https://api.opentyphoon.ai/v1' and key from TYPHOON_OCR_API_KEY / TYPHOON_API_KEY / OPENAI_API_KEY.
  - https://pypi.org/project/typhoon-ocr/
- [confirmed] Current OCR model id is 'typhoon-ocr' (Typhoon OCR 1.5, 2B); 'typhoon-ocr-preview' (v1, 7B) was deprecated 31 Dec 2025 and is no longer listed on the models or rate-limits pages
  - OCR docs: typhoon-ocr = 'Typhoon OCR 1.5, 2B' recommended default; typhoon-ocr-preview = legacy v1 7B, 'deprecated Dec 31, 2025'; v1.5 'no longer requires task_type'. Models page (https://docs.opentyphoon.ai/en/models/) lists only typhoon-v2.5-30b-a3b-instruct, typhoon-v2.1-12b-instruct, typhoon-ocr, typhoon-asr-realtime.
  - https://docs.opentyphoon.ai/en/ocr/
- [confirmed] The exact v1.5 OCR prompt the official package sends (model 'is intended to be used with a specific prompt only; it will not work with any other prompts')
  - From ocr_utils.py PROMPTS_SYS['v1.5']: "Extract all text from the image.\n\n\nInstructions:\n- Only return the clean Markdown.\n- Do not include any explanation or extra text.\n- You must include all information on the page.\n\n\nFormatting Rules:\n- Tables: Render tables using <table>...</table> in clean HTML format.\n- Equations: Render equations using LaTeX syntax with inline ($...$) and block ($$...$$).\n- Images/Charts/Diagrams: Wrap any clearly defined visual areas (e.g. charts, diagrams, pictures) in:\n\n\n<figure>\nDescribe the image's main elements (people, objects, text), note any contextual clues (place, event, culture), mention visible text and its meaning, provide deeper analysis when relevant (especially for financial charts, graphs, or documents), comment on style or architecture if relevant, then give a concise overall summary. Describe in {figure_language}.\n</figure>\n\n\n- Page Numbers: Wrap page numbers in <page_number>...</page_number> (e.g., <page_number>14</page_number>).\n- Checkboxes: Use ☐ for unchecked and ☑ for checked boxes." where {figure_language} is 'Thai' or 'English'. HF card: 'This model is intended to be used with a specific prompt only; it will not work with any other prompts.' Also 'no VQA capability' and hallucination risk acknowledged.
  - https://huggingface.co/scb10x/typhoon-ocr1.5-2b
- [confirmed] OCR output format: v1.5 returns plain Markdown text (HTML tables, LaTeX, <figure>, <page_number>) directly in choices[0].message.content — NOT JSON; only the legacy v1 prompts wrapped output as {"natural_text": ...}
  - ocr_utils.py: 'For v1.5, text is returned directly without JSON wrapping'; for default/structure task types it does json.loads(text_output)['natural_text']. Legacy v1 prompts end with 'Your final output must be in JSON format with a single key `natural_text` containing the response.' The OCR model cannot be asked for custom field-level JSON; field extraction + confidence must be a second step (a text model or your own code).
  - https://pypi.org/project/typhoon-ocr/
- [confirmed] Image handling: PNG/JPEG images and PDF supported; package resizes the image so the longest side is 1800 px (target_image_dim=1800, only if >300 px), re-encodes as JPEG bytes but labels the data URI 'data:image/png;base64,...'; PDFs are rendered per page with pdftoppm (poppler) to a raster and sent as image — the API itself receives only an image per request (one page per call)
  - Docs: 'PNG, JPEG' and 'PDF' supported; poppler (pdfinfo, pdftoppm) needed for PDFs. Code: resize_if_needed(img, max_size=target_image_dim) with LANCZOS; image_to_base64png saves format='JPEG' then embeds under data:image/png prefix (server accepts it). Whether the API accepts a raw PDF data URI directly is unverified (package never sends one).
  - https://docs.opentyphoon.ai/en/ocr/
- [confirmed] Text/instruct models on the free API: typhoon-v2.5-30b-a3b-instruct (128K ctx on docs, MoE 3B active, 'agentic tasks') and typhoon-v2.1-12b-instruct (56K ctx, 'Complex Thai language understanding and generation'); both Thai+English
  - Models page table lists these two text models plus typhoon-ocr and typhoon-asr-realtime. HF card typhoon-ai/typhoon2.5-qwen3-30b-a3b: 'Primary Language(s): Thai and English', '256K' context, Qwen3 based, Apache 2.0, recommends low temperature and repetition_penalty 1.05.
  - https://docs.opentyphoon.ai/en/models/
- [unverified] Structured output: tool/function calling IS documented (tools=[...] on chat.completions with typhoon-v2.1-12b-instruct); response_format json_object / json_schema is NOT documented anywhere on docs.opentyphoon.ai — the official 'Structured Output' example just prompts 'return it as a valid JSON object with these fields' at temperature=0.1
  - Examples page 'Structured Output': prompt 'Extract the following information from the text below and return it as a valid JSON object with these fields...' with model typhoon-v2.1-12b-instruct, temperature=0.1 — prompt-based, no response_format. API reference param list has no response_format. Tool calling page (https://docs.opentyphoon.ai/en/tool/) shows tools=[dailyColor]; HF card for 2.5-30b shows tool_choice 'auto' via vLLM. Whether api.opentyphoon.ai accepts response_format={type:'json_object'} or json_schema is unverified (could not test without a key; backend is vLLM-like so it may work). Safe path: prompt for JSON + parse/validate yourself, or use tools with a JSON schema to force structure.
  - https://docs.opentyphoon.ai/en/examples/
- [confirmed] The Typhoon API is free ('research showcase') with signup at opentyphoon.ai / playground.opentyphoon.ai; no credit card or pricing is mentioned; 'Typhoon API Pro — Coming soon'
  - FAQ: 'The Typhoon API is a research showcase and free to use.' and 'Typhoon is a research showcase. It is currently in development and may generate harmful or inappropriate responses.' Authentication page: 'Sign up for an account at OpenTyphoon.ai ... Navigate to the API Keys section ... Create new API key'; quickstart: 'You will need to create an account and login to access the playground'. Model page (https://opentyphoon.ai/model/typhoon-ocr): 'Free API with the rate of 20 reqs/min' and 'Typhoon API Pro — Coming soon'. No mention of credit card/billing on any docs page (absence, not an explicit 'no card' statement). Rate-limits page: for production, 'support us by using the API through Together AI, our infrastructure partner' (paid).
  - https://docs.opentyphoon.ai/en/faq/
- [confirmed] Rate limits (free API): typhoon-ocr 2 RPS / 20 RPM; typhoon-v2.5-30b-a3b-instruct 5 RPS / 200 RPM; typhoon-v2.1-12b-instruct 5 RPS / 200 RPM; typhoon-asr-realtime 100 RPM; 429 on exceed; higher limits by emailing contact@opentyphoon.ai
  - Page: two limit types 'Requests per second (RPS)' and 'Requests per minute (RPM)', varies by model; exceeding returns '429 Too Many Requests' with retry info. No daily/monthly token quota published. API reference notes max_tokens default 150 and 'max 8192 shared tokens' (context+output) for chat — but the official OCR package sends max_tokens=16384 to typhoon-ocr, so the 8192 cap appears to apply to the text models only (unverified).
  - https://docs.opentyphoon.ai/en/rate-limits/
- [confirmed] Data policy: SCB 10X collects API usage data to improve models; outputs belong to the user; prompts/outputs may be used to 'provide, maintain, develop, and improve our Services'; users may not use the service to train other AI models
  - FAQ: 'Yes, we are collecting usage data from the Typhoon API. We use this data to improve the model and the API. We are committed to protecting your privacy and we will never share your data with third parties.' and 'SCB 10X claims no rights in Outputs you generate using Typhoon. You and your users are solely responsible for Outputs and their subsequent uses.' T&C: company may 'use Output and/or Content to provide, maintain, develop, and improve our Services'; users get a 'limited, non-exclusive, non-transferable license to use the Services and the Output' and may 'use, reproduce, modify, and distribute the Output'; prohibited: using services 'to train, fine tune, or otherwise improve any Artificial Intelligence Models or Datasets', 'competitive benchmarking, data scraping, or model extraction'. Implication: medical certificates (personal health data) sent to the free API may be retained for model improvement — a PDPA consideration for the project.
  - https://opentyphoon.ai/tac
- [confirmed] Thai document quality evidence: Typhoon OCR 1.5 (2B) averages BLEU 0.644 / ROUGE-L 0.774 / Levenshtein 0.251 vs Gemini 2.5 Pro 0.605/0.743/0.289, GPT-5 0.459/0.618/0.390, v1 7B 0.558/0.686/0.332; Thai government forms BLEU 0.870 / ROUGE-L 0.967 / Levenshtein 0.035; handwritten forms BLEU 0.522 / ROUGE-L 0.645; infographics BLEU 0.408 / ROUGE-L 0.527
  - Official release blog (SCB 10X, self-reported benchmark, no third-party validation): 'BLEU: Average score improved from 0.558 (v1) to 0.644 (v1.5)', 'ROUGE-L: Average increased from 0.686 to 0.774', Thai Government Forms 'BLEU 0.870, ROUGE-L 0.967, Levenshtein 0.035, outperforming even Gemini 2.5 Pro and GPT-5'. Technical report arXiv 2601.14722 'Typhoon OCR: Open Vision-Language Model For Thai Document Extraction' claims 'performance comparable to or exceeding larger frontier proprietary models' across financial reports, government forms, books, infographics, handwritten materials. No medical-certificate-specific benchmark exists; government forms are the closest category. The model outputs no per-token confidence — confidence scores must be derived (e.g., a second LLM pass, regex/format validation, or comparing two OCR runs).
  - https://opentyphoon.ai/blog/en/typhoon-ocr-release
- [confirmed] Model weights are open (Apache 2.0) on Hugging Face: scb10x/typhoon-ocr1.5-2b (Qwen3-VL 2B), scb10x/typhoon-ocr-7b (Qwen2.5-VL), typhoon-ai/typhoon2.5-qwen3-30b-a3b — self-hosting is possible if the free API is insufficient
  - HF cards state Apache 2.0; OCR 1.5 'Built on top of Qwen3-VL 2B'; vLLM example uses max_tokens 10000 and the same chat/completions image_url message shape.
  - https://huggingface.co/scb10x/typhoon-ocr1.5-2b

## nodeSnippet
```
// Node 18+ (native fetch). Step 1: OCR the photo with typhoon-ocr (returns Markdown, not JSON).
// Step 2: turn the Markdown into structured fields + per-field confidence with a text model.
import { readFileSync } from "node:fs";

const BASE = "https://api.opentyphoon.ai/v1";
const KEY = process.env.TYPHOON_API_KEY; // free key from https://playground.opentyphoon.ai > API Keys

// Exact v1.5 prompt shipped in the official typhoon-ocr package (model only works with this prompt)
const OCR_PROMPT = `Extract all text from the image.


Instructions:
- Only return the clean Markdown.
- Do not include any explanation or extra text.
- You must include all information on the page.


Formatting Rules:
- Tables: Render tables using <table>...</table> in clean HTML format.
- Equations: Render equations using LaTeX syntax with inline ($...$) and block ($$...$$).
- Images/Charts/Diagrams: Wrap any clearly defined visual areas (e.g. charts, diagrams, pictures) in:


<figure>
Describe the image's main elements (people, objects, text), note any contextual clues (place, event, culture), mention visible text and its meaning, provide deeper analysis when relevant (especially for financial charts, graphs, or documents), comment on style or architecture if relevant, then give a concise overall summary. Describe in Thai.
</figure>


- Page Numbers: Wrap page numbers in <page_number>...</page_number> (e.g., <page_number>14</page_number>).
- Checkboxes: Use ☐ for unchecked and ☑ for checked boxes.
    `;

async function chat(body) {
  const r = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); // 429 = rate limit (OCR: 2 rps / 20 rpm)
  return (await r.json()).choices[0].message.content;
}

export async function ocrImage(path, mime = "image/jpeg") {
  // Resize client-side so the longest side is ~1800 px (what the official package does) before base64.
  const b64 = readFileSync(path).toString("base64");
  return chat({
    model: "typhoon-ocr",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: OCR_PROMPT },
        { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
      ],
    }],
    max_tokens: 16384,
    temperature: 0.1,
    top_p: 0.6,
    repetition_penalty: 1.1,
  });
}

export async function extractFields(markdown) {
  const text = await chat({
    model: "typhoon-v2.5-30b-a3b-instruct", // or typhoon-v2.1-12b-instruct (5 rps / 200 rpm)
    messages: [
      { role: "system", content: "You extract fields from Thai/English medical certificates. Reply with a single valid JSON object only, no prose, no markdown fences." },
      { role: "user", content: `Return JSON: {"patient_name":{"value":string|null,"confidence":0-1},"doctor_name":{...},"hospital":{...},"diagnosis":{...},"exam_date":{"value":"YYYY-MM-DD"|null,"confidence":0-1},"rest_from":{...},"rest_to":{...},"license_no":{...}}. confidence = how certain you are the value is exactly what the document says (1.0 only if the text is unambiguous). Convert Thai Buddhist-era years to CE.\n\nDOCUMENT (OCR Markdown):\n${markdown}` },
    ],
    max_tokens: 1024,
    temperature: 0.1,
    repetition_penalty: 1.05,
    // response_format: { type: "json_object" }  // NOT documented for api.opentyphoon.ai; unverified — keep the prompt-based JSON + parsing below
  });
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1); // tolerate stray text/fences
  return JSON.parse(json);
}

// const md = await ocrImage("cert.jpg"); const fields = await extractFields(md);
```
## freeTierLimits
Free ("research showcase"); signup required at opentyphoon.ai / playground.opentyphoon.ai to create an API key; no credit card or billing mentioned anywhere in docs. Per-model limits (docs.opentyphoon.ai/en/rate-limits, fetched 2026-09-03): typhoon-ocr 2 requests/second, 20 requests/minute; typhoon-v2.5-30b-a3b-instruct and typhoon-v2.1-12b-instruct 5 RPS / 200 RPM; typhoon-asr-realtime 100 RPM. Exceeding returns HTTP 429 with retry info. No published daily/monthly quota or token cap (API reference says max_tokens default 150, 'max 8192 shared tokens' for chat; OCR package uses 16384). Higher limits: email contact@opentyphoon.ai; for production they ask you to use Together AI (paid). 'Typhoon API Pro — Coming soon' (opentyphoon.ai/model/typhoon-ocr). typhoon-ocr-preview (v1) deprecated 31 Dec 2025 — do not use.
## dataPolicy
FAQ (docs.opentyphoon.ai/en/faq): "Yes, we are collecting usage data from the Typhoon API. We use this data to improve the model and the API. We are committed to protecting your privacy and we will never share your data with third parties." and "SCB 10X claims no rights in Outputs you generate using Typhoon. You and your users are solely responsible for Outputs and their subsequent uses." Terms (opentyphoon.ai/tac): company may "use Output and/or Content to provide, maintain, develop, and improve our Services"; user gets a "limited, non-exclusive, non-transferable license to use the Services and the Output" and may "use, reproduce, modify, and distribute the Output"; prohibited to use the service "to train, fine tune, or otherwise improve any Artificial Intelligence Models or Datasets" or for "competitive benchmarking, data scraping, or model extraction". No zero-retention / opt-out option is documented. Since medical certificates contain personal health data (PDPA sensitive data), the project should obtain consent, avoid sending real patient documents in demos, or self-host the Apache-2.0 weights (scb10x/typhoon-ocr1.5-2b) if that is a concern. There is also a disclaimer that the model "may generate harmful or inappropriate responses" / hallucinate.
## recommendation
Use Typhoon as a two-call pipeline on the Express backend: (1) POST https://api.opentyphoon.ai/v1/chat/completions with model "typhoon-ocr", the exact v1.5 prompt from the typhoon-ocr package, and the photo as an image_url data URI (resize to ~1800 px longest side, JPEG, temperature 0.1, top_p 0.6, repetition_penalty 1.1, max_tokens 16384) — it returns Markdown (HTML tables), not JSON, and cannot be steered to custom fields or emit confidence; (2) feed that Markdown to "typhoon-v2.5-30b-a3b-instruct" (or v2.1-12b) with a strict prompt asking for a JSON object with {value, confidence} per field at temperature 0.1, then parse/validate server-side (response_format json_object/json_schema is undocumented on this API — do not rely on it; tool calling with a JSON-schema function is a documented alternative to force structure). It fits the $0 / no-card constraint (free key, no billing), Thai quality is the strongest documented among free options (self-reported BLEU 0.644 avg, 0.870 on Thai government forms, beating GPT-5 and Gemini 2.5 Pro), and the OCR limit of 20 req/min is enough for a class demo but not for concurrent users — add a queue/backoff on 429 in the API. Caveats: usage data is collected for model improvement (PDPA for medical data), the "research showcase" service has no SLA and the v1 endpoint was already retired once, Render free tier cold starts add latency on top of a slow 16k-token OCR call, and confidence scores will be LLM self-estimates, not calibrated probabilities — consider cross-checking with regex/date validation. Fallback: self-host scb10x/typhoon-ocr1.5-2b (Apache 2.0) with vLLM if the API limits or data policy become blockers.
## gaps
- Whether api.opentyphoon.ai accepts OpenAI response_format {type:'json_object'} or {type:'json_schema'} — not documented on any docs page and not testable without an API key; official 'Structured Output' example is prompt-only.
- Whether the OCR endpoint accepts a PDF data URI or a WebP/HEIC image directly — the official package always rasterises to JPEG/PNG client-side, so treat PDF/HEIC as unsupported on the wire.
- Exact max_tokens/context ceiling per model on the hosted API: API reference says 'max 8192 shared tokens' but the official OCR client sends max_tokens=16384 and the 30B card says 256K context vs 128K on the docs models page — conflicting.
- No explicit statement that a credit card is never required — only absence of any billing/pricing/card mention plus 'free to use'; 'Typhoon API Pro — Coming soon' suggests paid tiers may appear.
- No daily/monthly request or token quota published; only RPS/RPM. Unknown whether limits are per key or per account.
- No benchmark on medical certificates specifically; closest published category is Thai government forms (BLEU 0.870) and handwritten forms (BLEU 0.522). All numbers are SCB 10X self-reported (blog + arXiv 2601.14722).
- Data retention period and any opt-out for API inputs are not documented; FAQ only says usage data is collected to improve the model.
- Rate limit for typhoon-ocr-preview could not be confirmed as still live after the announced 31 Dec 2025 deprecation; it is absent from the current models and rate-limits pages.
- Could not fetch the GitHub repo source pages directly (404 via WebFetch); prompt/request details were taken from the published PyPI wheel typhoon-ocr 0.4.1 instead.

# gemini — Google Gemini API free tier for Thai/English medical-certificate extraction (image -> JSON with per-field confidence), as of 2026-09-03

- [confirmed] Google no longer publishes a per-model free-tier RPM/TPM/RPD table on the public rate-limits docs page; limits are shown only inside AI Studio (login required).
  - Fetched 2026-09-03. Page says rate limits 'depend on a variety of factors (such as your usage tier) and can be viewed in Google AI Studio' and links 'View your active rate limits in AI Studio' (https://aistudio.google.com/rate-limit). That URL 302-redirects to accounts.google.com login. The page defines the dimensions 'Requests per minute (RPM)', 'Tokens per minute (input) (TPM)', 'Requests per day (RPD)' and states 'Requests per day (RPD) quotas reset at midnight Pacific time.' Tier table: Free = 'Active project or free trial'; Tier 1 = 'Set up and link active billing account'; Tier 2 = paid $100 + 3 days; Tier 3 = paid $1,000 + 30 days. Only batch enqueued-token limits are tabulated (gemini-2.5-flash Tier1 3,000,000; gemini-2.5-flash-lite Tier1 10,000,000; gemini-3.8-flash Tier1 3,000,000; gemini-3.1-flash-lite Tier1 10,000,000).
  - https://ai.google.dev/gemini-api/docs/rate-limits
- [unverified] Third-party reporting of current free-tier numbers: gemini-2.5-flash = 10 RPM / 250,000 TPM / 250 RPD; gemini-2.5-flash-lite = 15 RPM / 250,000 TPM / 1,000 RPD (post-December-2025 reduction).
  - Secondary source dated 2026-01-27 ('current quotas as of January 2026'). Multiple other secondary pages repeat the same numbers. Another secondary source (aifreeapi, updated 2026-08-15) explicitly warns 'published limits do not guarantee actual capacity'. Not confirmable from a Google page today; verify in the AI Studio rate-limit dashboard for the actual project.
  - https://www.aifreeapi.com/en/posts/gemini-api-free-tier-rate-limits
- [unverified] Newer Flash-Lite models on the free tier: gemini-3.1-flash-lite and gemini-3.5-flash-lite (GA 2026-07-21) both list 'Free of charge' in the Free tier column; reported free limits 3.1-flash-lite 30 RPM / 1,500 RPD, 3.5-flash-lite 15 RPM / 1,500 RPD.
  - Confirmed from pricing page (fetched today): Gemini 3.5 Flash-Lite Free tier 'Free of charge', paid $0.30 in / $2.50 out per 1M; Gemini 3.1 Flash-Lite Free tier 'Free of charge', paid '$0.25 (text / image / video) $0.50 (audio)' in, '$1.50' out; Gemini 2.5 Flash-Lite paid '$0.10 (text / image / video) $0.30 (audio)' in, '$0.40' out. Changelog 2026-07-21: 'Gemini 3.5 Flash-Lite generally available (GA)'. Model page: gemini-3.5-flash-lite input 1,048,576 tokens, output 65,536, inputs 'Text, Image, Video, Audio, and PDF', structured outputs 'Supported'. The RPM/RPD figures for 3.x Flash-Lite come only from third-party pages (ayautomate.com 'last verified July 2026'; freellm.net) and are unverified. Note 2.5 Flash-Lite remains the cheapest paid model; 3.x Flash-Lite is newer but NOT cheaper on paid pricing.
  - https://ai.google.dev/gemini-api/docs/pricing
- [confirmed] The free tier does not require a credit card; a billing account is only needed to move to Tier 1 / paid.
  - Billing page (fetched today): 'New accounts begin on the Free Tier, which allows access to certain models in the Gemini API and AI Studio, up to the models' free tier rate limits.' and 'AI Studio usage remains free of charge unless users link a paid API key for access to paid features.' Upgrading 'means linking a billing account and prepaying to add a minimum of $10 (or equivalent in other currencies) of credits'. Rate-limits page: Free tier = 'Active project or free trial' vs Tier 1 = 'Set up and link active billing account'. Google does not literally write the words 'no credit card' on these pages; the absence of a billing requirement for the Free tier is what establishes it.
  - https://ai.google.dev/gemini-api/docs/billing
- [confirmed] Gemini API and Google AI Studio (including free tier) are available in Thailand.
  - 'The Gemini API and Google AI Studio are available in the following countries and territories' - list includes 'Thailand'. Pricing page: 'Google AI Studio usage is free of charge in all available regions.' Billing FAQ: 'Yes, we make the free tier and paid tier available in many regions.' The only region restriction in the Terms concerns EEA/Switzerland/UK end users ('You may use only Paid Services when making API Clients available to users in the European Economic Area, Switzerland, or the United Kingdom'), which does not apply to Thailand.
  - https://ai.google.dev/gemini-api/docs/available-regions
- [confirmed] Unpaid tier: prompts and responses ARE used to improve Google products and MAY be reviewed by humans; Google says not to submit sensitive/personal data. Paid tier: not used to improve products, processed under the Data Processing Addendum.
  - Terms (fetched today), Unpaid Services: 'When you use Unpaid Services, including, for example, Google AI Studio and the unpaid quota on Gemini API, Google uses the content you submit to the Services and any generated responses to provide, improve, and develop Google products and services' ... 'To help with quality and improve our products, human reviewers may read, annotate, and process your API input and output.' ... 'This includes disconnecting this data from your Google Account, API key, and Cloud project before reviewers see or annotate it. Do not submit sensitive, confidential, or personal information to the Unpaid Services.' Paid Services: 'Google doesn't use your prompts or responses to improve our products, and will process your prompts and responses in accordance with the Data Processing Addendum for Products Where Google is a Data Processor.' Also: 'Your access to Google AI Studio is a "Paid Service" even when it is offered free of charge, as long as the account you are using to access Google AI Studio has access to a Cloud Project with an associated and active Cloud Billing account'. Pricing page repeats 'Used to improve our products: Yes' (free) / 'No' (paid) for 2.5 Flash and 2.5 Flash-Lite. Age: 'You must be 18 years of age or older to use the APIs'.
  - https://ai.google.dev/gemini-api/terms
- [confirmed] @google/genai latest npm version is 2.21.0 (published 2026-09-02); requires Node.js 20+.
  - npm registry 'latest' dist-tag: version '2.21.0', publish timestamp 1788370102759 ms (= 2026-09-02 UTC). GitHub README: 'npm install @google/genai', 'Node.js version 20 or later'.
  - https://registry.npmjs.org/@google/genai/latest
- [confirmed] generateContent with config.responseMimeType='application/json' + config.responseJsonSchema is still fully supported and accepts standard JSON Schema including $defs/$ref; responseSchema (OpenAPI-subset) is the alternative and the two are mutually exclusive.
  - SDK type docs: responseMimeType - 'Supported mimetype: text/plain ... application/json: JSON response in the candidates.' responseJsonSchema - 'Optional. Output schema of the generated response. This is an alternative to response_schema that accepts JSON Schema. If set, response_schema must be omitted, but response_mime_type is required.' Supported JSON Schema properties listed: '$id, $defs, $ref, $anchor, type, format, title, description, enum, items, properties, additionalProperties, required, and propertyOrdering'. Note in docs: 'If response_schema doesn't process your schema correctly, try using response_json_schema instead.' Migration page: 'While generateContent remains fully supported, we recommend the Interactions API for all new development.' Interactions page: 'While it is now considered legacy, the original generateContent API remains fully supported.' Structured-output doc page now shows only the Interactions form: client.interactions.create({ model, input, response_format: { type: 'text', mime_type: 'application/json', schema } }) and read interaction.output_text; it states 'Gemini's structured output mode supports a subset of the JSON Schema specification' with types string, number, integer, boolean, object, array, null, supports anyOf and '$ref': '#' recursion, and warns 'Very large or deeply nested schemas may be rejected.'
  - https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html
- [confirmed] Per-field confidence is not a native API feature; it must be requested in the schema (e.g. each field as {value, confidence:number 0-1} with description text asking the model to rate legibility) and is a self-reported estimate.
  - Neither the structured-output doc nor the GenerateContentConfig docs expose logprobs/confidence per JSON field. Structured output only guarantees schema conformance. Practical pattern: nest each field as an object {value: string|null, confidence: number (minimum 0, maximum 1)} and instruct in the prompt that confidence reflects how clearly the text was readable; treat as heuristic, not calibrated probability. Numeric range keywords (minimum/maximum) are not in the list of supported JSON Schema keywords, so enforce range with 'description' and validate server-side (unverified whether minimum/maximum are silently ignored or rejected).
  - https://ai.google.dev/gemini-api/docs/structured-output
- [confirmed] Image token cost: 258 tokens if both dimensions <= 384 px; larger images are tiled into 768x768 tiles at 258 tokens each. Inline image data is capped by a 20 MB total request size; larger/reused files should go through the Files API.
  - Quotes: '258 tokens if both dimensions <= 384 pixels. Larger images are tiled into 768x768 pixel tiles, each costing 258 tokens.' 'Inline image data limits your total request size (text prompts, system instructions, and inline bytes) to 20MB.' Files API recommended 'For large files or to be able to use the same image file repeatedly.' Supported MIME types: PNG, JPEG, WEBP, HEIC, HEIF. Max 3,600 image files per request. Best practice: 'When using a single image with text, place the text prompt before the image in the input array.' Example: a 1536x2048 phone photo ~ 2x3 = 6 tiles ~ 1,548 tokens; a 4000x3000 photo ~ 6x4 = 24 tiles ~ 6,192 tokens - well within 250K TPM. Base64 inflates bytes by ~33%, so keep JPEGs under ~10-12 MB raw; resizing to ~1536 px long edge is advisable.
  - https://ai.google.dev/gemini-api/docs/image-understanding
- [confirmed] Thai OCR evidence: Gemini 2.5 Pro scores 0.897 full-page OCR / 0.777 overall on ThaiOCRBench (best of all evaluated models); Gemini 2.5 Flash scored BLEU 0.74 / ROUGE-L 0.87 / Levenshtein-distance 0.15 on Thai government forms in the Typhoon OCR paper. No published Thai benchmark for 2.5 Flash-Lite or 3.x Flash-Lite was found.
  - ThaiOCRBench (arXiv 2511.04479, 2,808 images, 13 tasks): Gemini 2.5 Pro full-page OCR 0.897, document parsing 0.587, key information extraction 0.658, handwritten 0.714, overall 0.777, 'ranking first in 11 out of 13 tasks'; abstract: 'proprietary models (e.g., Gemini 2.5 Pro) outperforming open-source counterparts', with weaknesses in 'fine-grained text recognition and handwritten content extraction'. Only 2.5 Pro was evaluated there. Typhoon OCR paper (arXiv 2601.14722, https://arxiv.org/html/2601.14722v1) Table 2 Thai document parsing, Gemini 2.5 Flash: financial reports BLEU 0.52 / ROUGE-L 0.70 / Lev 0.35; government forms BLEU 0.74 / ROUGE-L 0.87 / Lev 0.15; books BLEU 0.47 / ROUGE-L 0.59 / Lev 0.47; the paper states proprietary 'GPT and Gemini achieve competitive performance on some categories but are generally outperformed by Typhoon OCR on structured Thai document extraction tasks.' Government-form-like layouts (closest to a medical certificate) are Gemini Flash's strongest category. Flash-Lite Thai quality is unverified; expect it below Flash, especially on handwriting.
  - https://arxiv.org/html/2511.04479
- [confirmed] Gemini 2.5 Flash and 2.5 Flash-Lite are still listed as Stable with no announced shutdown date; only the 2.5-flash-lite preview was retired (Dec 2, 2025).
  - Models page lists gemini-2.5-flash and gemini-2.5-flash-lite as Stable. gemini-2.5-flash-lite page: input 1,048,576 tokens, output 65,536, inputs 'Text, image, video, audio, PDF', structured outputs supported, knowledge cutoff January 2025. Changelog 2025-11-04: shutdown of 'gemini-2.5-flash-lite-preview-06-17' on December 2nd. Changelog 2026-07-21 also notes 'The sampling parameters temperature, top_p and top_k are now deprecated' - do not set temperature in new code.
  - https://ai.google.dev/gemini-api/docs/models
- [confirmed] Paid pricing (for later reference): gemini-2.5-flash $0.30 in / $2.50 out per 1M tokens; gemini-2.5-flash-lite $0.10 in / $0.40 out; gemini-3.8-flash $0.75 in / $3.75 out through 2026-12-31 (then $1.50 / $7.50).
  - Fetched today. 2.5 Flash: input '$0.30 (text/image/video), $1.00 (audio)', output '$2.50'. 2.5 Flash-Lite: input '$0.10 (text / image / video) $0.30 (audio)', output '$0.40'. Free tier column for all of these: 'Free of charge', 'Used to improve our products: Yes'. Gemini 3.8 Flash is also 'Free of charge' on the free tier.
  - https://ai.google.dev/gemini-api/docs/pricing

## nodeSnippet
```
// npm install @google/genai@2.21.0   (Node 20+; set GEMINI_API_KEY from AI Studio, no card)
// Endpoint used by the SDK: POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent
import { GoogleGenAI, createPartFromBase64 } from "@google/genai";
import fs from "node:fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Per-field confidence is NOT native: model each field as {value, confidence}.
const responseJsonSchema = {
  type: "object",
  $defs: {
    field: {
      type: "object",
      properties: {
        value: { type: ["string", "null"], description: "Text exactly as printed (Thai or English); null if absent" },
        confidence: { type: "number", description: "Model's estimate 0.0-1.0 that `value` is read correctly; lower for smudged, handwritten or partially visible text" }
      },
      required: ["value", "confidence"]
    }
  },
  properties: {
    hospital_name: { $ref: "#/$defs/field" },
    patient_name:  { $ref: "#/$defs/field" },
    doctor_name:   { $ref: "#/$defs/field" },
    diagnosis:     { $ref: "#/$defs/field" },
    issue_date:    { $ref: "#/$defs/field", description: "ISO 8601 YYYY-MM-DD; convert Thai Buddhist year (BE) by subtracting 543" },
    rest_from:     { $ref: "#/$defs/field" },
    rest_to:       { $ref: "#/$defs/field" },
    certificate_language: { type: "string", enum: ["th", "en", "mixed"] }
  },
  required: ["hospital_name", "patient_name", "doctor_name", "diagnosis", "issue_date", "rest_from", "rest_to", "certificate_language"]
};

export async function extractMedicalCertificate(imagePath, mimeType = "image/jpeg") {
  const base64 = fs.readFileSync(imagePath, { encoding: "base64" }); // keep total request < 20 MB
  const res = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",              // or "gemini-2.5-flash" for better Thai accuracy
    contents: [{
      role: "user",
      parts: [
        { text: "Read this Thai/English medical certificate (ใบรับรองแพทย์) and fill every field. Do not guess: if a field is unreadable set value to null and confidence <= 0.2. Text prompt goes before the image." },
        createPartFromBase64(base64, mimeType)   // == { inlineData: { data: base64, mimeType } }
      ]
    }],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema,                          // standard JSON Schema; $defs/$ref supported. Do NOT also set responseSchema.
      thinkingConfig: { thinkingBudget: 0 }        // optional: faster/cheaper on 2.5 Flash/Flash-Lite
    }
  });
  return JSON.parse(res.text);
}

// Newer (recommended for new code, same key/quota) Interactions API form:
// const it = await ai.interactions.create({ model: "gemini-2.5-flash-lite",
//   input: [{ type: "text", text: PROMPT }, { type: "image", data: base64, mime_type: "image/jpeg" }],
//   response_format: { type: "text", mime_type: "application/json", schema: responseJsonSchema } });
// JSON.parse(it.output_text);
```
## freeTierLimits
Google no longer publishes per-model free-tier numbers on ai.google.dev (rate-limits page, fetched 2026-09-03, says limits 'can be viewed in Google AI Studio' at https://aistudio.google.com/rate-limit, which requires login). Free tier = 'Active project or free trial'; RPD resets at midnight Pacific. Widely reported but UNVERIFIED current values after the Dec 2025 cut: gemini-2.5-flash 10 RPM / 250,000 TPM / 250 RPD; gemini-2.5-flash-lite 15 RPM / 250,000 TPM / 1,000 RPD; gemini-3.1-flash-lite ~30 RPM / 1,500 RPD; gemini-3.5-flash-lite ~15 RPM / 1,500 RPD (third-party pages, Jan-Jul 2026). Pricing page confirms 2.5 Flash, 2.5 Flash-Lite, 3.1 Flash-Lite, 3.5 Flash-Lite and 3.8 Flash all show 'Free of charge' on the Free tier. Pro models are not on the free tier. No credit card / billing account is needed for the Free tier; Tier 1 requires linking a billing account and prepaying a minimum of $10. Available in Thailand (listed on the available-regions page).
## dataPolicy
Unpaid tier (free quota / AI Studio): Google 'uses the content you submit to the Services and any generated responses to provide, improve, and develop Google products and services'; 'human reviewers may read, annotate, and process your API input and output' (after disconnecting data from account/API key/project); and Google instructs: 'Do not submit sensitive, confidential, or personal information to the Unpaid Services.' Paid tier (any project with an active Cloud Billing account, even for calls that cost $0): 'Google doesn't use your prompts or responses to improve our products, and will process your prompts and responses in accordance with the Data Processing Addendum'. Users must be 18+. Implication for this project: real medical certificates contain health data and personal identifiers, so on the free tier use only synthetic/redacted/consented test documents, disclose this in the project write-up, and strip or blur ID numbers before upload where possible.
## recommendation
Use the Gemini API free tier from Google AI Studio (no card, available in Thailand) with @google/genai 2.21.0 on the Render Node/Express backend, calling ai.models.generateContent with responseMimeType 'application/json' + responseJsonSchema (JSON Schema with $defs/$ref works) and a schema where every field is {value, confidence}. Default model: gemini-2.5-flash-lite (highest reported free RPD ~1,000, cheapest if you ever pay: $0.10/$0.40 per 1M) with a fallback/quality toggle to gemini-2.5-flash (better Thai per Typhoon OCR data: ROUGE-L 0.87 on Thai government forms) - keep the model id in an env var so you can switch to gemini-3.5-flash-lite (also free-tier, GA July 2026) after checking its real limits in the AI Studio rate-limit dashboard. Downscale photos to ~1,500-2,000 px long edge before base64 (each 768x768 tile = 258 tokens; 20 MB inline cap), put the text prompt before the image, set thinkingBudget 0 for speed, and implement 429 backoff plus a per-day counter because RPD is small (250 for Flash). Because the free tier permits human review and product-improvement use and forbids sensitive/personal data, test only with synthetic or consented certificates and state this limitation in the report; per-field confidence is model self-reported, so validate critical fields (dates, BE->CE year conversion) in code.
## gaps
- Exact current free-tier RPM/TPM/RPD for gemini-2.5-flash, gemini-2.5-flash-lite and gemini-3.x flash-lite could not be confirmed from a Google page - the official table was removed from ai.google.dev and lives behind the AI Studio login (aistudio.google.com/rate-limit). Numbers given are from third-party pages dated Jan-Aug 2026.
- Whether Google literally states 'no credit card required' - inferred from Free tier = 'Active project or free trial' and 'AI Studio usage remains free of charge unless users link a paid API key'; no explicit 'credit card' wording found.
- No Thai-language OCR benchmark exists for gemini-2.5-flash-lite, gemini-3.1-flash-lite or gemini-3.5-flash-lite; only 2.5 Pro (ThaiOCRBench) and 2.5 Flash (Typhoon OCR paper) have published Thai numbers, and neither covers medical certificates specifically.
- Whether JSON Schema 'minimum'/'maximum' (for a 0-1 confidence range) are honored or rejected by responseJsonSchema - they are absent from the documented supported-keyword list; enforce via description + server-side validation.
- Structured-output docs now show only the Interactions API (client.interactions.create / response_format); generateContent + responseJsonSchema is documented only in the SDK type docs and stated to be 'legacy' but 'fully supported', with no sunset date announced.
- Whether a Thai-registered Google account can link billing later without a card (e.g., via prepaid credits) was not researched - the docs say Tier 1 needs a linked billing account and a $10 minimum prepayment.
