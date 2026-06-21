import { redirect } from "next/navigation";
import { NS } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function Page({
    searchParams
}: {
    searchParams: Promise<{ next?: string }>
}) {
    const nextPath = (await searchParams).next ?? "/account";  // If no next page supplied then go to the home page

    // If the user is already authenticated then skip this page
    if (await NS.hasSession()) redirect(nextPath);

    return <LoginForm nextPath={ nextPath }/>;
}

