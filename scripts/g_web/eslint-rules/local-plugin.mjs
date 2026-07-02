// Tables whose rows are tracked in hd_changelog (see doc/Databases.md). Every write to one of
// these must go through com/lib/hisdoc/, which pairs it with a changelog row in the same
// transaction — this whitelist is what catches a write that forgot to do so.
export const HISDOC_TRACKED_TABLES = new Set([
    "hd_event", "hd_tag", "hd_person",
    "hd_event_tag", "hd_event_person", "hd_event_event_wri",
    "hd_changelog"
]);
export const HISDOC_MUTATING_METHODS = new Set([  // TODO: Change this to a whitelist rather than a blacklist
    "create", "createMany", "createManyAndReturn",
    "update", "updateMany", "updateManyAndReturn",
    "upsert", "delete", "deleteMany"
]);

export const localPlugin = {
    rules: {
        // Flags `<anything>.<trackedTable>.<mutatingMethod>(...)` outside com/lib/hisdoc/, regardless
        // of what `<anything>` resolves to (prisma(), a $transaction callback's tx, etc.) — this is a
        // structural check, not a type-aware one, so it also catches calls made through re-exports.
        "no-direct-hisdoc-writes": {
            meta: { type: "problem", schema: [] },
            create(context) {
                return {
                    CallExpression(node) {
                        const callee = node.callee;
                        if (callee.type !== "MemberExpression" || callee.property.type !== "Identifier") return;
                        if (!HISDOC_MUTATING_METHODS.has(callee.property.name)) return;

                        const table = callee.object;
                        if (table.type !== "MemberExpression" || table.property.type !== "Identifier") return;
                        if (!HISDOC_TRACKED_TABLES.has(table.property.name)) return;

                        context.report({
                            node,
                            message: `Direct '${callee.property.name}' on '${table.property.name}' is not allowed here — use the gateway functions in com/lib/hisdoc/ so the change is recorded in hd_changelog.`
                        });
                    }
                };
            }
        },
        // Enforces that any @g/nxt file importing @g/com is guarded with `import "server-only"` or
        // `"use server"`, preventing @g/com (DB, auth, secrets) from leaking into the client bundle —
        // both directly and transitively.
        //
        // Exemptions (neither guard is required):
        //   - import type { ... }       — erased at compile time, no runtime code included
        //   - @g/com/lib/authConstants  — intentionally client-safe constants, contains no server code
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
