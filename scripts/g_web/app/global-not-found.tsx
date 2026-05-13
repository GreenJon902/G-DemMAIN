import "@/app/globals.css";
import AbstractErrorPage from "./(errors)/AbstractErrorPage";
import omegadestroy400 from "./(errors)/omegadestroy400.png";

// This is a global-not-found so that we can set the background 

export default function NotFound() {
    return (
        <AbstractErrorPage 
            code="404"
            text="This page could not be found."
            head={omegadestroy400}
        />
    );
}
