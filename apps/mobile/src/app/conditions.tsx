import { Banner } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ConditionInput } from "@mfc/shared";
import { Screen } from "../components/Screen";
import { CollectionEditor, type FieldSpec, type Values } from "../components/CollectionEditor";
import { api, errorKey, type ConditionDto } from "../lib/api";
import { invalidateAfterEdit } from "../lib/refresh";

const STATUSES = ["active", "resolved"] as const;
const MIN_YEAR = 1900;

/** Trimmed text out of a dialog value (switch values never map to text). */
const text = (v: Values[string]): string => (v === undefined || typeof v === "boolean" ? "" : String(v)).trim();
/** Narrow a dialog value to one of the schema enums. */
const pick = <T extends string>(allowed: readonly T[], v: Values[string], fallback: T): T =>
  allowed.find((a) => a === v) ?? fallback;
/** The number field stores a number or "" - read it back as a year or null. */
const year = (v: Values[string]): number | null => {
  if (v === "" || v === undefined || typeof v === "boolean") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Dialog values -> API input. Cleared optional fields are sent as undefined (the server stores null). */
function toInput(v: Values): Partial<ConditionInput> {
  const y = year(v.onsetYear);
  return {
    labelTh: text(v.labelTh) || undefined,
    labelEn: text(v.labelEn) || undefined,
    code: text(v.code).toUpperCase() || undefined,
    status: pick(STATUSES, v.status, "active"),
    onsetYear: y !== null && y > 0 ? y : undefined,
    critical: Boolean(v.critical),
  };
}

export default function Conditions() {
  const { t } = useTranslation();
  const conditions = useQuery({ queryKey: ["conditions"], queryFn: api.listConditions });

  const refresh = () => invalidateAfterEdit("conditions");

  const fields: FieldSpec[] = [
    { key: "labelTh", label: t("conditions.labelTh"), type: "text" },
    { key: "labelEn", label: t("conditions.labelEn"), type: "text" },
    { key: "code", label: t("conditions.code"), type: "text" },
    {
      key: "status",
      label: t("conditions.status"),
      type: "select",
      options: STATUSES.map((s) => ({ value: s, label: t(`conditions.statuses.${s}`) })),
    },
    { key: "onsetYear", label: t("conditions.onsetYear"), type: "number" },
    { key: "critical", label: t("conditions.critical"), type: "switch" },
  ];

  const validate = (v: Values): Record<string, string> | null => {
    const errs: Record<string, string> = {};
    if (!text(v.labelTh) && !text(v.labelEn)) errs.labelTh = t("conditions.needLabel");
    const y = year(v.onsetYear);
    if (y !== null) {
      if (!Number.isInteger(y) || y < MIN_YEAR) errs.onsetYear = t("errors.invalid_date");
      else if (y > new Date().getFullYear()) errs.onsetYear = t("errors.future_date");
    }
    return Object.keys(errs).length ? errs : null;
  };

  return (
    <Screen>
      {conditions.isError ? (
        <Banner
          visible
          icon="alert-circle-outline"
          actions={[{ label: t("common.retry"), onPress: () => void conditions.refetch() }]}
        >
          {t(errorKey(conditions.error))}
        </Banner>
      ) : null}

      {conditions.isError && !conditions.data ? null : (
        <CollectionEditor<ConditionDto>
          items={conditions.data}
          loading={conditions.isPending}
          fields={fields}
          toValues={(c) => ({
            labelTh: c.labelTh ?? "",
            labelEn: c.labelEn ?? "",
            code: c.code ?? "",
            status: c.status,
            onsetYear: c.onsetYear ?? "",
            critical: c.critical,
          })}
          title={(c) => c.labelTh || c.labelEn || ""}
          description={(c) => [c.code, c.onsetYear].filter(Boolean).join(" · ") || undefined}
          badge={(c) => (c.critical ? t("conditions.critical") : t(`conditions.statuses.${c.status}`))}
          badgeUrgent={(c) => c.critical}
          icon="heart-pulse"
          emptyTitle={t("conditions.empty")}
          emptyHint={t("conditions.emptyHint")}
          addLabel={t("conditions.add")}
          editLabel={t("conditions.edit")}
          validate={validate}
          onCreate={async (v) => {
            await api.addCondition(toInput(v));
            await refresh();
          }}
          onUpdate={async (id, v) => {
            await api.updateCondition(id, toInput(v));
            await refresh();
          }}
          onDelete={async (id) => {
            await api.deleteCondition(id);
            await refresh();
          }}
        />
      )}
    </Screen>
  );
}
