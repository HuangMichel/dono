// Shared Dono design tokens for all mockups (load after the Tailwind CDN script).
// Colors: Radix UI Colors v3, light theme. Step roles follow the Radix usage guide:
// 1 app bg, 2 subtle bg, 3-5 component bg (normal/hover/active),
// 6 subtle border, 7 UI border, 8 strong border/focus,
// 9-10 solid bg (normal/hover), 11 low-contrast text, 12 high-contrast text.
// Amber 9 takes dark text (amber-12); grass, orange and red 9 take white text.
const radix = {
  sand: ["#fdfdfc", "#f9f9f8", "#f1f0ef", "#e9e8e6", "#e2e1de", "#dad9d6", "#cfceca", "#bcbbb5", "#8d8d86", "#82827c", "#63635e", "#21201c"],
  grass: ["#fbfefb", "#f5fbf5", "#e9f6e9", "#daf1db", "#c9e8ca", "#b2ddb5", "#94ce9a", "#65ba74", "#46a758", "#3e9b4f", "#2a7e3b", "#203c25"],
  amber: ["#fefdfb", "#fefbe9", "#fff7c2", "#ffee9c", "#fbe577", "#f3d673", "#e9c162", "#e2a336", "#ffc53d", "#ffba18", "#ab6400", "#4f3422"],
  orange: ["#fefcfb", "#fff7ed", "#ffefd6", "#ffdfb5", "#ffd19a", "#ffc182", "#f5ae73", "#ec9455", "#f76b15", "#ef5f00", "#cc4e00", "#582d1d"],
  red: ["#fffcfc", "#fff7f7", "#feebec", "#ffdbdc", "#ffcdce", "#fdbdbe", "#f4a9aa", "#eb8e90", "#e5484d", "#dc3e42", "#ce2c31", "#641723"],
};
const scale = (s) => Object.fromEntries(s.map((v, i) => [i + 1, v]));

tailwind.config = {
  theme: {
    extend: {
      colors: Object.fromEntries(Object.entries(radix).map(([k, v]) => [k, scale(v)])),
      fontFamily: { sans: ['"DM Sans"', "system-ui", "sans-serif"] },
      // Three type sizes per surface; 12px is the floor.
      fontSize: {
        meta: ["12px", "16px"],
        body: ["14px", "20px"],
        lead: ["16px", "24px"],
        title: ["24px", "30px"],
        "title-sm": ["20px", "28px"],
        display: ["44px", "48px"],
      },
      borderWidth: { hair: "0.5px" },
      transitionTimingFunction: { out: "cubic-bezier(0.16, 1, 0.3, 1)" },
      transitionDuration: { 250: "250ms" },
    },
  },
};
