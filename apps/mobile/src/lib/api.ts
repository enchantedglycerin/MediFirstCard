import { useSession } from "../store/session";
import type {
  EmergencyProfileInput, AllergyInput, ConditionInput, MedicationInput, ContactInput,
  LockScreenFieldsInput, CreateRecordInput, ReviewedRecordInput, CreateShareLinkInput,
  CardLine, LockScreenFields,
} from "@mfc/shared";

/** Every failure the UI can see. status 0 = network / server unreachable. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** Map any thrown value to an i18n key the screens can show. */
export function errorKey(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return "errors.network";
    if (e.status === 401) return "errors.unauthorized";
    if (e.code === "DUPLICATE_RECORD") return "errors.duplicate_record";
    if (e.code === "NO_PROFILE") return "errors.noProfile";
    if (e.code === "ALLERGIES_EXIST") return "errors.allergiesExist";
    if (e.code === "PAYLOAD_TOO_LARGE" || e.status === 413) return "errors.tooLarge";
  }
  if (e instanceof TypeError) return "errors.network";
  return "errors.generic";
}

/**
 * Single-flight token refresh. Several queries usually expire together (a screen
 * fires them in parallel); if each called /auth/refresh with the same refresh
 * token, the server's reuse detection would revoke the whole token family and
 * sign the user out. So the first 401 starts one refresh and the rest await it.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const { apiBaseUrl, refreshToken, setTokens, signOut } = useSession.getState();
    if (!refreshToken) return false;
    let r: Response;
    try {
      r = await fetch(`${apiBaseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
    } catch (e) {
      throw new ApiError(0, "NETWORK", e instanceof Error ? e.message : "Network request failed");
    }
    if (r.ok) {
      const t = (await r.json()) as { accessToken: string; refreshToken: string };
      await setTokens(t);
      return true;
    }
    await signOut();
    return false;
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

async function raw(path: string, init: RequestInit, retry = true): Promise<Response> {
  const { apiBaseUrl, accessToken } = useSession.getState();
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  } catch (e) {
    throw new ApiError(0, "NETWORK", e instanceof Error ? e.message : "Network request failed");
  }

  if (res.status === 401 && retry && useSession.getState().refreshToken) {
    if (await refreshSession()) return raw(path, init, false);
  }
  return res;
}

async function json<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await raw(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = body as { code?: string; message?: string } | null;
    throw new ApiError(res.status, err?.code ?? "ERROR", err?.message ?? `HTTP ${res.status}`);
  }
  return body as T;
}

const V1 = "/api/v1";

// ---------- DTOs (what the API actually returns) ----------

export interface AuthResult { user: { id: string; email: string }; accessToken: string; refreshToken: string }
export interface MeDto { id: string; email: string; locale: string }

export type BloodAbo = "A" | "B" | "AB" | "O" | "unknown";
export type BloodRh = "pos" | "neg" | "unknown";
export type Sex = "male" | "female" | "other" | "unspecified";
export type InsuranceScheme = "ucs" | "sss" | "csmbs" | "private" | "self_pay" | "unknown";
export interface ProfileFlags { anticoagulant: boolean; insulin: boolean; pacemaker: boolean; dialysis: boolean; pregnancy: boolean }

/** GET /me/profile returns `{ lockScreenFields, exists: false }` before the first save, so most fields are optional. */
export interface ProfileDto {
  exists?: boolean;
  firstNameTh?: string | null; lastNameTh?: string | null; nameEn?: string | null;
  dob?: string | null; sex?: Sex; bloodAbo?: BloodAbo; bloodRh?: BloodRh;
  noKnownDrugAllergy?: boolean; flags?: ProfileFlags; insuranceScheme?: InsuranceScheme;
  preferredLanguage?: "th" | "en"; notes?: string | null;
  lockScreenFields: LockScreenFields; lastReviewedAt?: string | null;
}
export function profileExists(p: ProfileDto | undefined): boolean {
  return !!p && p.exists !== false;
}

export interface AllergyDto {
  id: string; substanceEn: string | null; substanceTh: string | null;
  category: "medication" | "food" | "environment"; reaction: string | null;
  severity: "mild" | "moderate" | "severe"; source: "self" | "hospital_card";
}
export interface ConditionDto {
  id: string; code: string | null; labelTh: string | null; labelEn: string | null;
  status: "active" | "resolved"; onsetYear: number | null; critical: boolean;
}
export interface MedicationDto {
  id: string; name: string | null; strength: string | null; dose: string | null; frequencyTh: string | null; critical: boolean;
}
export interface ContactDto {
  id: string; name: string | null; relationship: string | null; phone: string | null; informedConsent: boolean; priority: number;
}

