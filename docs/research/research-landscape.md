# MediFirstCard — Feature Landscape Research (emergency ID, records, telemedicine, Thailand context)

Date of research: 2026-09-03. Compiled from a prior agent's ~100 fetch/search transcript (digest) plus 12 fresh fetches and local extraction of 3 PDFs saved by the prior agent. Verification tags: **[FETCHED-TODAY]** = primary source fetched in this run; **[DIGEST]** = source fetched by the prior agent and visible in the digest; **[UNVERIFIED]** = not confirmed by a fetched source.

Project constraints that drive every judgement below: Android-first on Windows 10 (no Xcode), Expo/React Native, Node.js/Express + PostgreSQL (or Firestore), zero budget, 3 students, live demo 7 Oct 2026, repo+README 11 Oct 2026, rubric needs >=5 advanced features from >=3 of 5 categories with >=2 genuine integrations.

---

## 1. Platform baselines: what OS-native "Medical ID" already does

### 1.1 Apple Health Medical ID (iOS)
- Apple Support article 105072 (published 10 Mar 2026) names editable sections: **Medications, Allergies, Conditions, Emergency Contacts, Organ Donation status (US only)**; "Medical ID helps first responders access your critical medical information from the Lock screen, without needing your passcode." Toggles: **"Show When Locked"** (visible from Lock Screen) and **"Share During Emergency Call"** (auto-sends Medical ID to emergency services when calling/texting them; "Enhanced Emergency Data is not available in all countries or regions"). [DIGEST] https://support.apple.com/en-us/105072
- The fuller field set commonly documented (name, photo, date of birth, medical conditions, medical notes, allergies & reactions, medications, blood type, weight, height, primary language, organ donor, emergency contacts with relationship) could not be extracted from the iPhone User Guide page in either run (page returned only the TOC; guide is for iOS 26). [UNVERIFIED for the exhaustive list] https://support.apple.com/guide/iphone/set-up-and-view-your-medical-id-iph08022b192/ios
- Design takeaway: Apple's model = a fixed schema + per-user "show when locked" toggle; MediFirstCard's proposal contingency ("users choose which fields appear on the lock screen") is a superset of this and should be implemented as **per-field toggles**.

### 1.2 Android Personal Safety / Emergency information
- Google Android Help 9319337: medical information = "blood type, allergies, or medications"; emergency contacts chosen from existing contacts with "Emergency info access" -> "Show when locked". Lock-screen access path: "swipe up" -> tap **Emergency** -> **View emergency info**. Explicit warning: "Anyone who picks up your phone can find your lock screen message and emergency information even if your phone is locked." Emergency SOS = power button 5+ times; requires Android 12+; won't work in airplane mode or Battery Saver. [DIGEST] https://support.google.com/android/answer/9319337?hl=en
- Takeaway: Android already exposes a minimal emergency page behind the "Emergency" dialer button; MediFirstCard must justify itself with (a) richer Thai-language content (drug-allergy card semantics, chronic conditions, 1669 button), (b) a lock-screen **widget** that is visible with no taps, and (c) the records archive.

