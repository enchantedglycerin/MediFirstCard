import { Banner } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { MedicationInput } from "@mfc/shared";
import { Screen } from "../components/Screen";
import { CollectionEditor, type FieldSpec, type Values } from "../components/CollectionEditor";
import { api, errorKey, type MedicationDto } from "../lib/api";
import { invalidateAfterEdit } from "../lib/refresh";

/** Trimmed text out of a dialog value (switch values never map to text). */
const text = (v: Values[string]): string => (v === undefined || typeof v === "boolean" ? "" : String(v)).trim();

/** Dialog values -> API input. Cleared optional fields are sent as undefined (the server stores null). */
function toInput(v: Values): Partial<MedicationInput> {
  return {
    name: text(v.name),
    strength: text(v.strength) || undefined,
    dose: text(v.dose) || undefined,
    frequencyTh: text(v.frequencyTh) || undefined,
    critical: Boolean(v.critical),
  };
}

export default function Medications() {
  const { t } = useTranslation();
  const medications = useQuery({ queryKey: ["medications"], queryFn: api.listMedications });

  const refresh = () => invalidateAfterEdit("medications");

  const fields: FieldSpec[] = [
    { key: "name", label: t("medications.name"), type: "text", required: true },
    { key: "strength", label: t("medications.strength"), type: "text" },
    { key: "dose", label: t("medications.dose"), type: "text" },
    { key: "frequencyTh", label: t("medications.frequency"), type: "text" },
    { key: "critical", label: t("medications.critical"), type: "switch" },
  ];

  return (
    <Screen>
      {medications.isError ? (
        <Banner
          visible
          icon="alert-circle-outline"
          actions={[{ label: t("common.retry"), onPress: () => void medications.refetch() }]}
        >
          {t(errorKey(medications.error))}
        </Banner>
      ) : null}

      {medications.isError && !medications.data ? null : (
        <CollectionEditor<MedicationDto>
          items={medications.data}
          loading={medications.isPending}
          fields={fields}
          toValues={(m) => ({
            name: m.name ?? "",
            strength: m.strength ?? "",
            dose: m.dose ?? "",
            frequencyTh: m.frequencyTh ?? "",
            critical: m.critical,
          })}
          title={(m) => m.name ?? ""}
          description={(m) => [m.strength, m.dose, m.frequencyTh].filter(Boolean).join(" · ") || undefined}
          badge={(m) => (m.critical ? t("medications.critical") : undefined)}
          badgeUrgent={(m) => m.critical}
          icon="pill"
          emptyTitle={t("medications.empty")}
          emptyHint={t("medications.emptyHint")}
          addLabel={t("medications.add")}
          editLabel={t("medications.edit")}
          validate={(v) => (text(v.name) ? null : { name: t("errors.required") })}
          onCreate={async (v) => {
            await api.addMedication(toInput(v));
            await refresh();
          }}
          onUpdate={async (id, v) => {
            await api.updateMedication(id, toInput(v));
            await refresh();
          }}
          onDelete={async (id) => {
            await api.deleteMedication(id);
            await refresh();
          }}
        />
      )}
    </Screen>
  );
}
