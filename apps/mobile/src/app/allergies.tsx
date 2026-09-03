import { Banner } from "react-native-paper";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { AllergyInput } from "@mfc/shared";
import { Screen } from "../components/Screen";
import { CollectionEditor, type FieldSpec, type Values } from "../components/CollectionEditor";
import { api, errorKey, type AllergyDto } from "../lib/api";

const CATEGORIES = ["medication", "food", "environment"] as const;
const SEVERITIES = ["mild", "moderate", "severe"] as const;

/** Trimmed text out of a dialog value (switch values never map to text). */
const text = (v: Values[string]): string => (v === undefined || typeof v === "boolean" ? "" : String(v)).trim();
/** Narrow a dialog value to one of the schema enums. */
const pick = <T extends string>(allowed: readonly T[], v: Values[string], fallback: T): T =>
  allowed.find((a) => a === v) ?? fallback;

/** Dialog values -> API input. Cleared optional fields are sent as undefined (the server stores null). */
function toInput(v: Values): Partial<AllergyInput> {
  return {
    substanceTh: text(v.substanceTh) || undefined,
    substanceEn: text(v.substanceEn) || undefined,
    category: pick(CATEGORIES, v.category, "medication"),
    reaction: text(v.reaction) || undefined,
    severity: pick(SEVERITIES, v.severity, "moderate"),
    source: "self",
  };
}

export default function Allergies() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const allergies = useQuery({ queryKey: ["allergies"], queryFn: api.listAllergies });

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["allergies"] }),
      qc.invalidateQueries({ queryKey: ["emergency-card"] }),
    ]);

  const fields: FieldSpec[] = [
    { key: "substanceTh", label: t("allergies.substanceTh"), type: "text" },
    { key: "substanceEn", label: t("allergies.substanceEn"), type: "text" },
    {
      key: "category",
      label: t("allergies.category"),
      type: "select",
      options: CATEGORIES.map((c) => ({ value: c, label: t(`allergies.categories.${c}`) })),
    },
    { key: "reaction", label: t("allergies.reaction"), type: "text" },
    {
      key: "severity",
      label: t("allergies.severity"),
      type: "select",
      initial: "moderate",
      options: SEVERITIES.map((s) => ({ value: s, label: t(`allergies.severities.${s}`) })),
    },
  ];

  return (
    <Screen>
      {allergies.isError ? (
        <Banner
          visible
          icon="alert-circle-outline"
          actions={[{ label: t("common.retry"), onPress: () => void allergies.refetch() }]}
        >
          {t(errorKey(allergies.error))}
        </Banner>
      ) : null}

      {allergies.isError && !allergies.data ? null : (
        <CollectionEditor<AllergyDto>
          items={allergies.data}
          loading={allergies.isPending}
          fields={fields}
          toValues={(a) => ({
            substanceTh: a.substanceTh ?? "",
            substanceEn: a.substanceEn ?? "",
            category: a.category,
            reaction: a.reaction ?? "",
            severity: a.severity,
          })}
          title={(a) => a.substanceTh || a.substanceEn || ""}
          description={(a) => [t(`allergies.categories.${a.category}`), a.reaction].filter(Boolean).join(" · ") || undefined}
          badge={(a) => t(`allergies.severities.${a.severity}`)}
          badgeUrgent={(a) => a.severity === "severe"}
          icon="alert-octagon-outline"
          emptyTitle={t("allergies.empty")}
          emptyHint={t("allergies.emptyHint")}
          addLabel={t("allergies.add")}
          editLabel={t("allergies.edit")}
          validate={(v) => (text(v.substanceTh) || text(v.substanceEn) ? null : { substanceTh: t("allergies.needSubstance") })}
          onCreate={async (v) => {
            await api.addAllergy(toInput(v));
            await refresh();
          }}
          onUpdate={async (id, v) => {
            await api.updateAllergy(id, toInput(v));
            await refresh();
          }}
          onDelete={async (id) => {
            await api.deleteAllergy(id);
            await refresh();
          }}
        />
      )}
    </Screen>
  );
}
