import { useState } from "react";
import { StyleSheet, View, type KeyboardTypeOptions } from "react-native";
import {
  ActivityIndicator, Button, Chip, Dialog, Divider, HelperText, IconButton, List, Portal,
  SegmentedButtons, Snackbar, Switch, Text, TextInput, useTheme,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { EmptyState } from "./EmptyState";
import { errorKey } from "../lib/api";
import { space } from "../theme/tokens";

export type FieldType = "text" | "phone" | "number" | "select" | "switch";

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  hint?: string;
  keyboard?: KeyboardTypeOptions;
  multiline?: boolean;
  /** Default for a new item. */
  initial?: string | number | boolean;
}

export type Values = Record<string, string | number | boolean | undefined>;

interface Props<T extends { id: string }> {
  items: T[] | undefined;
  loading: boolean;
  fields: FieldSpec[];
  /** Turn a row into the dialog's initial values. */
  toValues: (item: T) => Values;
  title: (item: T) => string;
  description?: (item: T) => string | undefined;
  /** Optional trailing text (e.g. "severe"). */
  badge?: (item: T) => string | undefined;
  badgeUrgent?: (item: T) => boolean;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  emptyTitle: string;
  emptyHint?: string;
  addLabel: string;
  editLabel: string;
  /** Return a map of field key -> error message, or null when valid. */
  validate?: (values: Values) => Record<string, string> | null;
  onCreate: (values: Values) => Promise<unknown>;
  onUpdate: (id: string, values: Values) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  /** Extra per-row action (e.g. a Call button). */
  rowAction?: (item: T) => React.ReactNode;
}

function initialValues(fields: FieldSpec[]): Values {
  const v: Values = {};
  for (const f of fields) {
    if (f.initial !== undefined) v[f.key] = f.initial;
    else if (f.type === "switch") v[f.key] = false;
    else if (f.type === "select" && f.options?.[0]) v[f.key] = f.options[0].value;
    else v[f.key] = "";
  }
  return v;
}

/**
 * Generic list + add/edit dialog for the profile sub-collections (allergies,
 * conditions, medications, emergency contacts). Screens only describe fields.
 */
