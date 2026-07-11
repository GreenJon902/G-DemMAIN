import { describe, it } from "node:test";
import { RuleTester } from "eslint";
import { localPlugin } from "./local-plugin.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
    languageOptions: { ecmaVersion: 2022, sourceType: "module" }
});

ruleTester.run("no-direct-hisdoc-writes", localPlugin.rules["no-direct-hisdoc-writes"], {
    valid: [
        // Non-mutating method on a tracked table
        "prisma.hd_event.findMany();",
        // Mutating method on an untracked table
        "prisma.hd_untracked.create(data);",
        // Too shallow to match the `<anything>.<table>.<method>` shape
        "hd_event.create(data);",
        // Callee isn't a member expression at all
        "create(data);"
    ],
    invalid: [
        {
            code: "prisma.hd_event.create(data);",
            errors: [{ message: "Direct 'create' on 'hd_event' is not allowed here — use the gateway functions in com/lib/hisdoc/ so the change is recorded in hd_changelog." }]
        },
        {
            // Transaction-callback pattern — checked structurally, not by resolving what `tx` is
            code: "tx.hd_person.update(data);",
            errors: [{ message: "Direct 'update' on 'hd_person' is not allowed here — use the gateway functions in com/lib/hisdoc/ so the change is recorded in hd_changelog." }]
        },
        {
            code: "something.hd_changelog.upsert(data);",
            errors: [{ message: "Direct 'upsert' on 'hd_changelog' is not allowed here — use the gateway functions in com/lib/hisdoc/ so the change is recorded in hd_changelog." }]
        },
        {
            // Deeper access chains still match on the last two segments regardless of `a.b`
            code: "a.b.hd_event_tag.deleteMany();",
            errors: [{ message: "Direct 'deleteMany' on 'hd_event_tag' is not allowed here — use the gateway functions in com/lib/hisdoc/ so the change is recorded in hd_changelog." }]
        }
    ]
});