export interface EmergencyCard {
  lines: CardLine[];
  lastReviewedAt: string | null;
  emergencyUrl: string;
  qrPngDataUrl: string;
  shareLinkId: string;
}
export interface RecordDto {
  id: string; kind: string; status: "pending" | "uploaded" | "extracted" | "reviewed";
  title: string | null; facility: string | null; doctorName: string | null; doctorLicenseNo: string | null;
  issuedAt: string | null; validUntil: string | null; mime: string | null; sizeBytes: number | null;
  notes: string | null; createdAt: string;
}
export interface ExtractedField { value?: unknown; confidence?: number; evidence?: string | null }
export interface ExtractResult {
  extractionId: string;
  extraction: Record<string, unknown>;
  fieldMeta: Record<string, { confidence: number; band: "high" | "medium" | "low" | "none" }>;
  needsReview: boolean;
  warnings: string[];
  source: "live" | "mock";
  model?: string;
}
export interface NotificationDto { id: string; kind: string; payload: unknown; readAt: string | null; createdAt: string }
export interface ShareLinkDto {
  id: string; scope: string; expiresAt: string | null; revokedAt: string | null;
  viewCount: number; maxViews: number | null; createdAt: string;
}
export interface ShareAccessLogDto { id: string; accessedAt: string; ip: string | null; userAgent: string | null; outcome: string }
export interface ConsentDto { version: number; purposes: Record<string, boolean>; granted: boolean; at: string }

/** Read a value out of an extraction field, whether it is `{value}` or a bare string. */
export function fieldValue(ex: Record<string, unknown>, key: string): string {
  const f = ex[key];
  if (f == null) return "";
  if (typeof f === "object" && "value" in (f as object)) {
    const v = (f as ExtractedField).value;
    return v == null ? "" : String(v);
  }
  return String(f);
}

/** Convert an authenticated image response into a data URL the <Image> component can show. */
async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error ?? new Error("read failed"));
    fr.readAsDataURL(blob);
  });
}

