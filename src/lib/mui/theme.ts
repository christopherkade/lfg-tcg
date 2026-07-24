import { createTheme } from "@mui/material/styles";

// Mirrors the app's existing Tailwind dark "zinc" palette + rounded-pill
// shapes so Material UI components blend in with the rest of the UI
// instead of looking like a bolted-on default Material theme.
export const theme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#09090b", // zinc-950
      paper: "#18181b", // zinc-900
    },
    text: {
      primary: "#fafafa", // zinc-50
      secondary: "#a1a1aa", // zinc-400
    },
    primary: {
      main: "#34D399", // emerald (the app's "active" pill / brand accent color)
      light: "#6EE7B7",
      dark: "#059669",
      contrastText: "#09090b",
    },
    divider: "#27272a", // zinc-800
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
            color: "#71717a", // zinc-500 (MUI's default disabled text is too faint on this dark bg)
          },
        },
        contained: {
          "&.Mui-disabled": {
            backgroundColor: "#27272a", // zinc-800
            color: "#71717a", // zinc-500
          },
        },
        outlined: {
          "&.Mui-disabled": {
            borderColor: "#3f3f46", // zinc-700
            color: "#71717a", // zinc-500
          },
        },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          borderRadius: 9999,
          backgroundColor: "#18181b",
          border: "1px solid #27272a",
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
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 9999,
          border: 0,
          fontWeight: 500,
          color: "#d4d4d8",
          "&.Mui-selected": {
            backgroundColor: "#34D399",
            color: "#09090b",
          },
          "&.Mui-selected:hover": {
            backgroundColor: "#6EE7B7",
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: "#18181b",
          "& fieldset": {
            borderColor: "#27272a",
          },
          "&:hover fieldset": {
            borderColor: "#3f3f46",
          },
          "&.Mui-focused fieldset": {
            borderColor: "#34D399",
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: "#a1a1aa",
        },
      },
    },
  },
});
