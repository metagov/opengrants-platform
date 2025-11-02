// theme.js
import { extendTheme } from "@chakra-ui/react";

// 1. Font setup
const fonts = {
  heading: `'Inter', sans-serif`,
  body: `'Inter', sans-serif`,
  mono: `'Menlo', monospace`,
};

// 2. Color palette based on your MINI Brand Kit
const colors = {
  brand: {
    50: "#ffe8f7",
    100: "#fbc2ec",
    200: "#f48bdd",
    300: "#eb54cc",
    400: "#e12bbd",
    500: "#c912a3", // Primary pink/purple core
    600: "#a00b83",
    700: "#780664",
    800: "#500345",
    900: "#2a0126",
  },
  accent: {
    100: "#c9f7f5",
    300: "#00cfc8",
    500: "#009e98",
    700: "#007872",
  },
  gray: {
    50: "#f9f9f9",
    100: "#f0f0f0",
    200: "#d9d9d9",
    300: "#bfbfbf",
    400: "#8c8c8c",
    500: "#595959",
    600: "#434343",
    700: "#262626",
    800: "#1f1f1f",
    900: "#141414",
  },
  black: "#16161D",
  white: "#FFFFFF",
};

// 3. Breakpoints
const breakpoints = {
  sm: "40em",
  md: "52em",
  lg: "64em",
  xl: "80em",
};

// 4. Semantic tokens for light/dark mode harmony
const semanticTokens = {
  colors: {
    text: {
      default: "#16161D",
      _dark: "#E4E4E4",
    },
    background: {
      default: "#FFFFFF",
      _dark: "#0D0D0D",
    },
    heroGradientStart: {
      default: "brand.700",
      _dark: "brand.200",
    },
    heroGradientEnd: {
      default: "brand.500",
      _dark: "brand.100",
    },
  },
  radii: {
    button: "12px",
  },
};

// 5. Global styles
const styles = {
  global: {
    "html, body": {
      fontFamily: `'Inter', sans-serif`,
      background: "background",
      color: "text",
      lineHeight: "1.6",
      scrollBehavior: "smooth",
    },
    a: {
      color: "brand.500",
      _hover: {
        textDecoration: "none",
        color: "brand.400",
      },
    },
    button: {
      borderRadius: "button",
      fontWeight: 600,
    },
  },
};

// 6. Final theme export
const theme = extendTheme({
  fonts,
  colors,
  breakpoints,
  semanticTokens,
  styles,
  components: {
    Button: {
      baseStyle: {
        borderRadius: "12px",
        fontWeight: "600",
      },
      variants: {
        solid: {
          bg: "brand.500",
          color: "white",
          _hover: { bg: "brand.400" },
          _active: { bg: "brand.600" },
        },
        outline: {
          borderColor: "brand.500",
          color: "brand.500",
          _hover: { bg: "brand.50" },
        },
      },
    },
  },
});

export default theme;