### 1.3 Android lock-screen widgets (the technical basis for the proposal's core feature)
- Android Developers Blog "Widgets on lock screen: FAQ" (6 Mar 2025): lock screen widgets arrive "in AOSP for tablets and mobile starting with the release after Android 16 (QPR1)", late Summer 2025; all existing app widgets are eligible; opt-out via `not_keyguard` in appwidget-provider XML placed in an `xml-36` resource folder; lock screen grid approx "4 cells wide by 3 cells tall"; widgets should support dynamic colour and resizing. [DIGEST] https://android-developers.googleblog.com/2025/03/widgets-on-lock-screen-faq.html
- Android Authority (4 Dec 2025): on Pixel phones with **Android 16 QPR2**, Settings -> Display & touch -> Lock screen -> toggle "Widgets on lock screen"; swipe left on the lock screen to reach the widgets page; "use any existing Android widgets on the lock screen"; widgets are viewable **without unlocking**; sizes standard/double/full-page. [FETCHED-TODAY] https://www.androidauthority.com/android-16-qpr2-lock-screen-widgets-pixel-phones-how-use-3621781/
- Samsung One UI 8: SamMobile (21 May 2025) confirms lock-screen widgets exist on Galaxy (up to four, larger in One UI 8) but does **not** confirm third-party widget support; pre-release reports (SammyFans 7 Mar 2025, SamMobile) said One UI 8 "could" support third-party lock-screen widgets. [FETCHED-TODAY: SamMobile] https://www.sammobile.com/news/samsung-one-ui-8-bigger-lock-screen-widgets/ ; [DIGEST] https://www.sammyfans.com/2025/03/07/samsungs-one-ui-8-android-16-to-support-third-party-lock-screen-widgets/
- The `android:widgetCategory="keyguard"` attribute has existed since Android 4.2 (AppWidgetProviderInfo.WIDGET_CATEGORY_KEYGUARD); AOSP 16 QPR2 reuses the widget framework, so a normal home-screen AppWidget is placeable on the lock screen. [DIGEST] https://learn.microsoft.com/en-us/dotnet/api/android.appwidget.appwidgetproviderinfo.widgetcategorykeyguard?view=net-android-35.0
- Library: **react-native-android-widget 0.22.1** (MIT; peerDeps expo >=54.0.0 optional, react *, react-native *; ships `app.plugin.ts` Expo config plugin; repo https://github.com/sAleksovski/react-native-android-widget). [DIGEST: npm registry] https://registry.npmjs.org/react-native-android-widget/latest ; docs https://saleksovski.github.io/react-native-android-widget/ . No GitHub issue about keyguard/lock-screen support was found in either run; the library renders standard AppWidgets, which Android 16 QPR2 places on the lock screen. [UNVERIFIED that the plugin exposes a `widgetCategory` option; if not, patch the generated `appwidget-provider` XML via a small custom config plugin.]
- Practical reality for the demo: only Pixel phones on Android 16 QPR2+ (and possibly One UI 8 Galaxy) show third-party widgets on the lock screen. **Fallback path required** (see feature F-05/F-06): a full-screen "Emergency Card" activity launched from a persistent (ongoing) notification that is visible on the lock screen, plus a QR code on the lock-screen wallpaper generated by the app. Android Studio emulator: create an AVD with a Pixel + Android 16 (API 36) QPR2 system image to demo the real lock-screen widget.

### 1.4 iOS lock-screen widgets (stretch)
- Expo blog (10 Dec 2025) "How to implement iOS widgets in Expo apps": uses `@bacons/apple-targets` (config plugin generating native Apple targets) + Swift WidgetKit code + App Groups (`ExtensionStorage`) for data sharing; covers lock-screen (accessory) widgets. [DIGEST] https://expo.dev/blog/how-to-implement-ios-widgets-in-expo-apps ; https://github.com/EvanBacon/expo-apple-targets
- Requires EAS Build cloud (no Mac needed for building) but a physical iPhone + Apple developer signing to install; treat as stretch. Accessory widget families (accessoryCircular/Rectangular/Inline) need iOS 16+. [UNVERIFIED: Apple doc fetch hit rate limit]

### 1.5 Third-party Medical ID apps (feature benchmark)
- **Medical ID (Lukas Kasprzak / medicalid.app)** free: lock-screen medical data (conditions, allergies, medications, blood type), ICE contacts from lock screen, one-tap SMS alert with GPS, live location sharing up to 24 h, address/GPS display, compass, BMI, single profile. Premium: unlimited family profiles, customisable lock-screen widgets, custom alert messages, backup. Google Play ids `app.medicalid.free` / `app.medicalid`. [DIGEST] https://medicalid.app/ ; https://play.google.com/store/apps/details?id=app.medicalid.free&hl=en
- **ICE Medical ID: Emergency Card** (tech.chitwansoft.emergencyinformation) exists as a competitor. [DIGEST] https://play.google.com/store/apps/details?id=tech.chitwansoft.emergencyinformation&hl=en_IN
- Takeaway: the "lock-screen medical card + ICE contacts + SOS SMS with location" bundle is the established baseline; a multi-profile (family/elder caregiver) mode is the paid differentiator.

### 1.6 Physical medical ID engraving guidance (defines the 60-second field list)
- Industry guidance (ROAD iD, Lauren's Hope, American Medical ID, citing ACEP): engrave **allergies only if likely to cause anaphylaxis/severe reaction**; chronic conditions that change emergency treatment (insulin-dependent diabetes, epilepsy, Alzheimer's/dementia, heart conditions, bleeding disorders); medications that change treatment (blood thinners, corticosteroids, immunosuppressants); implants (pacemaker); "ICE" + phone for emergency contact; name on the back; everything else in a profile. [FETCHED-TODAY: search summary] https://www.roadid.com/blogs/fuel-your-adventure/what-to-engrave-on-your-medical-id-bracelet ; https://www.laurenshope.com/customer-resources/what-to-engrave ; https://www.medicalert.org/medical-conditions/abbreviations/
- EMS **SAMPLE** history mnemonic: Signs/Symptoms, **Allergies, Medications, Past medical history**, Last oral intake, Events. The A-M-P triad is exactly what a phone card can pre-answer for an unconscious patient. [DIGEST] https://en.wikipedia.org/wiki/SAMPLE_history ; https://www.ems1.com/ems-products/epcr-electronic-patient-care-reporting/articles/how-to-use-sample-history-as-an-effective-patient-assessment-tool-J6zeq7gHyFpijIat/

---

## 2. Patient portals and records archives (feature benchmark)
- **MyChart (Epic)** core features across health systems: test results, secure messaging with care team, appointment scheduling, prescription refills, billing, **proxy access** (manage family members), visit summaries, telehealth video visits. [DIGEST] https://www.ucsfhealth.org/mychart ; https://www.uwmedicine.org/mychart
- Takeaway for a 5-week prototype: the archive should implement document capture + categorisation + timeline + search + share, not messaging/refills.

---

## 3. Standards: HL7 FHIR R4, IPS, SMART Health Cards/Links

All FHIR facts below from hl7.org/fhir/R4 pages fetched by the prior agent [DIGEST].

| Resource | Use in MediFirstCard | Key elements & value sets (R4) |
|---|---|---|
| Patient | profile | identifier (Thai 13-digit CID as `identifier.system` = e.g. `https://terms.moph.go.th/id/cid` — system URI is a project convention, not an official URI [UNVERIFIED]), name, telecom, gender, birthDate, contact, communication (language) — https://hl7.org/fhir/R4/patient.html |
| AllergyIntolerance | drug/food allergies | clinicalStatus: active/inactive/resolved; verificationStatus: unconfirmed/confirmed/refuted/entered-in-error; type: allergy/intolerance; category: food/medication/environment/biologic; **criticality: low/high/unable-to-assess**; code; patient 1..1; recordedDate; reaction.substance; reaction.manifestation 1..*; **reaction.severity: mild/moderate/severe**; note — https://hl7.org/fhir/R4/allergyintolerance.html |
| Condition | chronic diseases | clinicalStatus: active/recurrence/relapse/inactive/remission/resolved; verificationStatus: unconfirmed/provisional/differential/confirmed/refuted/entered-in-error; category: problem-list-item/encounter-diagnosis; severity; code; subject 1..1; onset[x]; recordedDate; note — https://hl7.org/fhir/R4/condition.html |
| MedicationStatement | current medicines | status 1..1: active/completed/entered-in-error/intended/stopped/on-hold/unknown/not-taken; medication[x] 1..1; subject 1..1; effective[x]; dateAsserted; dosage 0..*; reasonCode; note — https://hl7.org/fhir/R4/medicationstatement.html |
| Immunization | vaccine records | status 1..1: completed/entered-in-error/not-done; vaccineCode 1..1; patient 1..1; occurrence[x] 1..1; lotNumber; manufacturer; site; route; doseQuantity; performer; protocolApplied.doseNumber[x] — https://hl7.org/fhir/R4/immunization.html |
| DocumentReference | scanned certificates/records | status 1..1: current/superseded/entered-in-error; docStatus: preliminary/final/amended/entered-in-error; type; category; subject; date; author; description; content 1..* with attachment (contentType, url, data, title, creation); context — https://hl7.org/fhir/R4/documentreference.html |
| RelatedPerson | emergency contacts | patient 1..1; relationship (PatientRelationshipType); name; telecom; gender; birthDate; period; active — https://hl7.org/fhir/R4/relatedperson.html |
| Consent | PDPA consent record | status 1..1: draft/proposed/active/rejected/inactive/entered-in-error; scope 1..1 (ADR/Privacy/Treatment/Research); category 1..*; patient; dateTime; performer; organization; source[x]; policy/policyRule (one required); provision.type permit/deny; provision.period; provision.actor; provision.purpose — https://hl7.org/fhir/R4/consent.html |

- **International Patient Summary IG v2.0.0 (STU2, generated 2025-10-03)**: required sections = Problem List (Condition), Allergies and Intolerances (AllergyIntolerance), Medication Summary (MedicationStatement/MedicationRequest/Medication); recommended = Immunizations, Diagnostic Results, History of Procedures, Medical Devices; optional = Advance Directives (Consent), Alerts (Flag), Functional Status, Past Problems, Pregnancy, Patient Story, Plan of Care, Social History, Vital Signs. [DIGEST] https://hl7.org/fhir/uv/ips/STU2/Structure-of-the-International-Patient-Summary.html
  - Recommendation: name the emergency card's three panels exactly after the IPS required sections; export an "IPS-lite" FHIR Bundle JSON (Patient + AllergyIntolerance + Condition + MedicationStatement + RelatedPerson) as the JSON export feature.
- **SMART Health Cards Framework v1.4.0**: JWS compact serialisation, header `alg: ES256`, `zip: DEF`, `kid` = JWK thumbprint; payload `iss`, `nbf`, `vc.type`, `vc.credentialSubject.fhirVersion` + `fhirBundle`; QR = `shc:/` prefix + numeric-mode digits (`Ord(c)-45`), chunking deprecated; issuer keys at `/.well-known/jwks.json` (EC P-256). [DIGEST] https://spec.smarthealth.cards/
- **SMART Health Links (HL7 IG v1.0.0 STU1, 22 Jul 2025)**: `shlink:/` + base64url JSON {url (manifest, >=256-bit entropy), key (43-char base64url 32-byte), exp, flag (L long-term, P passcode, U direct file), label <=80 chars, v}; client POSTs `{recipient, passcode?}` to manifest URL; files are JWE `alg: dir`, `enc: A256GCM`; QR at EC level M. [DIGEST] https://hl7.org/fhir/uv/smart-health-cards-and-links/STU1/links-specification.html
  - Recommendation: implement a **simplified SHL-style share link** (server-side random token + AES-256-GCM encrypted FHIR bundle + optional passcode + expiry) rather than a signed SHC (no issuer keys/trust framework needed for a prototype). This is a "genuine system integration" (Category 2) and demonstrates encryption in transit and at rest.

---

## 4. Thailand context

### 4.1 National apps and platforms
- **หมอพร้อม / Mor Prom Super App** (Pattaya Mail, 22 Feb 2026, Chonburi launch): >30 million users of original app; 12 core functions incl. online appointment booking, telemedicine, **digital medical certificates**, online payments, coverage verification, insurance claims, appointment reminders, real-time queue tracking, **treatment history**, electronic referral documents, **drug allergy information**; connects public hospitals, clinics, pharmacies. [DIGEST] https://www.pattayamail.com/thailandnews/thailand-launches-mor-prom-super-app-in-chonburi-pushing-healthcare-fully-into-the-digital-age-536680
- **Mor Prom+ plan** (The Nation, 9 Oct 2025): consolidates 50+ government health apps; rights verification, appointments, medical history, medication receipt, telemedicine, health-promotion info; first phase "by the end of 2025". [FETCHED-TODAY] https://www.nationthailand.com/health-wellness/40056535
- **Health Link (HIE)** operated by Big Data Institute (BDI): citizens enrol via เป๋าตัง (Paotang) app, ThaID, or at hospitals; portals HosRegister/HIE; no public developer API documented. [DIGEST] https://healthlink.go.th/ . Thairath (27 Apr 2026): ~20,000 data points (10,000+ NHSO units + ~8,500 clinics/pharmacies), ">12 essential health data types", citizen access via **Thang Rath (ทางรัฐ)** super app (46 M downloads); 30,129 users viewed history via Thang Rath. [DIGEST] https://en.thairath.co.th/news/governmentpolicy/2929196
  - Implication: **no public API for Mor Prom or Health Link** exists for students; the app must position itself as a *patient-held* complement (import by scan/photo, export by QR/PDF), explicitly stating "does not connect to Mor Prom/Health Link".
- **ThaID** (DOPA digital ID, Play id `th.go.dopa.bora.dims.ddopa`) — government identity verification; third-party integration requires agency onboarding; out of scope. [DIGEST] https://play.google.com/store/apps/details?id=th.go.dopa.bora.dims.ddopa&hl=en
- **Telemedicine apps**: MorDee (True Digital, Play id `com.truedigital.vhealth`; NHSO partnership for UCS "gold card" telemedicine + medicine delivery; insurer partnerships MSIG, Tokio Marine) [DIGEST] https://www.true.th/blog/en/telemedicine_mordee-2/ ; Doctor Anywhere Thailand (video consult, medication delivery, insurer AXA; acquired Doctor Raksa) [DIGEST] https://www.mobihealthnews.com/news/asia/doctor-anywhere-buys-thailands-biggest-telemedicine-platform ; https://www.doctoranywhere.co.th/ ; Samitivej Virtual Hospital (multi-service virtual hospital app) [DIGEST] https://www.healthcareitnews.com/news/asia/samitivej-launches-multi-service-virtual-hospital-app-thailand ; Ooca (tele-mental-health video counselling with psychologists/psychiatrists, Play id `co.ooca.user`) [DIGEST] https://play.google.com/store/apps/details?id=co.ooca.user&hl=en_US
- **Medical Council notice 54/2563 (9 Jul 2020)** on telemedicine: telemedicine must be provided by licensed practitioners, **only through licensed medical facilities (Art. 8)**, with identity verification, security to international standards, compliance with e-transaction and PDPA law (Art. 7), mutual understanding of limitations and right to refuse (Art. 6). [DIGEST] https://tmc.or.th/index.php/News/News-and-Activities/Telemedicine ; Royal Gazette PDF https://www.ratchakitcha.soc.go.th/DATA/PDF/2563/E/166/T_0052.PDF
  - Implication: a student app **cannot legally host consultations**; "telemedicine bridge" = preparing/sharing the patient summary for a consult and deep-linking to licensed services.

### 4.2 EMS 1669 (NIEMS) — what a caller must give
- NIEMS standard 9 steps (readyplan.net, updated Jul 2026): stay calm & call 1669; report emergency type; give **location** (landmarks/GPS/app location); **number of patients**; **symptoms** (consciousness, breathing); **hazards**; **caller name & callback number**; follow dispatcher first-aid instructions; stay on the line. 1669 is free, 24 h. [DIGEST] https://www.readyplan.net/knowledge/emergency-call-1669
- Bangkok Hospital Hua Hin "9 things before calling 1669" corroborates: situation, location, gender/age/symptoms/number of patients, consciousness level, risks, informer name + phone. [DIGEST] https://www.bangkokhospital.com/en/huahin/content/calling-1669-bhn
- NIEMS app **ThaiEMS1669** (App Store id 956032530, last updated v3.0.4 Feb 2019): first-aid guides, direct 1669 call, hospital & AED locator, incident reporting. [DIGEST] https://apps.apple.com/gb/app/thaiems1669/id956032530 ; NIEMS EMS 1669 app news https://www.niems.go.th/1/News/Detail/4832?group=3
- Other numbers: 191 police, 1646 Bangkok Erawan EMS, 1554 Vachira (from expat guides) [DIGEST] https://www.verso.ac.th/news/essential-emergency-contacts-for-expats-in-thailand/
- Product implication: the emergency card should have a **"โทร 1669" button** and a **"read-aloud script" panel** that shows the caller's GPS coordinates, the patient's age/sex, conscious/breathing checkboxes, and the callback number — i.e. it turns the 9-step checklist into a screen.

### 4.3 Thai PDPA (พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562) — rules for health data
- Fully effective 1 Jun 2022. Sensitive data = race, ethnicity, political opinion, cult/religious/philosophical beliefs, sexual behaviour, criminal records, **health**, disability, labour union, genetics, biometrics. Sensitive data needs **explicit consent** (s.26) unless an exception applies (vital interest where subject cannot consent, public health, preventive/occupational medicine, legal claims). Consent (s.19) must be explicit in writing/electronic, **clearly separated from other text**, in easily accessible/understandable language; withdrawable any time as easily as given. Security measures (s.37); breach notification to PDPC within **72 h**; administrative fines up to THB 5,000,000; criminal penalties for sensitive-data violations. [DIGEST] https://www.dlapiperdataprotection.com/index.html?t=law&c=TH
- Consent wording guidance (pdpa.pro): separate consent form, plain language, state purposes, easy withdrawal, explicit consent for health data. [DIGEST] https://pdpa.pro/blogs/pdpa-consent
- **Section 20 (minors)**: under 10 -> consent from holder of parental responsibility; 10-20 not sui juris -> minor's consent plus parent's unless the act is one a minor may do alone under CCC ss.22-24; incompetent -> custodian; quasi-incompetent -> curator; applies mutatis mutandis to withdrawal. [FETCHED-TODAY] https://dpoworks.com/privacy-database/pdpa-section-20
- **Medical certificates & PDPA** (The Legal Co., 31 Mar 2025): PDPC sub-committee opinion — hospitals may collect Part 1/Part 2 certificate data under s.26(5)(a) (medical exemption) and s.24(3); collection must be purpose-specific (s.22); s.27 restrictions bind controllers, **patients may freely disclose their own certificates to third parties**. [DIGEST] https://thelegal.co.th/2025/03/31/pdpa-personal-data-in-medical-certificates-defined-by-the-medical-council/
- Retention: PDPA requires retention only as long as necessary for the stated purpose and deletion/anonymisation afterwards (s.37(3)); state a concrete rule in the privacy notice (e.g. "retained until account deletion; deleted within 30 days"). [UNVERIFIED exact section wording; principle stated in DLA Piper summary]
- Google Play **Health Content and Services** policy: privacy policy link in Play Console and in-app; complete the **Health apps declaration**; if not a regulated device include the disclaimer that the app "is not a medical device and does not diagnose, treat, cure, or prevent any medical condition" and tell users to consult a professional; request only essential permissions. [DIGEST] https://support.google.com/googleplay/android-developer/answer/16679511?hl=en
- Thai FDA SaMD guidance (Jun 2024, revised Oct 2024): software used **solely for data storage or display (HIS/EHR), calculators like BMI, calendars** are NOT medical devices; SaMD = software intended for detection/diagnosis/monitoring. [DIGEST] https://www.qualtechs.com/en-gb/article/thai-fda-samd-ai-guidance-2024 — keep MediFirstCard strictly storage/display + OCR text extraction; do not add symptom checkers or diagnostic AI.

### 4.4 Thai drug-allergy card (บัตรแพ้ยา)
- Rama Pharmacy (Mahidol): patients with drug allergy must "carry a drug allergy card and present it" or tell doctors/pharmacists each visit; card documents **drug name and symptoms**; severe reactions SJS/TEN; high-risk drugs in Thailand: allopurinol, carbamazepine/phenytoin/lamotrigine, NSAIDs (ibuprofen, meloxicam), nevirapine/abacavir, sulfonamides, penicillins, rifampicin/isoniazid; pharmacogenetic screening (HLA-B*15:02 carbamazepine, HLA-B*58:01 allopurinol) exists. [DIGEST] https://www.rama.mahidol.ac.th/ramapharmacy/th/drug%20allergy ; https://pubmed.ncbi.nlm.nih.gov/20345939/ ; https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3986079/
- Thai Journal of Pharmacy Practice paper on hospital drug-allergy database (data 2559-2560): a complete record = **ชื่อยาที่แพ้ (drug name), อาการไม่พึงประสงค์ (manifestation), ประเภท (แพ้ยา / อาการข้างเคียง / ข้อควรระวัง = allergy / side effect / caution), ผลการประเมิน (Naranjo: certain / probable / possible / unable to assess), แหล่งที่มาของข้อมูล (source: patient-reported vs. observed)**; most common: skin manifestations (50.75%), antibiotics (41.73%); 42.81% of records were patient-reported and un-assessable. [FETCHED-TODAY: local pdftotext of the saved PDF] https://he01.tci-thaijo.org/index.php/TJPP/article/download/171581/123237/
- Card-format lists from community sources add: patient name, HN, hospital, date, severity (mild/moderate/severe), assessing pharmacist. [DIGEST search snippets] https://www.safeandsavepharmacy.com/articles/บัตรแพ้ยานั้นสำคัญไฉน/
- Schema recommendation (maps to FHIR AllergyIntolerance): drugName (generic, EN+TH), drugGroup, manifestation (chips: rash/urticaria, angioedema, anaphylaxis, SJS/TEN, GI, other), severity (mild/moderate/severe), reactionType (allergy/side-effect/caution), assessment (certain/probable/possible/unassessed), source (patient/hospital card), hospital, date, cardPhoto (DocumentReference).

### 4.5 Common Thai chronic diseases (for pick-lists)
- UNDP/WHO "Case for Investment" (23 Nov 2021): the four main NCDs — **cancer, cardiovascular disease, diabetes, COPD** — cause ~400,000 deaths/yr, 74% of all deaths. [FETCHED-TODAY] https://thailand.un.org/en/159788-prevention-and-control-noncommunicable-diseases-thailand-%E2%80%93-case-investment
- 2021 Health Behaviour survey (PMC 2025) covers hypertension, diabetes, dyslipidaemia risk factors. [DIGEST] https://pmc.ncbi.nlm.nih.gov/articles/PMC12100955/
- Pick-list (TH/EN): เบาหวาน Diabetes (type 1/2, insulin-dependent flag), ความดันโลหิตสูง Hypertension, ไขมันในเลือดสูง Dyslipidaemia, โรคหัวใจ/หลอดเลือดหัวใจ Heart disease (+ pacemaker/stent flag), หลอดเลือดสมอง Stroke history, ไตวายเรื้อรัง CKD (+ dialysis flag), หอบหืด Asthma, ถุงลมโป่งพอง COPD, ลมชัก Epilepsy, มะเร็ง Cancer, ไทรอยด์ Thyroid, ธาลัสซีเมีย Thalassaemia (high prevalence in Thailand [UNVERIFIED]), G6PD deficiency [UNVERIFIED prevalence], HIV (sensitive — user-controlled), จิตเวช psychiatric (user-controlled), สมองเสื่อม Dementia, ตับอักเสบ B/C, ภูมิแพ้ Allergic disease, ตั้งครรภ์ Pregnancy.

### 4.6 Medical certificate standard fields (Medical Council of Thailand forms) — extracted verbatim from the official PDFs
- **General health certificate (ใบรับรองแพทย์), approved TMC meeting 4/2561, 19 Apr 2018** — https://tmc.or.th/pdf/MedCertificate/Medical_Certificate_TH.pdf [FETCHED-TODAY via local pdftotext]
  - Header: เล่มที่ (book no.), เลขที่ (no.)
  - ส่วนที่ 1 ของผู้ขอรับใบรับรองสุขภาพ (applicant): ชื่อ นาย/นาง/นางสาว; สถานที่อยู่ที่ติดต่อได้; หมายเลขบัตรประจำตัวประชาชน (13 boxes); ประวัติสุขภาพ: 1. โรคประจำตัว ไม่มี/มี(ระบุ); 2. อุบัติเหตุ และ ผ่าตัด; 3. เคยเข้ารับการรักษาในโรงพยาบาล; 4. ประวัติอื่นที่สำคัญ; ลงชื่อ, วันที่ เดือน พ.ศ.; note: child may have guardian sign.
  - ส่วนที่ 2 ของแพทย์: สถานที่ตรวจ, วันที่ เดือน พ.ศ.; ชื่อแพทย์; ใบอนุญาตประกอบวิชาชีพเวชกรรมเลขที่; สถานพยาบาลชื่อ/ที่อยู่; ได้ตรวจร่างกาย (name) เมื่อวันที่; น้ำหนักตัว กก., ความสูง ซม., ความดันโลหิต มม.ปรอท, ชีพจร ครั้ง/นาที; สภาพร่างกายทั่วไป ปกติ/ผิดปกติ(ระบุ); certification of absence of: ทุพพลภาพ, โรคจิต/จิตฟั่นเฟือน/ปัญญาอ่อน, ติดยาเสพติดให้โทษ, พิษสุราเรื้อรัง, (1) โรคเรื้อนระยะติดต่อ (2) วัณโรคระยะอันตราย (3) โรคเท้าช้างระยะปรากฏอาการ (4) อื่น ๆ; (2) สรุปความเห็นและข้อแนะนำของแพทย์; ลงชื่อแพทย์ผู้ตรวจ; หมายเหตุ: valid **1 month from examination date**; preliminary diagnosis only.
- **Driving-licence certificate (Medical Certificate (Driving license)), approved TMC meeting 6/2021, 13 May 2021 (Thai version approved 2/2564, 4 Feb 2021)** — https://w2.med.cmu.ac.th/hss/files/2022/04/Medical_Certificate_EN-13-5-64.pdf [FETCHED-TODAY via local pdftotext]; Thai original https://www.tmc.or.th/Media/media-20210215143722.pdf
  - Part 1 applicant: Name; Residential address with postal code; Identification number (13 digits); health history: 1. personal specific disease, 2. accident or surgery, 3. hospital admission, **4. seizure** (must attach treating doctor's statement of no attack within 1 year), 5. other relevant; signature; date (D/M/Y).
  - Part 2 doctor: place of examination with postal code; doctor name; medical practice license No.; address; examined (name) on date; bodyweight kg, height cm, blood pressure mmHg, pulse /min; general physical condition normal/abnormal; certifies capable to work, no mental disability, no drug addiction/chronic alcoholism, no (1) contagious leprosy (2) contagious TB (3) symptomatic elephantiasis (4) others; physician conclusion/advice; signature M.D.; date. N.B.: licensed practitioner only; **valid 1 month**; provisional diagnosis; only for driving licence.
- "ใบรับรองแพทย์ 5 โรค" (employment) = certifies absence of โรคเท้าช้าง, โรคเรื้อน, พิษสุราเรื้อรัง, วัณโรค, ยาเสพติดให้โทษ. [DIGEST] https://www.paolohospital.com/th-TH/rangsit/Article/Details/ใบรับรองแพทย์-5-โรค-คืออะไร--
- Metadata schema for the archive: certType (general/driving/5-disease/sick-leave/fit-to-work/other), issuingFacility, physicianName, licenseNo, examDate (BE+CE), validUntil (examDate + 1 month default), bookNo/certNo, purpose, file(s).

### 4.7 Vaccination records
- MOPH EPI 2568 (2025) standards document exists (DDC "มาตรฐานการดำเนินงานสร้างเสริมภูมิคุ้มกันโรค ปี 2568") and PIDST 2568 schedule exists but neither PDF/image could be text-extracted (403 / images). [DIGEST] https://ddc.moph.go.th/dcd/journal_detail.php?publish=16602 ; [FETCHED-TODAY: page confirms PIDST source only] https://cimjournal.com/idv-article/vaccine68/ ; PIDST https://www.pidst.net/A1517.html
- Practical pick-list (well-established Thai EPI antigens; specific ages [UNVERIFIED]): BCG, HB, DTP-HB-Hib, OPV/IPV, Rota, MMR, JE (live), HPV, dT booster, seasonal influenza (risk groups/elderly), COVID-19; adult/elderly: influenza yearly, pneumococcal, Td every 10 years. Store per FHIR Immunization (vaccineCode free text + optional lot, site, facility, dose number).
- Mor Prom holds the official COVID/vaccine certificates; MediFirstCard stores a **photo of the vaccine book/certificate** plus structured entries.

### 4.8 Identifiers, dates, fonts, geography
- Thai national ID: 13 digits with mod-11 checksum; npm **thai-id-validator 1.1.7** (MIT, zero deps, repo jukbot/thai-citizen-id-validator). [DIGEST] https://registry.npmjs.org/thai-id-validator/latest . Hospital number (HN) is per-hospital; CID links records nationally.
- Buddhist Era: BE = CE + 543. **dayjs `buddhistEra` plugin**: `dayjs.extend(require('dayjs/plugin/buddhistEra'))`, tokens `BBBB` (2561) / `BB` (61). [DIGEST] https://day.js.org/docs/en/plugin/buddhist-era . `Intl.DateTimeFormat('th-TH-u-ca-buddhist')` is the standard JS way, but Hermes docs list DateTimeFormat as implemented on Android/iOS without documenting the `calendar` option and note calendar issues below API 24 — **use dayjs, not Intl, for BE**. [FETCHED-TODAY] https://raw.githubusercontent.com/facebook/hermes/main/doc/IntlAPIs.md
- Thai fonts via Expo: `@expo-google-fonts/noto-sans-thai`, `@expo-google-fonts/sarabun`, `@expo-google-fonts/prompt` (Google Fonts, OFL). [DIGEST] https://www.npmjs.com/package/@expo-google-fonts/noto-sans-thai ; https://www.npmjs.com/package/@expo-google-fonts/sarabun
- Provinces/districts/subdistricts/postcodes: npm **thai-data 3.0.2** (ISC, 77 provinces, TypeScript types). [DIGEST] https://registry.npmjs.org/thai-data/latest
- Hospital master list: MOPH health facility code (รหัสหน่วยงานบริการสุขภาพ 5-digit; 9-digit format announced) at https://hcode.moph.go.th/ (403 to fetch) and PHDB downloads https://phdb.moph.go.th/main/index/downloadlist/57/0 ; DGA/CITIZENinfo hospital coordinates https://www.dga.or.th/document-sharing/infographic/49390/ [DIGEST]. Use free-text hospital name + optional code; do not block on the list.
- Blood group: Rh-negative is rare in Thais (~0.3%, Thai Red Cross National Blood Centre) [DIGEST search snippet; exact figure UNVERIFIED] https://thaibloodcentre.redcross.or.th/en/rh-negative-blood-significance/ — store ABO + Rh; show "Rh−" prominently when negative.
- QR: **react-native-qrcode-svg 6.3.22** (MIT; peer react-native >=0.63.4, react-native-svg >=14). [DIGEST] https://registry.npmjs.org/react-native-qrcode-svg/latest
- Health-insurance scheme (สิทธิการรักษา): UCS/บัตรทอง (NHSO), SSS/ประกันสังคม, CSMBS/ข้าราชการ, private — a standard field on Thai hospital registration and useful to ER admissions. [DIGEST search] https://www.hitap.net/wp-content/uploads/2025/11/01-UCS-OVERVIEW-of-UHC-and-UCS.pdf
- Living will (หนังสือแสดงเจตนา, National Health Act B.E. 2550 s.12): right to refuse life-prolonging treatment at terminal stage; personnel complying are not liable; <1% have signed; accessibility in emergencies is a known problem. [FETCHED-TODAY: search] https://so06.tci-thaijo.org/index.php/vrurdihsjournal/article/view/292093 ; https://www.thailawonline.com/living-will-in-thailand/
- Organ donation: Thai Red Cross Organ Donation Centre, online registration + e-card via "บริจาคอวัยวะ" app (Play id `th.in.organdonate`), hotline 1666. [FETCHED-TODAY: search] https://play.google.com/store/apps/details?id=th.in.organdonate&hl=en&gl=US ; http://en.organdonate.in.th/
- OCR for Thai: Google ML Kit Text Recognition v2 supports Latin/Chinese/Devanagari/Japanese/Korean scripts only — **Thai is not supported on-device**; Thai OCR needs a cloud model such as **Typhoon OCR** (SCB 10X, open weights; hosted API) or Google Cloud Vision (free tier 1,000 units/month). [DIGEST] https://developers.google.com/ml-kit/vision/text-recognition/v2/languages ; https://opentyphoon.ai/model/typhoon-ocr
- Elderly UX: JMIR 2023 systematic review guidelines for older-adult apps (large fonts, high contrast, low cognitive load, few steps); Thai mHealth adoption study 2025. [DIGEST] https://mhealth.jmir.org/2023/1/e43186 ; https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11908770/

---

## 5. (a) Exhaustive candidate feature list (74 items)

Tags: **CORE** = core-from-proposal; **HVA** = high-value-add; **TMB** = telemedicine-bridge; **NTH** = nice-to-have; **OOS** = out-of-scope. Rubric categories: C1 Data & Storage, C2 API/Backend/Automation, C3 Sensor/IoT, C4 AI/ML, C5 Medical UI/UX. "INT" = counts as genuine system integration.

### A. Emergency card & lock screen
| # | Feature | Tag | Rubric | Rationale / evidence |
|---|---|---|---|---|
| F-01 | Emergency card data model: blood group ABO+Rh, chronic conditions, drug allergies w/ severity, current critical meds, emergency contacts, name/age/sex, photo, language | CORE | C1, C5 | Mirrors Apple/Android Medical ID fields + IPS required sections (hl7.org IPS STU2) |
| F-02 | Android home-screen AppWidget rendering the card (react-native-android-widget 0.22.1, Expo plugin) | CORE | C5 (+C2 via data sync) | Proposal names Android App Widget API |
| F-03 | Same widget placed on **lock screen** on Android 16 QPR2+ (Pixel) — widget visible by swiping left without unlocking | CORE | C5 | androidauthority.com 4 Dec 2025 confirms any app widget works |
| F-04 | Per-field "show on lock screen" toggles (privacy contingency) | CORE | C5 | Proposal §8; PDPA data minimisation |
| F-05 | Fallback: persistent (ongoing) notification "Emergency card" -> full-screen card activity shown over lock screen (`showWhenLocked`) for devices without lock-screen widgets | HVA | C5 | Needed because Samsung/other OEM third-party lock-screen widget support unconfirmed |
| F-06 | Fallback 2: generate a lock-screen wallpaper image with card summary + QR (user sets manually) | NTH | C5 | Medical ID apps (Medical ID premium "customizable lock screen widgets") |
| F-07 | Emergency QR code (react-native-qrcode-svg) encoding a short share URL to the public card | HVA | C2, INT | SHL-style link |
| F-08 | "Call 1669" one-tap button + 191/1646 secondary | CORE | C5 | NIEMS 9-step; readyplan.net |
| F-09 | 1669 call script screen: patient age/sex, conscious/breathing toggles, GPS coordinates + address, callback number (TH/EN read-aloud text) | HVA | C5, C3 (GPS) | Turns NIEMS 9-step checklist into UI |
| F-10 | One-tap SOS SMS to emergency contacts with GPS link (expo-sms / Linking sms:) | HVA | C2 | Medical ID app baseline feature |
| F-11 | Rescuer view: large-font, high-contrast, red-flag ordering (allergies -> conditions -> meds -> contacts) | CORE | C5 | Engraving guidance: anaphylaxis allergies first |
| F-12 | "No known drug allergies" explicit state (distinct from empty) | HVA | C5 | Harm-avoidance: empty ≠ none |
| F-13 | Last-updated timestamp + "self-reported, unverified" badge on the card | HVA | C1, C5 | Responsible use; Naranjo "unassessed" reality (42.81% patient-reported) |
| F-14 | Anticoagulant / insulin / pacemaker / dialysis / pregnancy quick flags | HVA | C5 | MedicAlert engraving guidance |
| F-15 | Implants & devices list (pacemaker, stent, insulin pump) | NTH | C1 | IPS "Medical Devices" recommended section |
| F-16 | Living-will / DNR indicator with link to scanned หนังสือแสดงเจตนา (s.12 National Health Act) | NTH | C5 | Low uptake (<1%); ethically sensitive — show only if user opts in |
| F-17 | Organ-donor pledge indicator (Thai Red Cross e-card photo) | NTH | C1 | Apple Medical ID has this (US only) |
| F-18 | Health-insurance scheme field (บัตรทอง/ประกันสังคม/ข้าราชการ/เอกชน) + hospital of registration | HVA | C1 | Standard Thai registration field |
| F-19 | Preferred hospital & physician contact | NTH | C1 | Helps ER continuity |
| F-20 | Multi-profile (family/elder caregiver manages parent's card) | NTH | C1, C5 | Medical ID premium differentiator; PDPA s.20 consent complexity for minors — defer |
| F-21 | iOS WidgetKit lock-screen accessory widget via @bacons/apple-targets + EAS Build | OOS (stretch) | C5 | No Mac; iPhone availability unknown |
| F-22 | Wear OS / watch complication | OOS | — | Time |

### B. Records & certificates archive
| # | Feature | Tag | Rubric | Rationale |
|---|---|---|---|---|
| F-23 | Camera scan / gallery upload of documents (expo-camera / expo-image-picker) | CORE | C1, C3 (camera) | Proposal §4 |
| F-24 | Document types: medical certificate (general / driving / 5-disease / sick leave), lab result, prescription, discharge summary, vaccine book, drug-allergy card, imaging report, receipt/insurance, other | CORE | C1 | TMC forms extracted |
| F-25 | Structured metadata per doc: type, hospital, physician, licence no., date (BE/CE), valid-until (auto = +1 month for certificates), tags, notes | CORE | C1 | TMC forms: validity 1 month |
| F-26 | Timeline view (by date) + filter by type/hospital + search | CORE | C1, C5 | Rubric: history, timestamps |
| F-27 | Encrypted upload to server (HTTPS) + at-rest encryption (server-side AES-256-GCM, key from env / KMS) | CORE | C2, INT | Proposal §5-6 |
| F-28 | Local cache / offline mode (expo-sqlite or AsyncStorage) so card shows without network | CORE | C1 | Lock-screen widget must not depend on network |
| F-29 | Export: PDF summary (expo-print), JSON (FHIR-lite Bundle), CSV of records | HVA | C1 | Rubric C1 export item |
| F-30 | Share a record set via time-limited encrypted link + optional passcode (SHL-style) | HVA | C2, INT | SHL spec |
| F-31 | Expiry reminders (certificate valid-until, vaccine due) via local notifications (expo-notifications) | HVA | C2 | Rubric "notification or automated alert" |
| F-32 | Server-side scheduled job (node-cron) sending push/e-mail reminder | NTH | C2 | Counts as automation; optional |
| F-33 | OCR of certificates (Typhoon OCR / Cloud Vision) to pre-fill metadata; confidence display; user confirms | HVA | C4 (INT) | Proposal §6 optional AI; ML Kit lacks Thai |
| F-34 | OCR of drug labels -> add medication | NTH | C4 | Same pipeline |
| F-35 | Drug-allergy card digitisation with Naranjo-style assessment field | HVA | C1, C5 | TJPP paper fields |
| F-36 | Vaccination record entries (FHIR Immunization) + photo of vaccine book | HVA | C1 | Mor Prom holds official; ours = personal copy |
| F-37 | Medication list with dose/schedule; "critical for ER" flag | HVA | C1 | IPS Medication Summary |
| F-38 | Condition list with onset year, status active/resolved | HVA | C1 | FHIR Condition |
| F-39 | Hospital autocomplete from MOPH facility list | NTH | C1 | hcode list is 403; free text fallback |
| F-40 | Duplicate/missing-field/invalid-range validation (13-digit ID checksum, phone format, BP range, date not in future) | CORE | C1 | Rubric validation item; thai-id-validator |
| F-41 | Audit log of who viewed the public card (server) | HVA | C2, C5 | PDPA accountability; demoable |
| F-42 | Version history of card edits | NTH | C1 | "history" rubric item |
| F-43 | Symptom diary / vitals log (BP, glucose) with chart | NTH | C1/C3 | Rubric example; scope creep for 5 weeks |
| F-44 | Mock or BLE sensor stream (ESP32 SpO2/HR) with threshold alert | OOS | C3 | Not in proposal; adds hardware risk |
| F-45 | Image classification "preliminary analysis" of medical images | OOS | C4 | SaMD risk; not in proposal |

### C. Security, privacy, consent
| # | Feature | Tag | Rubric | Rationale |
|---|---|---|---|---|
| F-46 | App PIN/password + biometric (expo-local-authentication) gating in-depth data | CORE | C5 | Proposal §4 |
| F-47 | Two-tier data: public "emergency" tier (no auth) vs private tier (auth) | CORE | C5 | Apple/Android model |
| F-48 | PDPA consent screen: separate explicit checkbox for health (sensitive) data, purposes listed, retention stated, withdraw button; logged as FHIR Consent record with timestamp/version | CORE | C5, C1 | PDPA s.19/s.26; rubric consent screen |
| F-49 | Privacy notice (TH/EN) hosted at public URL + in-app | CORE | C5 | Google Play policy |
| F-50 | Account deletion / data erasure endpoint (right to erasure) | HVA | C2 | PDPA data-subject rights |
| F-51 | Consent withdrawal -> disables sharing & clears server copy | HVA | C2 | PDPA s.19 |
| F-52 | Server auth: email+password (bcrypt) + JWT; rate limiting; helmet | CORE | C2 | Standard |
| F-53 | Public card endpoint returns only whitelisted fields; token rotates on "revoke" | CORE | C2 | Privacy contingency |
| F-54 | Guardian consent flow for minors (PDPA s.20) | OOS | C5 | Complexity; state as limitation |
| F-55 | Role-based UI: patient vs rescuer/clinician view (read-only rescuer link) | HVA | C5 | Rubric role-based interface |

### D. Telemedicine bridge (see §7)
| # | Feature | Tag | Rubric | Rationale |
|---|---|---|---|---|
| F-56 | "Prepare for consult" summary (IPS-lite PDF/share link) to hand to MorDee/Doctor Anywhere/hospital telemed | TMB | C1, C5 | Legal: consults only via licensed facilities |
| F-57 | Deep links / directory of licensed telemedicine services (MorDee, Doctor Anywhere TH, Samitivej Virtual Hospital, Ooca, Mor Prom) with disclaimer | TMB | C5 | Directory only |
| F-58 | Appointment/visit log with next-steps notes (post-consult) | TMB | C1 | Records continuity |
| F-59 | Pharmacist/clinician read-only web page for the share link (rescuer view in browser) | TMB | C2, INT | Same public endpoint as F-30 |
| F-60 | In-app video call / chat with doctors | OOS | — | TMC 54/2563 Art. 8; no licensed facility |
| F-61 | e-Prescription / medicine delivery | OOS | — | Regulatory |
| F-62 | Symptom checker / AI triage | OOS | C4 | SaMD; rubric says no diagnosis in place of doctor |

### E. Localisation & accessibility
| # | Feature | Tag | Rubric | Rationale |
|---|---|---|---|---|
| F-63 | TH/EN UI with i18n-js/react-i18next; language toggle; card shows both languages for rescuers | CORE | C5 | Primary users Thai; foreign rescuers/tourists |
| F-64 | Buddhist-era date display & input (dayjs buddhistEra), CE stored | CORE | C5 | Thai documents use BE |
| F-65 | Thai fonts (Sarabun/Noto Sans Thai) with large-text mode (>=20 sp body, 28+ for card) | CORE | C5 | Elderly primary users |
| F-66 | High-contrast, red/amber/green status labels (e.g. allergy severity), haptics | HVA | C5 | Rubric clinically meaningful labels |
| F-67 | Thai ID checksum, phone, address (thai-data provinces) validation | HVA | C1 | |
| F-68 | Screen-reader labels (accessibilityLabel) | NTH | C5 | |

### F. Delivery / engineering
| # | Feature | Tag | Rubric | Rationale |
|---|---|---|---|---|
| F-69 | Express REST API with OpenAPI doc + Postman collection | CORE | C2, INT | Rubric technical explanation |
| F-70 | PostgreSQL schema (users, profiles, allergies, conditions, medications, contacts, documents, consents, share_tokens, access_logs) with timestamps | CORE | C1 | Rubric structured schema |
| F-71 | Seed/demo mode with fake patient (offline-safe demo) | HVA | — | Live demo resilience |
| F-72 | Error states: no network, expired link, wrong PIN, OCR failed | CORE | rubric "handling errors" | |
| F-73 | Jest unit tests for validators + supertest API tests | HVA | rubric testing | |
| F-74 | Architecture diagram + README + demo video + disclaimer | CORE | rubric docs | |

**Recommended advanced-feature set for the rubric (>=5, >=3 categories, >=2 integrations):** (1) C2 Express REST backend + PostgreSQL with encryption [INT]; (2) C1 local SQLite/AsyncStorage cache + PDF/JSON export; (3) C2 automated expiry reminders (local notifications + optional node-cron); (4) C4 cloud OCR pre-fill with confidence score [INT]; (5) C5 consent/privacy screen + role-based rescuer view + large-font accessibility; (6) C2/C5 encrypted share-link with passcode (SHL-style) [INT]. Categories covered: C1, C2, C4, C5 (4 of 5). Camera capture also satisfies "sensor/OS API" narrative without C3 hardware.

---

## 6. (b) Prioritised "first 60 seconds" rescuer/ER field list

Ordering follows SAMPLE (A-M-P) + ACEP engraving priority + NIEMS 1669 needs. Each entry: what to show, how, and harm-avoidance note.

1. **Identity: name (TH+EN), age (computed from DOB), sex, photo** — needed to match the phone to the patient; without a photo a rescuer may read another person's card (phone borrowed/found). Harm note: show DOB only as age; hide national ID on the lock screen.
2. **Drug allergies with severity (anaphylaxis / SJS-TEN flagged in red)** — top of card; show generic names in EN + TH (e.g. "Penicillin / เพนิซิลลิน"). Harm note: show explicit "No known drug allergies / ไม่ทราบว่าแพ้ยา" vs "Not entered / ยังไม่ได้ระบุ" — an empty field must never read as "no allergy". Include "self-reported" badge; hospital-assessed entries may show "Confirmed by hospital card".
3. **Critical conditions that change treatment**: insulin-dependent diabetes, epilepsy/seizure, heart disease (+ pacemaker), stroke history, CKD on dialysis (which arm has the fistula — do not take BP/IV there), bleeding disorder/haemophilia, asthma/COPD, pregnancy, dementia. Harm note: pick-list with plain-language TH labels; avoid free text that ER staff can't parse.
4. **High-risk medications**: anticoagulants (warfarin, apixaban, rivaroxaban, clopidogrel), insulin, steroids, immunosuppressants, opioids, antiepileptics, beta-blockers. Harm note: show drug names not brand nicknames; show "last dose time" only if the user maintains it (stale data is dangerous — show updated-at date).
5. **Blood group ABO + Rh** — show; flag Rh-negative prominently (rare in Thailand). Harm note: ER will always cross-match; label "self-reported — hospital will re-test" so nobody transfuses on the card alone.
6. **Emergency contacts (2) with relationship + tap-to-call** — ICE convention. Harm note: contact must have consented to being listed (PDPA: third-party personal data) — add a checkbox "I have informed this person".
7. **Preferred language / interpreter need** — Thai/English/other; helps foreign patients and Thai rescuers.
8. **Health-insurance scheme + registered hospital** — speeds admission/referral (UCEP for critical emergencies applies regardless). Harm note: lower priority than clinical data; place below the fold.
9. **Implants/devices & DNR/living-will pointer** — "Living will on file (see document)". Harm note: never display "DNR" as an instruction on the lock screen; show only that a signed document exists, because s.12 documents must be verified by the treating team.
10. **1669 call button and location** — for bystanders; GPS lat/long in text for the dispatcher (NIEMS step 3).
11. **Last-updated date** — mandatory footer; card older than 12 months shows amber "อาจไม่เป็นปัจจุบัน / may be outdated".

Never on the lock screen by default: national ID number, full address, HIV/psychiatric diagnoses (user opt-in only, PDPA sensitive), full medication list, document images.

---

## 7. (c) Telemedicine: in-scope for this 5-week prototype vs scope creep

**In scope (bridge, no clinical service):**
- F-56 "Prepare for consult" IPS-lite summary (conditions, allergies, meds, recent documents) exported as PDF/share link so the patient can present it in MorDee/Doctor Anywhere/hospital telemed. Justification: TMC 54/2563 Art. 8 restricts telemedicine to licensed facilities; the prototype must not host consultations.
- F-57 directory/deep links to licensed Thai services (MorDee `com.truedigital.vhealth`, Doctor Anywhere `com.doctoranywhere`, Ooca `co.ooca.user`, Samitivej Virtual Hospital, Mor Prom) with an "external service, not affiliated" disclaimer.
- F-58 visit log with next-steps text (rubric: "summary report that clearly states limitations and next steps").
- F-59 clinician read-only web view of a share link (browser page rendered by Express) — shows the same data as the QR link; demonstrable in the live demo on a laptop.

**Scope creep (exclude, list as future work):** in-app video/chat (F-60), e-prescription/delivery (F-61), symptom checker/AI triage (F-62), integration with Mor Prom/Health Link APIs (no public API), ThaID login, insurance claims, appointment booking with real hospitals, wearable vitals streaming.

---

## 8. (d) Thai localisation must-haves
1. Full Thai UI strings + English; card renders both languages side by side for rescuers (Thai first).
2. Buddhist Era on every displayed date (พ.ศ. 2569) with CE in brackets; store ISO 8601 CE; dayjs `buddhistEra` plugin, not Hermes Intl calendar.
3. Thai fonts: Sarabun (official government-style) or Noto Sans Thai via @expo-google-fonts; min 18-20 sp body, 28-32 sp for card headline; line-height >=1.5 for Thai diacritics.
4. Thai name structure: คำนำหน้า (นาย/นาง/นางสาว/เด็กชาย/เด็กหญิง), ชื่อ, นามสกุล; English transliteration field.
5. 13-digit national ID with checksum (thai-id-validator); optional passport number for foreigners; HN per hospital.
6. Phone formats: 0X-XXX-XXXX / 08X-XXX-XXXX; emergency numbers 1669, 191, 1646, 1554, 1666 (organ donation) as constants.
7. Address with province/district/sub-district/postcode pick-lists (thai-data 3.0.2).
8. Health-insurance scheme pick-list: บัตรทอง (UCS), ประกันสังคม (SSS), ข้าราชการ (CSMBS), ประกันเอกชน, ชำระเอง.
9. Drug-allergy card vocabulary: แพ้ยา / อาการข้างเคียง / ข้อควรระวัง; ระดับความรุนแรง เล็กน้อย/ปานกลาง/รุนแรง; common culprits pick-list (allopurinol, carbamazepine, phenytoin, NSAIDs, sulfa, penicillins, TB drugs, nevirapine/abacavir).
10. Chronic-disease pick-list in Thai (see §4.5) with ICD-10-style codes optional.
11. Certificate types per TMC forms (ทั่วไป 2561, ใบขับขี่ 2564, 5 โรค) with 1-month validity default.
12. Religion field optional (appears on Thai hospital forms; useful for end-of-life/diet; PDPA sensitive — opt-in). [UNVERIFIED that hospital forms universally include it]
13. Consent and privacy notice in Thai as the primary legal text, English secondary.
14. Number formatting: Thai digits not required; use Arabic numerals.

---

## 9. (e) Responsible-use / limitation / disclaimer statements (suggested wording)

**Educational prototype (README + in-app About + Play listing):**
- EN: "MediFirstCard is a student prototype developed for the course 040333215 Smart Technology (2026). It is for educational purposes only. It is not a medical device and does not diagnose, treat, cure, or prevent any medical condition. Always consult a healthcare professional for medical advice, diagnosis, or treatment."
- TH: "MediFirstCard เป็นต้นแบบที่นักศึกษาพัฒนาขึ้นเพื่อการศึกษาในรายวิชา 040333215 Smart Technology (2569) เท่านั้น ไม่ใช่เครื่องมือแพทย์ และไม่ได้ใช้เพื่อวินิจฉัย รักษา หรือป้องกันโรคใด ๆ โปรดปรึกษาแพทย์หรือบุคลากรทางการแพทย์สำหรับคำแนะนำ การวินิจฉัย หรือการรักษาเสมอ"

**Self-reported data warning (on the emergency card footer and rescuer web view):**
- EN: "Information on this card was entered by the user and has not been verified by a hospital. Last updated: {date}. Medical staff must confirm blood group, allergies and medications by standard procedures."
- TH: "ข้อมูลในบัตรนี้ผู้ใช้เป็นผู้กรอกเอง ยังไม่ได้รับการตรวจสอบจากโรงพยาบาล ปรับปรุงล่าสุด: {วันที่} บุคลากรทางการแพทย์ต้องยืนยันหมู่เลือด ประวัติแพ้ยา และยาที่ใช้ตามขั้นตอนมาตรฐาน"

**Lock-screen exposure notice (shown when enabling the widget):**
- EN: "Anyone who picks up your phone can read the fields you choose to show on the lock screen, even when the phone is locked. Show only what could save your life. You can change this at any time."
- TH: "ทุกคนที่หยิบโทรศัพท์ของคุณสามารถอ่านข้อมูลที่คุณเลือกแสดงบนหน้าจอล็อกได้ แม้เครื่องจะล็อกอยู่ โปรดแสดงเฉพาะข้อมูลที่จำเป็นต่อการช่วยชีวิต และเปลี่ยนแปลงได้ตลอดเวลา" (mirrors Google's own warning, support.google.com/android/answer/9319337)

**PDPA explicit consent (separate checkbox, sensitive data):**
- TH: "ข้าพเจ้ายินยอมให้แอป MediFirstCard เก็บรวบรวม ใช้ และแสดงข้อมูลสุขภาพของข้าพเจ้า (หมู่เลือด โรคประจำตัว ประวัติแพ้ยา ยาที่ใช้ เอกสารทางการแพทย์) เพื่อวัตถุประสงค์ (1) แสดงข้อมูลฉุกเฉินตามที่ข้าพเจ้าเลือกบนหน้าจอล็อก และ (2) จัดเก็บเอกสารทางการแพทย์ของข้าพเจ้าเอง ข้อมูลจะถูกเก็บไว้จนกว่าข้าพเจ้าจะลบบัญชี และจะถูกลบภายใน 30 วันหลังจากนั้น ข้าพเจ้าสามารถถอนความยินยอมได้ทุกเมื่อในเมนู 'ความเป็นส่วนตัว' โดยไม่มีค่าใช้จ่าย"
- EN: "I give my explicit consent for MediFirstCard to collect, use and display my health data (blood group, chronic conditions, drug allergies, medications, medical documents) for the purposes of (1) showing the emergency information I select on my lock screen and (2) storing my own medical documents. Data is kept until I delete my account and erased within 30 days. I may withdraw consent at any time in 'Privacy' at no cost."
- Emergency-contact third-party notice: TH "ข้าพเจ้าได้แจ้งให้ผู้ติดต่อฉุกเฉินทราบแล้วว่าจะบันทึกชื่อและเบอร์โทรของเขาในแอปนี้" / EN "I have informed my emergency contacts that their name and phone number are stored in this app."

**Telemedicine bridge disclaimer:**
- EN: "MediFirstCard does not provide medical consultations. Links to telemedicine services are provided for convenience; those services are operated by licensed providers not affiliated with this project."
- TH: "MediFirstCard ไม่ได้ให้บริการปรึกษาแพทย์ ลิงก์ไปยังบริการแพทย์ทางไกลจัดไว้เพื่อความสะดวก ผู้ให้บริการเหล่านั้นเป็นสถานพยาบาลที่ได้รับอนุญาตและไม่เกี่ยวข้องกับโครงการนี้"

**Limitations list for README/video:** lock-screen widget only on Android 16 QPR2+ devices that allow third-party lock-screen widgets (Pixel confirmed; Samsung unconfirmed); iOS not built; OCR accuracy on Thai handwriting untested; no connection to Mor Prom/Health Link; not PDPA-audited; no guardian-consent flow for minors; encryption uses a single server key (no HSM); prototype server on free tier may sleep.

---

## 10. Packages and services (concrete)
- Expo SDK 54+ managed workflow (react-native-android-widget requires expo >=54 as optional peer).
- `react-native-android-widget@0.22.1` (widget); `react-native-qrcode-svg@6.3.22` + `react-native-svg`; `dayjs` + `dayjs/plugin/buddhistEra`; `thai-id-validator@1.1.7`; `thai-data@3.0.2`; `@expo-google-fonts/sarabun` or `@expo-google-fonts/noto-sans-thai`; `expo-camera`, `expo-image-picker`, `expo-local-authentication`, `expo-secure-store`, `expo-sqlite`, `expo-notifications`, `expo-print`, `expo-sharing`, `expo-location`, `expo-sms`, `i18n-js`.
- Backend: Node 20 + Express 4/5, `pg`, `bcrypt`, `jsonwebtoken`, `helmet`, `express-rate-limit`, `multer` (uploads), Node `crypto` AES-256-GCM; PostgreSQL free tier (Neon/Supabase) or Firestore; file storage Supabase Storage/Cloudflare R2 free tier. [Provider free-tier limits UNVERIFIED in this run]
- OCR: Typhoon OCR (https://opentyphoon.ai/model/typhoon-ocr) or Google Cloud Vision (free monthly units) — Thai script; ML Kit is Latin-only for Thai purposes.
- Test devices: physical Android phone (any Android 12+ for widget on home screen); Android Studio AVD Pixel 9 with Android 16 QPR2 image for lock-screen widget demo.

## 11. Gaps not closed
- Exhaustive Apple Medical ID field list from Apple's own guide (only 5 sections confirmed).
- Whether react-native-android-widget exposes `widgetCategory`/keyguard config, and whether Samsung One UI 8/8.5 accepts third-party lock-screen widgets.
- Exact 2568 MOPH EPI vaccine ages (PDF 403 / images).
- Official NIEMS page text for the 1669 script (only secondary sources).
- Health Link / Mor Prom data standards (FHIR?) and any developer API.
- Thai FDA SaMD guidance primary PDF; PDPC official consent template.
- Rh-negative prevalence figure from Thai Red Cross primary page.
- Free-tier limits of Neon/Supabase/R2 as of Sept 2026.
