import PlatformPeopleClientPage from "../Client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export default async function PeoplePage() {
  const session = await getServerSession(authOptions);

  const userEmail = session?.user?.email ?? "user@example.com";
  const userName = session?.user?.name ?? null;
  const userImage = (session?.user as any)?.image ?? null;

  return (
    <PlatformPeopleClientPage
      userEmail={userEmail}
      userName={userName}
      userImage={userImage}
    />
  );
}

