import { defaultConfig } from "tailwind-variants";

defaultConfig.twMergeConfig = {
  classGroups: {
    "font-size": [{ text: ["caption"] }],
  },
};

export { cn } from "tailwind-variants";
