import { Platform, Pressable, StyleSheet, View } from "react-native";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { HelperText, TextInput } from "react-native-paper";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { formatDate, isValidIsoDate } from "../lib/format";

interface Props {
  label: string;
  /** ISO YYYY-MM-DD, or "" when empty. */
  value: string;
  onChange: (iso: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Show a clear icon when a date is set. */
  clearable?: boolean;
  error?: string | null;
  hint?: string;
  disabled?: boolean;
}

const ISO = "YYYY-MM-DD";
/** Width reserved on the right for the icon so the field-wide press target does not cover it. */
const ICON_WIDTH = 56;

/**
 * A date is picked, never typed: tapping the field opens the system date dialog
 * (Android DatePickerDialog), the value is stored as ISO and displayed in the
 * user's language (Thai Buddhist year or English) through formatDate.
 */
export function DateField({ label, value, onChange, minimumDate, maximumDate, clearable = false, error, hint, disabled = false }: Props) {
  const { t, i18n } = useTranslation();
  const valid = isValidIsoDate(value);

  const open = () => {
    if (disabled || Platform.OS !== "android") return;
    const initial = valid ? dayjs(value).toDate() : (maximumDate ?? new Date());
    DateTimePickerAndroid.open({
      value: initial,
      mode: "date",
      minimumDate,
      maximumDate,
      onChange: (event, date) => {
        if (event.type === "set" && date) onChange(dayjs(date).format(ISO));
      },
    });
  };

  const helper = error ?? hint;
  return (
    <View>
      <View>
        <TextInput
          mode="outlined"
          label={label}
          value={valid ? formatDate(value, i18n.language) : ""}
          placeholder={t("common.selectDate")}
          editable={false}
          disabled={disabled}
          error={!!error}
          left={<TextInput.Icon icon="calendar-month-outline" onPress={open} forceTextInputFocus={false} />}
          right={
            clearable && valid && !disabled ? (
              <TextInput.Icon icon="close-circle-outline" onPress={() => onChange("")} forceTextInputFocus={false} accessibilityLabel={t("common.clear")} />
            ) : undefined
          }
        />
        {/* The input is read-only; this overlay makes the whole field (minus the clear icon) open the picker. */}
        <Pressable
          onPress={open}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${valid ? formatDate(value, i18n.language) : t("common.selectDate")}`}
          style={[styles.overlay, clearable && valid ? styles.overlayWithClear : null]}
        />
      </View>
      {helper ? <HelperText type={error ? "error" : "info"} visible>{helper}</HelperText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  overlayWithClear: { right: ICON_WIDTH },
});
