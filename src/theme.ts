import { createTheme } from "@mui/material";

// Quicksilver Email 2.0 Theme
// Brand Colors: #000000, #8D153A, #EB7400, #FFBE29, #00534E
const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#8D153A", // Teal - main brand color for buttons
      light: "#EB7400",
      dark: "#00534E",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#EB7400", // Orange - complementary color
      light: "#FF9A3D",
      dark: "#C55F00",
      contrastText: "#FFFFFF",
    },
    text: {
      primary: "#000000", // Pure black for maximum readability
      secondary: "#888888",
    },
    error: {
      main: "#8D153A", // Use burgundy for errors
    },
    warning: {
      main: "#EB7400", // Orange for warnings
    },
    success: {
      main: "#00534E", // Teal for success
    },
    info: {
      main: "#FFBE29", // Gold/yellow for info
    },
    divider: "#E0E0E0",
  },
  typography: {
    fontFamily: [
      '"Encode Sans"',
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      '"Helvetica Neue"',
      "Arial",
      "sans-serif",
    ].join(","),
  },
  shape: {
    borderRadius: 8, // Rounded corners for modern look
  },
});

export default theme;