export function CollectionEditor<T extends { id: string }>(props: Props<T>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [editing, setEditing] = useState<{ id: string | null; values: Values } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<T | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const open = (item?: T) => {
    setErrors({});
    setEditing(item ? { id: item.id, values: props.toValues(item) } : { id: null, values: initialValues(props.fields) });
  };
  const setValue = (key: string, value: Values[string]) =>
    setEditing((e) => (e ? { ...e, values: { ...e.values, [key]: value } } : e));

  async function save() {
    if (!editing) return;
    const errs: Record<string, string> = {};
    for (const f of props.fields) {
      const v = editing.values[f.key];
      if (f.required && (v === undefined || v === "" || v === null)) errs[f.key] = t("errors.required");
    }
    const custom = props.validate?.(editing.values);
    if (custom) Object.assign(errs, custom);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setBusy(true);
    try {
      if (editing.id) await props.onUpdate(editing.id, editing.values);
      else await props.onCreate(editing.values);
      setEditing(null);
      setMsg(t("common.saved"));
    } catch (e) {
      setMsg(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await props.onDelete(confirmDelete.id);
      setMsg(t("common.deleted"));
    } catch (e) {
      setMsg(t(errorKey(e)));
    } finally {
      setBusy(false);
      setConfirmDelete(null);
    }
  }

  const items = props.items ?? [];

  return (
    <View style={styles.wrap}>
      {props.loading ? <ActivityIndicator style={styles.loading} /> : null}

      {!props.loading && items.length === 0 ? (
        <EmptyState icon={props.icon} title={props.emptyTitle} hint={props.emptyHint} actionLabel={props.addLabel} onAction={() => open()} />
      ) : (
        <View style={[styles.list, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
          {items.map((item, i) => {
            const badge = props.badge?.(item);
            const urgent = props.badgeUrgent?.(item) ?? false;
            return (
              <View key={item.id}>
                {i > 0 ? <Divider /> : null}
                <List.Item
                  title={props.title(item)}
                  description={props.description?.(item)}
                  titleStyle={styles.itemTitle}
                  onPress={() => open(item)}
                  left={(p) => <List.Icon {...p} icon={props.icon} color={urgent ? theme.colors.error : theme.colors.primary} />}
                  right={() => (
                    <View style={styles.right}>
                      {badge ? (
                        <Chip compact textStyle={styles.badgeText} style={[styles.badge, { backgroundColor: urgent ? theme.colors.errorContainer : theme.colors.surfaceVariant }]}>
                          {badge}
                        </Chip>
                      ) : null}
                      {props.rowAction?.(item)}
                      <IconButton icon="delete-outline" onPress={() => setConfirmDelete(item)} accessibilityLabel={t("common.delete")} />
                    </View>
                  )}
                />
              </View>
            );
          })}
        </View>
      )}

      {items.length > 0 ? (
        <Button mode="contained-tonal" icon="plus" onPress={() => open()} style={styles.add}>{props.addLabel}</Button>
      ) : null}

      <Portal>
        <Dialog visible={!!editing} onDismiss={() => setEditing(null)} style={styles.dialog}>
          <Dialog.Title>{editing?.id ? props.editLabel : props.addLabel}</Dialog.Title>
          <Dialog.ScrollArea style={styles.scrollArea}>
            <View style={styles.form}>
              {props.fields.map((f) => {
                const v = editing?.values[f.key];
                const err = errors[f.key];
                if (f.type === "switch") {
                  return (
                    <View key={f.key} style={styles.switchRow}>
                      <Text variant="bodyMedium" style={styles.switchLabel}>{f.label}</Text>
                      <Switch value={Boolean(v)} onValueChange={(x) => setValue(f.key, x)} />
                    </View>
                  );
                }
                if (f.type === "select" && f.options) {
                  const opts = f.options;
                  return (
                    <View key={f.key} style={styles.selectWrap}>
                      <Text variant="labelLarge" style={styles.selectLabel}>{f.label}</Text>
                      {opts.length <= 4 ? (
                        <SegmentedButtons value={String(v ?? "")} onValueChange={(x) => setValue(f.key, x)} buttons={opts.map((o) => ({ value: o.value, label: o.label }))} />
                      ) : (
                        <View style={styles.chips}>
                          {opts.map((o) => (
                            <Chip key={o.value} selected={v === o.value} onPress={() => setValue(f.key, o.value)} showSelectedCheck compact>
                              {o.label}
                            </Chip>
                          ))}
                        </View>
                      )}
                      {err ? <HelperText type="error" visible>{err}</HelperText> : null}
                    </View>
                  );
                }
                return (
                  <View key={f.key}>
                    <TextInput
                      label={`${f.label}${f.required ? " *" : ""}`}
                      mode="outlined"
                      value={v === undefined || v === null ? "" : String(v)}
                      onChangeText={(x) => setValue(f.key, f.type === "number" ? (x === "" ? "" : Number(x.replace(/[^0-9]/g, "")) || "") : x)}
                      keyboardType={f.keyboard ?? (f.type === "phone" ? "phone-pad" : f.type === "number" ? "number-pad" : "default")}
                      multiline={f.multiline}
                      error={!!err}
                    />
                    {err || f.hint ? <HelperText type={err ? "error" : "info"} visible>{err ?? f.hint}</HelperText> : null}
                  </View>
                );
              })}
            </View>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setEditing(null)} disabled={busy}>{t("common.cancel")}</Button>
            <Button mode="contained" onPress={() => void save()} loading={busy} disabled={busy}>{t("common.save")}</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={!!confirmDelete} onDismiss={() => setConfirmDelete(null)}>
          <Dialog.Title>{t("common.delete")}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{confirmDelete ? props.title(confirmDelete) : ""}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmDelete(null)} disabled={busy}>{t("common.cancel")}</Button>
            <Button mode="contained" buttonColor={theme.colors.error} textColor={theme.colors.onError} onPress={() => void remove()} loading={busy} disabled={busy}>
              {t("common.delete")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal><Snackbar visible={!!msg} onDismiss={() => setMsg(null)} duration={2500}>{msg ?? ""}</Snackbar></Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  loading: { marginTop: space.lg },
  list: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  itemTitle: { fontWeight: "600" },
  right: { flexDirection: "row", alignItems: "center", gap: 2 },
  badge: { height: 28 },
  badgeText: { fontSize: 12, lineHeight: 16, marginVertical: 4 },
  add: { alignSelf: "stretch" },
  dialog: { maxHeight: "85%" },
  scrollArea: { paddingHorizontal: 0 },
  form: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: space.xs, gap: space.md },
  switchLabel: { flex: 1 },
  selectWrap: { gap: space.xs, marginTop: space.xs },
  selectLabel: { marginBottom: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
