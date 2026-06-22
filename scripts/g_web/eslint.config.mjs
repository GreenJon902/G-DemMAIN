import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tailwind from "eslint-plugin-tailwindcss";

const eslintConfig = defineConfig([
    
    // Next:
    ...nextVitals,
    ...nextTs,
    globalIgnores([
        "node_modules/**",
        "nxt/.next/**",
        "nxt/next-env.d.ts",
        "mcc/dist/**"

        
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
