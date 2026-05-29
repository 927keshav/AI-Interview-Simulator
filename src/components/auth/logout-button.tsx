import { LogOut } from "lucide-react";

import { logoutAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button size="sm" type="submit" variant="outline">
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Log out
      </Button>
    </form>
  );
}
