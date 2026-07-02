import { describe, it } from "node:test";
import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { localPlugin } from "./local-plugin.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
    // The real rule only ever runs against .ts/.tsx files (see eslint.config.mjs), which is why
    // this needs the TS parser rather than plain espree — it's what lets `import type` parse.
    languageOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        parser: tsParser,
        parserOptions: { ecmaFeatures: { jsx: true } }
    }
});

const GUARD_MESSAGE = "Files importing from @g/com must have `import \"server-only\"` or `\"use server\"` to prevent accidental client bundling.";

ruleTester.run("require-server-only-for-com", localPlugin.rules["require-server-only-for-com"], {
    valid: [
        // No @g/com import at all
        "import { useState } from \"react\";",
        // Guarded with `import \"server-only\"`
        "import \"server-only\";\nimport { getUser } from \"@g/com/lib/user\";",
        // Guarded with the `\"use server\"` directive
        "\"use server\";\nimport { getUser } from \"@g/com/lib/user\";",
        // Type-only imports are erased at compile time, so no guard is needed
        "import type { User } from \"@g/com/lib/user\";",
        // authConstants is intentionally client-safe
        "import { SOME_CONSTANT } from \"@g/com/lib/authConstants\";",
        // Guard can come after the @g/com import — the check runs at Program:exit
        "import { getUser } from \"@g/com/lib/user\";\nimport \"server-only\";"
    ],
    invalid: [
        {
            code: "import { getUser } from \"@g/com/lib/user\";",
            errors: [{ message: GUARD_MESSAGE }]
        },
        {
            // `\"use server\"` only counts as a directive when it's the first statement
            code: "const x = 1;\n\"use server\";\nimport { getUser } from \"@g/com/lib/user\";",
            errors: [{ message: GUARD_MESSAGE }]
        },
        {
            // A same-named local string literal isn't `import \"server-only\"`
            code: "import serverOnly from \"not-server-only\";\nimport { getUser } from \"@g/com/lib/user\";",
            errors: [{ message: GUARD_MESSAGE }]
        }
    ]
});
