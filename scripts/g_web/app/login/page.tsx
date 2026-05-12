"use client";

import { createSessionAction } from "@/lib/auth";
import { redirect, useSearchParams } from "next/navigation";

export default function Page() {
    const searchParams = useSearchParams();

    // This is a testing login page.
    // TODO: IMplement this properly
    return (
        <>
            <button onClick={
                async () => {
                    await createSessionAction();
                    if (searchParams.has("next")){
                        redirect(searchParams.get("next") as string);
                    } else {
                        redirect("/");
                    }
                }
            } className="bg-green-700">LOG ME IN!</button>
        </>
    );
}