export const api = {
  // auth
  register: (email: string, password: string) =>
    json<AuthResult>(`${V1}/auth/register`, { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    json<AuthResult>(`${V1}/auth/login`, { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => json<{ ok: true }>(`${V1}/auth/logout`, { method: "POST", body: JSON.stringify({ refreshToken: useSession.getState().refreshToken }) }).catch(() => ({ ok: true as const })),
  me: () => json<MeDto>(`${V1}/me`),

  // profile
  getProfile: () => json<ProfileDto>(`${V1}/me/profile`),
  putProfile: (input: Partial<EmergencyProfileInput>) => json<ProfileDto>(`${V1}/me/profile`, { method: "PUT", body: JSON.stringify(input) }),
  setLockScreenFields: (fields: LockScreenFieldsInput) => json<{ lockScreenFields: LockScreenFields }>(`${V1}/me/lock-screen-fields`, { method: "PUT", body: JSON.stringify(fields) }),
  emergencyCard: () => json<EmergencyCard>(`${V1}/me/emergency-card`),

  // profile sub-collections
  listAllergies: () => json<AllergyDto[]>(`${V1}/me/allergies`),
  addAllergy: (input: Partial<AllergyInput>) => json<AllergyDto>(`${V1}/me/allergies`, { method: "POST", body: JSON.stringify(input) }),
  updateAllergy: (id: string, input: Partial<AllergyInput>) => json<AllergyDto>(`${V1}/me/allergies/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteAllergy: (id: string) => json<{ ok: true }>(`${V1}/me/allergies/${id}`, { method: "DELETE" }),

  listConditions: () => json<ConditionDto[]>(`${V1}/me/conditions`),
  addCondition: (input: Partial<ConditionInput>) => json<ConditionDto>(`${V1}/me/conditions`, { method: "POST", body: JSON.stringify(input) }),
  updateCondition: (id: string, input: Partial<ConditionInput>) => json<ConditionDto>(`${V1}/me/conditions/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteCondition: (id: string) => json<{ ok: true }>(`${V1}/me/conditions/${id}`, { method: "DELETE" }),

  listMedications: () => json<MedicationDto[]>(`${V1}/me/medications`),
  addMedication: (input: Partial<MedicationInput>) => json<MedicationDto>(`${V1}/me/medications`, { method: "POST", body: JSON.stringify(input) }),
  updateMedication: (id: string, input: Partial<MedicationInput>) => json<MedicationDto>(`${V1}/me/medications/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteMedication: (id: string) => json<{ ok: true }>(`${V1}/me/medications/${id}`, { method: "DELETE" }),

  listContacts: () => json<ContactDto[]>(`${V1}/me/contacts`),
  addContact: (input: Partial<ContactInput>) => json<ContactDto>(`${V1}/me/contacts`, { method: "POST", body: JSON.stringify(input) }),
  updateContact: (id: string, input: Partial<ContactInput>) => json<ContactDto>(`${V1}/me/contacts/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteContact: (id: string) => json<{ ok: true }>(`${V1}/me/contacts/${id}`, { method: "DELETE" }),

  // records
  createRecord: (input: CreateRecordInput) => json<{ recordId: string; uploadUrl: string }>(`${V1}/records`, { method: "POST", body: JSON.stringify(input) }),
  /** Upload straight to the known blob path (the server's uploadUrl may carry a different host than the app's Server URL). */
  uploadBlob: async (recordId: string, bytes: Uint8Array, mime: string) => {
    const res = await raw(`${V1}/records/${recordId}/blob`, { method: "PUT", headers: { "Content-Type": mime }, body: bytes as unknown as BodyInit });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
      throw new ApiError(res.status, err?.code ?? "UPLOAD", err?.message ?? "Upload failed");
    }
  },
  confirmRecord: (id: string) => json<RecordDto>(`${V1}/records/${id}/confirm`, { method: "POST" }),
  listRecords: () => json<RecordDto[]>(`${V1}/records`),
  getRecord: (id: string) => json<RecordDto>(`${V1}/records/${id}`),
  reviewRecord: (id: string, input: ReviewedRecordInput) => json<RecordDto>(`${V1}/records/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteRecord: (id: string) => json<{ ok: true }>(`${V1}/records/${id}`, { method: "DELETE" }),
  extract: (id: string) => json<ExtractResult>(`${V1}/records/${id}/extract`, { method: "POST" }),
  /** Fetch the stored image with auth and return a data: URL for <Image>. */
  fetchRecordImage: async (id: string): Promise<string> => {
    const res = await raw(`${V1}/records/${id}/blob`, { method: "GET" });
    if (!res.ok) throw new ApiError(res.status, "NOT_FOUND", "Image not available");
    return blobToDataUrl(await res.blob());
  },

  // share links (clinician)
  createShareLink: (input: CreateShareLinkInput) => json<{ id: string; url: string; expiresAt: string }>(`${V1}/share-links`, { method: "POST", body: JSON.stringify(input) }),
  listShareLinks: () => json<ShareLinkDto[]>(`${V1}/share-links`),
  revokeShareLink: (id: string) => json<{ ok: true }>(`${V1}/share-links/${id}/revoke`, { method: "POST" }),
  shareLinkLog: (id: string) => json<ShareAccessLogDto[]>(`${V1}/share-links/${id}/log`),

  // notifications
  notifications: () => json<NotificationDto[]>(`${V1}/me/notifications`),
  markNotificationRead: (id: string) => json<{ ok: true }>(`${V1}/me/notifications/${id}/read`, { method: "POST" }),

  // consent + erasure
  postConsent: (version: number, purposes: Record<string, boolean>, granted: boolean) =>
    json<{ ok: true }>(`${V1}/me/consent`, { method: "POST", body: JSON.stringify({ version, purposes, granted }) }),
  getConsent: () => json<ConsentDto | null>(`${V1}/me/consent`),
  deleteAccount: () => json<{ ok: true }>(`${V1}/me`, { method: "DELETE" }),

  /** "No known drug allergies" flag; the server refuses true while allergies are listed (ALLERGIES_EXIST). */
  setNoKnownDrugAllergy: (value: boolean) =>
    json<{ noKnownDrugAllergy: boolean }>(`${V1}/me/no-known-drug-allergy`, { method: "PUT", body: JSON.stringify({ value }) }),
};
