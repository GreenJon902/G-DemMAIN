import "@/app/globals.css";

import { ReactNode } from "react";
import { AbstractErrorPageWrapper } from "./AbstractErrorPage";

export default function Layout({
    children
}: {
    children: ReactNode
}) {
    return <AbstractErrorPageWrapper> { children } </AbstractErrorPageWrapper>; 
}
