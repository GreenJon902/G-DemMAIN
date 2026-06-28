import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tailwind from "eslint-plugin-tailwindcss";

// Enforces that any @g/nxt file importing @g/com is guarded with `import "server-only"` or
// `"use server"`, preventing @g/com (DB, auth, secrets) from leaking into the client bundle —
// both directly and transitively.
//
// Exemptions (neither guard is required):
//   - import type { ... }       — erased at compile time, no runtime code included
//   - @g/com/lib/authConstants  — intentionally client-safe constants, contains no server code
const localPlugin = {
    rules: {
        "require-server-only-for-com": {
            meta: { type: "problem", schema: [] },
            create(context) {
                let hasGuard = false;  // true if file has `import "server-only"` or `"use server"`
                const comImports = [];
                return {
                    Program(node) {
                        // Check for "use server" directive (must appear before any other statements)
                        for (const stmt of node.body) {
                            if (stmt.type === "ExpressionStatement" && stmt.expression.type === "Literal") {
                                if (stmt.expression.value === "use server") { hasGuard = true; }
                            } else break;
                        }
                    },
                    ImportDeclaration(node) {
                        // Check for use of `import "server-only"`
                        if (node.source.value === "server-only" && node.specifiers.length === 0) {
                            hasGuard = true;
                        }
                        // Check if file imports a from @g/com (with some exclusions)
                        if (node.importKind !== "type"
                            && node.source.value.startsWith("@g/com/")
                            && node.source.value !== "@g/com/lib/authConstants") {
                            comImports.push(node);
                        }
                    },
                    "Program:exit"() {
                        if (comImports.length > 0 && !hasGuard) {
                            context.report({ node: comImports[0], message: "Files importing from @g/com must have `import \"server-only\"` or `\"use server\"` to prevent accidental client bundling." });
                        }
                    }
                };
            }
        }
    }
};

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
