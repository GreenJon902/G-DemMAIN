import { z } from "zod";

const schema = z.object({
    action: z.enum(["add", "remove"]),
    uuid: z.uuid()
});

export async function POST(req: Request) {
    const body = await req.json();
    const result = schema.safeParse(body);

    // Check if validation was unsuccessful
    if (!result.success) {  
        return Response.json({
            error: "Validation failed",
            details: z.treeifyError(result.error)
        }, { status: 400 });
    }

    // Validation was unsuccessful so apply action and then respond to client
    const data = result.data;
    const actionSuccess = data.uuid.at(0) === "a";  // TODO: Do something with this
    if (actionSuccess) {
        return Response.json({
            message: "Action success"
        });
    } else {
        return Response.json({
            message: "Failed"
        }, { status: 500 });
    }
}
