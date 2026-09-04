import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import {
  ActivityIndicator, Banner, Button, Chip, Divider, List, Portal, SegmentedButtons, Snackbar, Switch,
  Text, TextInput, TouchableRipple, useTheme,
} from "react-native-paper";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Screen } from "../components/Screen";
import { Section } from "../components/Section";
import { DateField } from "../components/DateField";
import {
  api, errorKey, profileExists,
  type BloodAbo, type BloodRh, type InsuranceScheme, type ProfileDto, type ProfileFlags, type Sex,
} from "../lib/api";
import { invalidateAfterEdit } from "../lib/refresh";
import { currentLang } from "../i18n";
import { space } from "../theme/tokens";

const SEXES: readonly Sex[] = ["male", "female", "other", "unspecified"];
const ABO: readonly BloodAbo[] = ["A", "B", "AB", "O", "unknown"];
const RH: readonly BloodRh[] = ["pos", "neg", "unknown"];
const FLAGS: readonly (keyof ProfileFlags)[] = ["anticoagulant", "insulin", "pacemaker", "dialysis", "pregnancy"];
const INSURANCE: readonly InsuranceScheme[] = ["ucs", "sss", "csmbs", "private", "self_pay", "unknown"];
const NO_FLAGS: ProfileFlags = { anticoagulant: false, insulin: false, pacemaker: false, dialysis: false, pregnancy: false };
const DOB_MIN = new Date(1900, 0, 1);

/** Compact, language-neutral labels for the blood rows (symbols, not words). */
const ABO_LABEL: Record<BloodAbo, string> = { A: "A", B: "B", AB: "AB", O: "O", unknown: "?" };
const RH_LABEL: Record<BloodRh, string> = { pos: "Rh+", neg: "Rh−", unknown: "?" };

interface Form {
  firstNameTh: string;
  lastNameTh: string;
  nameEn: string;
  dob: string;
  sex: Sex;
  bloodAbo: BloodAbo;
  bloodRh: BloodRh;
  flags: ProfileFlags;
  insuranceScheme: InsuranceScheme;
  notes: string;
}

const EMPTY: Form = {
  firstNameTh: "", lastNameTh: "", nameEn: "", dob: "", sex: "unspecified",
  bloodAbo: "unknown", bloodRh: "unknown", flags: NO_FLAGS,
  insuranceScheme: "unknown", notes: "",
};

function fromProfile(p: ProfileDto): Form {
  return {
    firstNameTh: p.firstNameTh ?? "",
    lastNameTh: p.lastNameTh ?? "",
    nameEn: p.nameEn ?? "",
    dob: (p.dob ?? "").slice(0, 10),
    sex: p.sex ?? "unspecified",
    bloodAbo: p.bloodAbo ?? "unknown",
    bloodRh: p.bloodRh ?? "unknown",
    flags: { ...NO_FLAGS, ...(p.flags ?? {}) },
    insuranceScheme: p.insuranceScheme ?? "unknown",
    notes: p.notes ?? "",
  };
}

/** Narrow a SegmentedButtons value back to its enum. */
const pick = <T extends string>(allowed: readonly T[], v: string, fallback: T): T =>
  allowed.find((a) => a === v) ?? fallback;

type ListRoute = "/allergies" | "/conditions" | "/medications" | "/contacts";
/** These screens are brand new; Metro has not regenerated the typed-routes union yet, so the href is cast once here. */
const go = (pathname: ListRoute) => router.push(pathname);

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <TouchableRipple onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <View style={styles.switchRow}>
        <Text variant="bodyLarge" style={styles.switchLabel}>{label}</Text>
        <Switch value={value} onValueChange={onChange} />
      </View>
    </TouchableRipple>
  );
}

