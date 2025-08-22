import { serve } from "https://deno.land/std@0.140.0/http/server.ts";
import { NhostClient } from 'https://cdn.jsdelivr.net/npm/@nhost/nhost-js@3/+esm';

// --- CONFIGURATION ---
// On va chercher l'URL de Nhost dans les secrets de Deno Deploy
const NHOST_BACKEND_URL = Deno.env.get("NHOST_BACKEND_URL");
const nhost = new NhostClient({ backendUrl: NHOST_BACKEND_URL });
// --- FIN CONFIGURATION ---


// Le HTML de notre frontend (on le mettra à jour plus tard)
const htmlPage = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>BoostClicsBot - V2</title>
    <!-- On mettra React et tout le reste ici dans la prochaine étape -->
</head>
<body>
    <h1>Chargement de l'application...</h1>
    <p>Si vous voyez ceci, le déploiement a fonctionné.</p>
</body>
</html>
`;

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // --- ROUTEUR D'API ---
  // Si la requête est pour notre API de tâches
  if (url.pathname === "/api/get-tasks") {
    try {
      const GET_TASKS_QUERY = `
        query GetActiveTasks {
          tasks(where: {status: {_eq: "active"}}) {
            id
            title
            description
            reward
          }
        }
      `;
      const response = await nhost.graphql.request(GET_TASKS_QUERY);

      if (response.error) {
        throw new Error(response.error.errors[0].message);
      }

      return new Response(JSON.stringify(response.data.tasks), {
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Erreur API /get-tasks:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Pour toutes les autres URL, on renvoie la page HTML.
  return new Response(htmlPage, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

console.log("Démarrage du serveur...");
Deno.serve(handler);
