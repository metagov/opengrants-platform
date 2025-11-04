import { extendTheme } from "@chakra-ui/react";

// 1. Font setup
const fonts = {
  heading: `'Inter', sans-serif`,
  body: `'Inter', sans-serif`,
  mono: `'Menlo', monospace`,
};

// 2. Brand Colors — based on your logo palette
const colors = {
  brand: {
    50: "#FDEBF1",
    100: "#F8C6D2",
    200: "#F18AA5",
    300: "#E94E78",
    400: "#D92052",
    500: "#800020", // Deep maroon — primary brand color
    600: "#640019",
    700: "#490013",
    800: "#2E000C",
    900: "#190005",
  },
  accent: {
    olive: "#8B9A46",
    teal: "#006E7F",
    purple: "#2A0055",
    cream: "#EEEEEE",
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

// 4. Semantic tokens for theme harmony
const semanticTokens = {
  colors: {
    text: {
      default: "#16161D",
      _dark: "#EEEEEE",
    },
    background: {
      default: "#FFFFFF",
      _dark: "#0D0D0D",
    },
    heroGradientStart: {
      default: "#800020",
      _dark: "#8B9A46",
    },
    heroGradientEnd: {
      default: "#2A0055",
      _dark: "#006E7F",
    },
    link: {
      default: "brand.500",
      _dark: "accent.cream",
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
      backgroundColor: "background",
      color: "text",
      lineHeight: "1.6",
      scrollBehavior: "smooth",
    },
    h1: {
      fontSize: ["4xl", "5xl", "6xl"],
      fontWeight: "700",
      color: "brand.500",
    },
    h2: {
      fontSize: ["2xl", "3xl"],
      fontWeight: "600",
      color: "brand.500",
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

// 6. Component styles (buttons, headings, etc.)
const components = {
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
      ghost: {
        color: "brand.500",
        _hover: { bg: "brand.50" },
      },
    },
  },
  Heading: {
    baseStyle: {
      fontFamily: "heading",
      color: "brand.500",
    },
  },
};

// 7. Export theme
const theme = extendTheme({
  fonts,
  colors,
  breakpoints,
  semanticTokens,
  styles,
  components,
});

export default theme;
