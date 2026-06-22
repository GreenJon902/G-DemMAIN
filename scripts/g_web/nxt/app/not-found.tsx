import AbstractErrorPage from "./ui/AbstractErrorPage";
import omegadestroy400 from "@/public/omegadestroy400.png";

export default function NotFound() {
    return (
        <AbstractErrorPage
            code="404"
            head={omegadestroy400}
        >
            This page could not be found.
        </AbstractErrorPage>
    );
}
