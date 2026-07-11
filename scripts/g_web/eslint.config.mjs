import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tailwind from "eslint-plugin-tailwindcss";
import { localPlugin } from "./eslint-rules/local-plugin.mjs";

const eslintConfig = defineConfig([

    // Next:
    ...nextVitals,
    ...nextTs,
    globalIgnores([
        "node_modules/**",
        "nxt/.next/**",
        "nxt/next-env.d.ts",
        "mcc/dist/**",
        "com/dist/**",
        "com/generated/**"
    ]),

    // Tailwind
    ...tailwind.configs["flat/recommended"],
    {
        settings: {
            tailwindcss: {
                config: false  // We don't have a config file, so tell eslint that so it doesn't try to find it
            }
        }
    },

    // @g/com server-only boundary enforcement (nxt only)
    {
        files: ["nxt/**/*.ts", "nxt/**/*.tsx"],
        plugins: { local: localPlugin },
        rules: {
            "local/require-server-only-for-com": "error"
        }
    },

    // Hisdoc db changelog write enforcement — everywhere except com/lib/hisdoc/ itself, which is
    // the only place allowed to write directly to a tracked table
    {
        files: ["com/**/*.ts", "nxt/**/*.ts", "nxt/**/*.tsx", "mcc/**/*.ts"],
        ignores: ["com/lib/prisma/**", "com/generated/**"],
        plugins: { local: localPlugin },
        rules: {
            "local/no-direct-hisdoc-writes": "error"
        }
    },

    // Rule modifications
    {
        rules: {
            // Styling
            semi: ["error", "always"],
            indent: ["warn", 4],
            "comma-dangle": ["warn", "never"],
            quotes: ["warn", "double", { avoidEscape: true }],

            // Images
            "@next/next/no-img-element": "off",
            "jsx-a11y/alt-text": "off"
        }
    },

    // Folder setup stuff
    {
        settings: {
            next: {
                rootDir: "nxt"
            }
        }
    }
]);

export default eslintConfig;
