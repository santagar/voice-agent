import { redirect } from "next/navigation";

export default function PlatformRootPage() {
  // For now, the main entrypoint of the backoffice redirects
  // to the Assistants view.
  redirect("/platform/assistants");
}

