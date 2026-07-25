import { createTheme, type PaletteMode } from "@mui/material/styles";

// Mirrors the app's existing Tailwind "zinc" palette + rounded-pill shapes so
// Material UI components blend in with the rest of the UI instead of looking
// like a bolted-on default Material theme. Component overrides read palette
// tokens rather than hardcoding hex, so they automatically flip with `mode`.
export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      background: {
        default: isDark ? "#09090b" : "#fafafa", // zinc-950 / zinc-50
        paper: isDark ? "#18181b" : "#ffffff", // zinc-900 / white
      },
      text: {
        primary: isDark ? "#fafafa" : "#18181b", // zinc-50 / zinc-900
        secondary: isDark ? "#a1a1aa" : "#71717a", // zinc-400 / zinc-500
      },
      primary: {
        main: "#34D399", // emerald (the app's "active" pill / brand accent color)
        light: "#6EE7B7",
        dark: "#059669",
        contrastText: "#09090b",
      },
      divider: isDark ? "#27272a" : "#e4e4e7", // zinc-800 / zinc-200
      error: {
        main: "#f87171", // red-400
      },
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily: "inherit",
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            textTransform: "none",
            borderRadius: 9999,
            fontWeight: 500,
            "&.Mui-disabled": {
              color: isDark ? "#71717a" : "#a1a1aa", // zinc-500 (MUI's default disabled text is too faint against either bg)
            },
          },
          contained: {
            "&.Mui-disabled": {
              backgroundColor: isDark ? "#27272a" : "#e4e4e7", // zinc-800 / zinc-200
              color: isDark ? "#71717a" : "#a1a1aa",
            },
          },
          outlined: ({ theme }) => ({
            borderColor: theme.palette.divider,
            color: theme.palette.text.primary,
            "&:hover": {
              borderColor: isDark ? "#52525b" : "#d4d4d8",
            },
            "&.Mui-disabled": {
              borderColor: isDark ? "#3f3f46" : "#e4e4e7",
              color: isDark ? "#71717a" : "#a1a1aa",
            },
          }),
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 9999,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            padding: 4,
            gap: 4,
            // ToggleButtonGroup normally overlaps adjacent buttons by 1px
            // (negative margin + a transparent border) to render them as one
            // fused, seamless pill. This app always uses independent
            // pill/circle buttons with an explicit `gap` instead, so that
            // overlap just clips into each button's own rounded corner/border
            // — neutralize it everywhere.
            "& .MuiToggleButtonGroup-grouped": {
              marginLeft: "0px !important",
            },
          }),
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            textTransform: "none",
            borderRadius: 9999,
            border: 0,
            fontWeight: 500,
            // A touch lighter than text.secondary for legibility against a pill fill.
            color: theme.palette.mode === "dark" ? "#d4d4d8" : "#52525b",
            "&.Mui-selected": {
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
            },
            "&.Mui-selected:hover": {
              backgroundColor: theme.palette.primary.light,
            },
          }),
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 8,
            backgroundColor: theme.palette.background.paper,
            "& fieldset": {
              borderColor: theme.palette.divider,
            },
            "&:hover fieldset": {
              borderColor: isDark ? "#3f3f46" : "#d4d4d8",
            },
            "&.Mui-focused fieldset": {
              borderColor: theme.palette.primary.main,
            },
          }),
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: ({ theme }) => ({
            color: theme.palette.text.secondary,
          }),
        },
      },
    },
  });
}

