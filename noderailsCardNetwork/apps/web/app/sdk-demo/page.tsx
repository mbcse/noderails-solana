import { redirect } from "next/navigation";

/** Legacy route: consolidated SDK playground lives at `/examples`. */
export default function SdkDemoRedirectPage() {
  redirect("/examples");
}
