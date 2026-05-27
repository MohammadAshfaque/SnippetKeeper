import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View
} from "react-native";
import { colors, spacing } from "../theme";

type Palette = typeof colors;

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  loading,
  palette
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  palette: Palette;
}) {
  const style = [
    styles.button,
    variant === "primary" && { backgroundColor: palette.primary, borderColor: palette.primary },
    variant === "secondary" && { backgroundColor: palette.panelAlt, borderColor: palette.border },
    variant === "danger" && { backgroundColor: palette.danger, borderColor: palette.danger },
    variant === "ghost" && { backgroundColor: "transparent", borderColor: "transparent" },
    disabled && { opacity: 0.55 }
  ];
  const textColor =
    variant === "primary" || variant === "danger" ? "#FFFFFF" : palette.ink;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [style, pressed && !disabled ? { opacity: 0.8 } : null]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon ? <Ionicons color={textColor} name={icon} size={18} /> : null}
          <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  palette,
  ...props
}: TextInputProps & { label: string; palette: Palette }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: palette.muted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={palette.muted}
        {...props}
        style={[
          styles.input,
          {
            backgroundColor: palette.panel,
            borderColor: palette.border,
            color: palette.ink
          },
          props.multiline ? styles.multiline : null,
          props.style
        ]}
      />
    </View>
  );
}

export function Tag({
  label,
  palette
}: {
  label: string;
  palette: Palette;
}) {
  return (
    <View style={[styles.tag, { backgroundColor: palette.tagBg }]}>
      <Text style={[styles.tagText, { color: palette.tagText }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  body,
  palette
}: {
  title: string;
  body: string;
  palette: Palette;
}) {
  return (
    <View style={[styles.empty, { borderColor: palette.border, backgroundColor: palette.panel }]}>
      <Text style={[styles.emptyTitle, { color: palette.ink }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: palette.muted }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700"
  },
  empty: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800"
  },
  field: {
    gap: spacing.sm
  },
  input: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  multiline: {
    minHeight: 132,
    textAlignVertical: "top"
  },
  tag: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  tagText: {
    fontSize: 12,
    fontWeight: "700"
  }
});