export default function Profile() {
  const { t } = useTranslation();
  const theme = useTheme();
  const profile = useQuery({ queryKey: ["profile"], queryFn: api.getProfile });
  const allergies = useQuery({ queryKey: ["allergies"], queryFn: api.listAllergies });
  const conditions = useQuery({ queryKey: ["conditions"], queryFn: api.listConditions });
  const medications = useQuery({ queryKey: ["medications"], queryFn: api.listMedications });
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: api.listContacts });

  const [form, setForm] = useState<Form>(EMPTY);
  const [msg, setMsg] = useState<string | null>(null);
  // Seed the form from the server exactly once; background refetches must not clobber typing.
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current || !profile.data) return;
    seeded.current = true;
    setForm(fromProfile(profile.data));
  }, [profile.data]);

  const patch = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));
  const setFlag = (k: keyof ProfileFlags, on: boolean) => setForm((f) => ({ ...f, flags: { ...f.flags, [k]: on } }));

  const save = useMutation({
    mutationFn: (f: Form) =>
      api.putProfile({
        firstNameTh: f.firstNameTh.trim() || undefined,
        lastNameTh: f.lastNameTh.trim() || undefined,
        nameEn: f.nameEn.trim() || undefined,
        dob: f.dob.trim() || undefined,
        sex: f.sex,
        bloodAbo: f.bloodAbo,
        bloodRh: f.bloodRh,
        // noKnownDrugAllergy is edited on the Allergies screen; omitting it leaves it unchanged.
        flags: f.flags,
        insuranceScheme: f.insuranceScheme,
        // Not edited here; resend it so the server default does not reset the user's choice.
        preferredLanguage: profile.data?.preferredLanguage ?? currentLang(),
        notes: f.notes.trim() || undefined,
      }),
    onSuccess: async () => {
      setMsg(t("profile.saved"));
      await invalidateAfterEdit("profile");
    },
    onError: (e) => setMsg(t(errorKey(e))),
  });

  const exists = profileExists(profile.data);

  if (profile.isPending) {
    return (
      <Screen scroll={false} style={styles.center}>
        <ActivityIndicator size="large" />
      </Screen>
    );
  }
  if (profile.isError && !profile.data) {
    // Never show an empty form on a failed load: saving it would wipe the real profile.
    return (
      <Screen>
        <Banner visible icon="alert-circle-outline" actions={[{ label: t("common.retry"), onPress: () => void profile.refetch() }]}>
          {t(errorKey(profile.error))}
        </Banner>
      </Screen>
    );
  }

  const countOf = (q: { data?: { length: number } }) =>
    q.data ? t("common.items", { count: q.data.length }) : t("common.loading");

  const lists = (
    <Section title={t("profile.lists")}>
      {!exists ? (
        <Text variant="bodyMedium" style={[styles.helper, { color: theme.colors.onSurfaceVariant }]}>{t("profile.saveFirst")}</Text>
      ) : null}
      <List.Item
        title={t("profile.manageAllergies")}
        description={countOf(allergies)}
        titleStyle={styles.itemTitle}
        left={(p) => <List.Icon {...p} icon="alert-octagon-outline" color={theme.colors.error} />}
        right={(p) => <List.Icon {...p} icon="chevron-right" />}
        onPress={() => go("/allergies")}
      />
      <Divider />
      <List.Item
        title={t("profile.manageConditions")}
        description={countOf(conditions)}
        titleStyle={styles.itemTitle}
        left={(p) => <List.Icon {...p} icon="heart-pulse" color={theme.colors.primary} />}
        right={(p) => <List.Icon {...p} icon="chevron-right" />}
        onPress={() => go("/conditions")}
      />
      <Divider />
      <List.Item
        title={t("profile.manageMedications")}
        description={countOf(medications)}
        titleStyle={styles.itemTitle}
        left={(p) => <List.Icon {...p} icon="pill" color={theme.colors.primary} />}
        right={(p) => <List.Icon {...p} icon="chevron-right" />}
        onPress={() => go("/medications")}
      />
      <Divider />
      <List.Item
        title={t("profile.manageContacts")}
        description={countOf(contacts)}
        titleStyle={styles.itemTitle}
        left={(p) => <List.Icon {...p} icon="phone-outline" color={theme.colors.primary} />}
        right={(p) => <List.Icon {...p} icon="chevron-right" />}
        onPress={() => go("/contacts")}
      />
    </Section>
  );

  const basics = (
    <>
      <Section title={t("profile.identity")}>
        <View style={styles.body}>
          <TextInput
            mode="outlined"
            label={t("profile.firstNameTh")}
            value={form.firstNameTh}
            onChangeText={(v) => patch({ firstNameTh: v })}
          />
          <TextInput
            mode="outlined"
            label={t("profile.lastNameTh")}
            value={form.lastNameTh}
            onChangeText={(v) => patch({ lastNameTh: v })}
          />
          <TextInput
            mode="outlined"
            label={t("profile.nameEn")}
            value={form.nameEn}
            onChangeText={(v) => patch({ nameEn: v })}
            autoCapitalize="words"
          />
          <DateField
            label={t("profile.dob")}
            value={form.dob}
            onChange={(iso) => patch({ dob: iso })}
            minimumDate={DOB_MIN}
            maximumDate={new Date()}
            clearable
          />
          <Text variant="labelLarge">{t("profile.sex")}</Text>
          <View style={styles.chips}>
            {SEXES.map((s) => {
              const selected = form.sex === s;
              return (
                <Chip
                  key={s}
                  selected={selected}
                  showSelectedCheck
                  mode={selected ? "flat" : "outlined"}
                  onPress={() => patch({ sex: s })}
                  textStyle={styles.chipText}
                >
                  {t(`profile.sexOptions.${s}`)}
                </Chip>
              );
            })}
          </View>
        </View>
      </Section>

      <Section title={t("profile.blood")}>
        <View style={styles.body}>
          <View style={styles.chips}>
            {ABO.map((a) => {
              const selected = form.bloodAbo === a;
              return (
                <Chip
                  key={a}
                  selected={selected}
                  showSelectedCheck
                  mode={selected ? "flat" : "outlined"}
                  onPress={() => patch({ bloodAbo: a })}
                  textStyle={styles.chipText}
                  accessibilityLabel={`${t("profile.blood")} ${ABO_LABEL[a]}`}
                >
                  {ABO_LABEL[a]}
                </Chip>
              );
            })}
          </View>
          <Text variant="labelLarge">{t("profile.rh")}</Text>
          <SegmentedButtons
            value={form.bloodRh}
            onValueChange={(v) => patch({ bloodRh: pick(RH, v, "unknown") })}
            buttons={RH.map((r) => ({ value: r, label: RH_LABEL[r] }))}
          />
        </View>
      </Section>

      <Section title={t("profile.flags")}>
        <Text variant="bodySmall" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>{t("profile.flagsHint")}</Text>
        {FLAGS.map((k) => (
          <View key={k}>
            <Divider />
            <SwitchRow label={t(`profile.flagOptions.${k}`)} value={form.flags[k]} onChange={(v) => setFlag(k, v)} />
          </View>
        ))}
      </Section>

      <Section title={t("profile.insurance")}>
        <View style={[styles.body, styles.chips]}>
          {INSURANCE.map((s) => {
            const selected = form.insuranceScheme === s;
            return (
              <Chip
                key={s}
                selected={selected}
                showSelectedCheck
                mode={selected ? "flat" : "outlined"}
                onPress={() => patch({ insuranceScheme: s })}
                textStyle={styles.chipText}
              >
                {t(`profile.insuranceOptions.${s}`)}
              </Chip>
            );
          })}
        </View>
      </Section>

      <Section title={t("profile.notes")}>
        <View style={styles.body}>
          <TextInput
            mode="outlined"
            multiline
            numberOfLines={4}
            placeholder={t("profile.notesHint")}
            value={form.notes}
            onChangeText={(v) => patch({ notes: v })}
            style={styles.notes}
          />
        </View>
      </Section>

      <Button
        mode="contained"
        icon="content-save-outline"
        onPress={() => save.mutate(form)}
        loading={save.isPending}
        disabled={save.isPending}
        contentStyle={styles.saveContent}
      >
        {t("common.save")}
      </Button>
    </>
  );

  return (
    <Screen>
      {exists ? lists : null}
      {basics}
      {exists ? null : lists}

      <Portal>
        <Snackbar visible={!!msg} onDismiss={() => setMsg(null)} duration={2500}>
          {msg ?? ""}
        </Snackbar>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  body: { padding: space.lg, gap: space.md },
  segLabel: { fontSize: 13 },
  hint: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
  helper: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xs },
  switchRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md,
    minHeight: 56, paddingHorizontal: space.lg, paddingVertical: space.sm,
  },
  switchLabel: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chipText: { fontSize: 16, lineHeight: 24, marginVertical: 10 },
  notes: { minHeight: 110 },
  itemTitle: { fontWeight: "600" },
  saveContent: { height: 52 },
});
