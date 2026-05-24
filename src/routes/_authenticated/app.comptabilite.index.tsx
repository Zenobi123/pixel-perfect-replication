import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/comptabilite/")({
  beforeLoad: () => {
    throw redirect({ to: "/app/comptabilite/ecritures" as never });
  },
});
