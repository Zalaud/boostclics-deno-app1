import { serve } from "https://deno.land/std@0.140.0/http/server.ts";
import { NhostClient } from 'https://esm.sh/@nhost/nhost-js@3';
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts';

// --- CONFIGURATION ---
const subdomain = "jwtnrfwelqbdclayffhq";
const region = "eu-central-1";
const nhost = new NhostClient({ subdomain, region });
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const NHOST_ADMIN_SECRET = Deno.env.get("NHOST_ADMIN_SECRET")!;
// --- FIN CONFIGURATION ---

// --- HEADERS CORS ---
// On autorise explicitement l'URL de ton site Netlify et '*' pour les tests.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // 'https://boostclicsbot11.netlify.app'
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', // On ajoute OPTIONS
};
// --- FIN HEADERS CORS ---


async function handler(req: Request): Promise<Response> {
  // Gère la requête "preflight" CORS avant toute autre logique.
  // C'est la "demande de permission" du navigateur.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // --- ROUTE D'AUTHENTIFICATION ---
  if (url.pathname === "/api/auth-telegram") {
    try {
      const { initData } = await req.json();
      if (!initData) throw new Error('initData manquant');

      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      urlParams.delete('hash');
      const dataToCheck = Array.from(urlParams.entries()).sort(([keyA], [keyB]) => keyA.localeCompare(keyB)).map(([key, value]) => `${key}=${value}`).join('\n');
      const secretKey = createHmac('sha256', 'WebAppData').update(TELEGRAM_BOT_TOKEN).digest();
      const calculatedHash = createHmac('sha256', secretKey).update(dataToCheck).digest('hex');

      if (calculatedHash !== hash) {
        return new Response(JSON.stringify({ error: 'Validation échouée' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const user = JSON.parse(urlParams.get('user') || '{}');
      const { session } = await nhost.auth.signIn({ provider: 'webhook', providerUserId: user.id.toString() });
      const UPSERT_USER_PROFILE = `mutation UpsertUserProfile($user: users_insert_input!) { insert_users_one(object: $user, on_conflict: { constraint: users_pkey, update_columns: [] }) { id, balance, display_name } }`;
      const { data } = await nhost.graphql.request(UPSERT_USER_PROFILE, { user: { id: session.user.id, display_name: user.first_name } }, { headers: { 'x-hasura-admin-secret': NHOST_ADMIN_SECRET } });
      
      return new Response(JSON.stringify({ session, user: data.insert_users_one }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // --- ROUTE POUR LIRE LES TÂCHES ---
  if (url.pathname === "/api/get-tasks") {
    try {
        const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '');
        if (!accessToken) return new Response(JSON.stringify({ error: 'Authentification requise' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const GET_TASKS_QUERY = `query GetActiveTasks { tasks(where: {status: {_eq: "active"}}) { id, title, description, reward } }`;
        const response = await nhost.graphql.request(GET_TASKS_QUERY, {}, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        if (response.error) throw new Error(response.error.errors[0].message);
        return new Response(JSON.stringify(response.data.tasks), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // Si aucune route ne correspond, renvoyer une erreur 404
  return new Response(JSON.stringify({ error: "Route non trouvée" }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

console.log("Démarrage du serveur API...");
Deno.serve(handler);
