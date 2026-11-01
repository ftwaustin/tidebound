import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "tidebound";
export default defineRailway(() => {
  const tidebound = service("tidebound", {
    source: github("ftwaustin/tidebound", { branch: "main", checkSuites: true }),
    build: { buildEnvironment: "V3", dockerfilePath: "/Dockerfile" },
    healthcheck: "/health",
    healthcheckTimeout: 30,
    deploy: { restartPolicyMaxRetries: 3 },
    replicas: { "sfo": 1 },
  });

  return project("Tidebound", {
    variables: { managed: false },
    resources: [tidebound],
  });
});
