import { serve } from "https://deno.land/std@0.140.0/http/server.ts";
import { NhostClient } from 'https://esm.sh/@nhost/nhost-js@3';

// --- CONFIGURATION CORRIGÉE ---
const nhostBackendUrl = Deno.env.get("NHOST_BACKEND_URL");
// On extrait le sous-domaine de l'URL. Exemple : "jwtnrfwelqbdclayffhq"
const subdomain = new URL(nhostBackendUrl).hostname.split('.')[0];

const nhost = new NhostClient({ subdomain: subdomain, region: 'eu-central-1' });
// --- FIN DE LA CORRECTION ---


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
