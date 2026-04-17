import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tailwind from "eslint-plugin-tailwindcss";

const eslintConfig = defineConfig([
    
    // Next:
    ...nextVitals,
    ...nextTs,
    globalIgnores([
        // Default ignores of eslint-config-next:
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts"
    ]),

    // Tailwind
    tailwind.configs["flat/recommended"],

    // Styling rules
    {
        rules: {
            semi: ["error", "always"],
            indent: ["warn", 4],
            "comma-dangle": ["warn", "never"],
            quotes: ["warn", "double", { avoidEscape: true }]
        }
    }
]);

export default eslintConfig;
