import { useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import { Banner, IconButton, Portal, Snackbar, Text, useTheme } from "react-native-paper";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ContactInput } from "@mfc/shared";
import { Screen } from "../components/Screen";
import { CollectionEditor, type FieldSpec, type Values } from "../components/CollectionEditor";
import { api, errorKey, type ContactDto } from "../lib/api";
import { callNumber } from "../lib/phone";
import { isValidThaiPhone, normalizeThaiPhone } from "../lib/format";
import { space } from "../theme/tokens";

const RELATIONSHIPS = ["spouse", "parent", "child", "sibling", "friend", "other"] as const;
const MIN_PRIORITY = 1;
const MAX_PRIORITY = 5;

/** Trimmed text out of a dialog value (switch values never map to text). */
const text = (v: Values[string]): string => (v === undefined || typeof v === "boolean" ? "" : String(v)).trim();

/** Dialog values -> API input (phone normalised to digits only, as the schema expects). */
function toInput(v: Values): Partial<ContactInput> {
  return {
    name: text(v.name),
    relationship: text(v.relationship) || undefined,
    phone: normalizeThaiPhone(text(v.phone)),
    informedConsent: Boolean(v.informedConsent),
    priority: Number(v.priority) || MIN_PRIORITY,
  };
}

export default function Contacts() {
  const { t } = useTranslation();
  const theme = useTheme();
  const qc = useQueryClient();
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: api.listContacts });
  const [msg, setMsg] = useState<string | null>(null);

  /** Call order first, so the list mirrors what a rescuer sees on the card. */
  const items = useMemo(
    () => (contacts.data ? [...contacts.data].sort((a, b) => a.priority - b.priority) : undefined),
    [contacts.data],
  );

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["contacts"] }),
      qc.invalidateQueries({ queryKey: ["emergency-card"] }),
    ]);

  const fields: FieldSpec[] = [
    { key: "name", label: t("contacts.name"), type: "text", required: true },
    {
      key: "relationship",
      label: t("contacts.relationship"),
      type: "select",
      options: RELATIONSHIPS.map((r) => ({ value: r, label: t(`contacts.relationships.${r}`) })),
    },
    { key: "phone", label: t("contacts.phone"), type: "phone", required: true, hint: t("contacts.phoneHint") },
    { key: "priority", label: t("contacts.priority"), type: "number", initial: MIN_PRIORITY },
    { key: "informedConsent", label: t("contacts.informedConsent"), type: "switch" },
  ];

  const validate = (v: Values): Record<string, string> | null => {
    const errs: Record<string, string> = {};
    const phone = text(v.phone);
    if (phone && !isValidThaiPhone(phone)) errs.phone = t("contacts.invalidPhone");
    if (v.priority !== "" && v.priority !== undefined) {
      const p = Number(v.priority);
      if (!Number.isInteger(p) || p < MIN_PRIORITY || p > MAX_PRIORITY) errs.priority = t("contacts.invalidPriority");
    }
    return Object.keys(errs).length ? errs : null;
  };

  const call = async (c: ContactDto) => {
    const ok = c.phone ? await callNumber(c.phone) : false;
    if (!ok) setMsg(t("errors.callFailed"));
  };

  /** Known relationships are translated; free-text ones (older data) are shown as typed. */
  const relationshipLabel = (r: string | null) => (r ? t(`contacts.relationships.${r}`, { defaultValue: r }) : "");

  return (
    <Screen>
      {contacts.isError ? (
        <Banner
          visible
          icon="alert-circle-outline"
          actions={[{ label: t("common.retry"), onPress: () => void contacts.refetch() }]}
        >
          {t(errorKey(contacts.error))}
        </Banner>
      ) : null}

      {contacts.isError && !items ? null : (
        <CollectionEditor<ContactDto>
          items={items}
          loading={contacts.isPending}
          fields={fields}
          toValues={(c) => ({
            name: c.name ?? "",
            relationship: c.relationship ?? "",
            phone: c.phone ?? "",
            priority: c.priority,
            informedConsent: c.informedConsent,
          })}
          title={(c) => c.name ?? ""}
          description={(c) => [relationshipLabel(c.relationship), c.phone].filter(Boolean).join(" · ") || undefined}
          badge={(c) => `#${c.priority}`}
          icon="phone"
          emptyTitle={t("contacts.empty")}
          emptyHint={t("contacts.emptyHint")}
          addLabel={t("contacts.add")}
          editLabel={t("contacts.edit")}
          validate={validate}
          onCreate={async (v) => {
            await api.addContact(toInput(v));
            await refresh();
          }}
          onUpdate={async (id, v) => {
            await api.updateContact(id, toInput(v));
            await refresh();
          }}
          onDelete={async (id) => {
            await api.deleteContact(id);
            await refresh();
          }}
          rowAction={(c) =>
            c.phone ? (
              <IconButton
                icon="phone"
                mode="contained"
                size={32}
                onPress={() => void call(c)}
                accessibilityLabel={t("contacts.call", { name: c.name ?? "" })}
              />
            ) : null
          }
        />
      )}

      {items && items.length > 0 ? (
        <Text variant="bodySmall" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
          {t("consent.contact")}
        </Text>
      ) : null}

      <Portal>
        <Snackbar visible={!!msg} onDismiss={() => setMsg(null)} duration={2500}>
          {msg ?? ""}
        </Snackbar>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { paddingHorizontal: space.xs },
});
