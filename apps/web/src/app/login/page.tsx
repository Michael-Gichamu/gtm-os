import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">GTM-OS</CardTitle>
          <CardDescription>
            Outbound operating system for AI automation agencies. Sign in with the Google
            account you want to use as your operator identity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              Continue with Google
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">
            We only use your Google account to identify you. Sending permissions are granted
            separately in a later phase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
