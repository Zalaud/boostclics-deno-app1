import { serve } from "https://deno.land/std@0.140.0/http/server.ts";
import { NhostClient } from 'https://esm.sh/@nhost/nhost-js@3';
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts';

// --- CONFIGURATION BACKEND ---
const subdomain = "jwtnrfwelqbdclayffhq";
const region = "eu-central-1";
const nhost = new NhostClient({ subdomain, region });

// On récupère les secrets
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const NHOST_ADMIN_SECRET = Deno.env.get("NHOST_ADMIN_SECRET")!;
// --- FIN CONFIGURATION ---

// ====================================================================
// ===== NOTRE INTERFACE FRONTEND (HTML + REACT) =====
// ====================================================================
const reactAppHtml = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BoostClicsBot</title>
    
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@nhost/nhost-js@3/dist/nhost.umd.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>

    <style>
      body { 
        font-family: system-ui, sans-serif;
        background-color: #1f2937;
        color: #f3f4f6;
      }
    </style>
</head>
<body>
    <div id="root"></div>

    <script type="text/babel">
      const { useState, useEffect } = React;
      
      function startApp() {
        const { NhostClient } = window.nhost;
        const nhost = new NhostClient({ subdomain: "${subdomain}", region: "${region}" });

        function App() {
            const [webApp, setWebApp] = useState(null);
            const [user, setUser] = useState(null);
            const [tasks, setTasks] = useState([]);
            const [loading, setLoading] = useState(true);
            const [error, setError] = useState(null);
            const [statusMessage, setStatusMessage] = useState("Initialisation...");

            useEffect(() => {
                const app = window.Telegram?.WebApp;
                if (!app || !app.initData) {
                    setError("Erreur: Contexte Telegram non valide.");
                    setLoading(false); return;
                }

                app.ready();
                app.expand();
                setWebApp(app);
                
                const initAndFetch = async () => {
                    try {
                        setStatusMessage("Authentification...");
                        const authResponse = await fetch('/api/auth-telegram', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ initData: app.initData })
                        });

                        const authData = await authResponse.json();
                        if (!authResponse.ok) {
                            throw new Error(authData.error || 'Échec de l\'authentification');
                        }

                        await nhost.auth.setSession(authData.session);
                        setUser(authData.user);

                        setStatusMessage("Chargement des tâches...");
                        const tasksResponse = await fetch('/api/get-tasks', {
                            headers: { 'Authorization': 'Bearer ' + nhost.auth.getAccessToken() }
                        });
                        
                        const tasksData = await tasksResponse.json();
                        if (!tasksResponse.ok) {
                            throw new Error(tasksData.error || 'Échec du chargement des tâches');
                        }
                        
                        setTasks(tasksData || []);
                        setStatusMessage("");

                    } catch (err) {
                        setError(err.message);
                    } finally {
                        setLoading(false);
                    }
                };
                initAndFetch();
            }, []);

            return (
              <div className="p-4 max-w-lg mx-auto">
                <h1 className="text-3xl font-bold text-blue-400 text-center">BoostClicsBot</h1>
                {webApp && <p className="mt-4 text-lg text-center">Bienvenue, <span className="font-bold text-yellow-300">{webApp.initDataUnsafe?.user?.first_name || 'Utilisateur'}</span> !</p>}
                <div className="mt-8 p-6 bg-gray-800 rounded-xl text-center">
                    <p className="text-xl text-gray-300">Mon Solde</p>
                    <p className="text-5xl font-bold mt-2">{user?.balance ?? 0} <span className="text-2xl text-gray-400">Points</span></p>
                </div>
                <div className="mt-8 text-left">
                    <h2 className="text-2xl font-semibold mb-4">Tâches Disponibles</h2>
                    <div className="space-y-4">
                        {loading && <p className="p-4 bg-gray-800 rounded-lg animate-pulse">{statusMessage}</p>}
                        {error && <p className="p-4 bg-red-500 text-white rounded-lg text-center">{error}</p>}
                        {!loading && !error && tasks.map(task => (
                            <div key={task.id} className="p-4 bg-gray-800 rounded-lg flex justify-between items-center">
                                <div><h3 className="font-bold text-lg text-white">{task.title}</h3><p className="text-sm text-gray-400">{task.description}</p></div>
                                <button className="bg-blue-500 text-white font-bold py-2 px-4 rounded-lg">+{task.reward}</button>
                            </div>
                        ))}
                        {!loading && !error && tasks.length === 0 && <p className="p-4 bg-gray-800 rounded-lg text-center">Aucune tâche pour le moment.</p>}
                    </div>
                </div>
              </div>
            );
        }

        const container = document.getElementById('root');
        const root = ReactDOM.createRoot(container);
        root.render(<App />);
      }

      const checkNhost = setInterval(() => {
        if (window.nhost && window.nhost.NhostClient) {
          clearInterval(checkNhost);
          startApp();
        }
      }, 50);
    </script>
</body>
</html>
`;

// ====================================================================
// ===== NOTRE SERVEUR BACKEND (API) =====
// ====================================================================
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // --- NOUVELLE ROUTE D'AUTHENTIFICATION ---
  if (url.pathname === "/api/auth-telegram") {
    try {
      const { initData } = await req.json();
      if (!initData) throw new Error('initData manquant');

      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      urlParams.delete('hash');
      const dataToCheck = Array.from(urlParams.entries())
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      
      const secretKey = createHmac('sha256', 'WebAppData').update(TELEGRAM_BOT_TOKEN).digest();
      const calculatedHash = createHmac('sha256', secretKey).update(dataToCheck).digest('hex');

      if (calculatedHash !== hash) {
        return new Response(JSON.stringify({ error: 'Validation échouée' }), { status: 401 });
      }

      const user = JSON.parse(urlParams.get('user') || '{}');
      const telegramUserId = user.id.toString();

      // Utilise la méthode "webhook" de Nhost pour créer/connecter l'utilisateur
      const { session } = await nhost.auth.signIn({ provider: 'webhook', providerUserId: telegramUserId });
      
      // On s'assure que le profil public existe (INSERT si nouveau, UPDATE si existant)
      const UPSERT_USER_PROFILE = `
        mutation UpsertUserProfile($user: users_insert_input!) {
          insert_users_one(
            object: $user,
            on_conflict: { constraint: users_pkey, update_columns: [] }
          ) { id, balance, display_name }
        }
      `;
      const { data } = await nhost.graphql.request(UPSERT_USER_PROFILE, 
        { user: { id: session.user.id, display_name: user.first_name } }, 
        { headers: { 'x-hasura-admin-secret': NHOST_ADMIN_SECRET } }
      );
      
      return new Response(JSON.stringify({ session, user: data.insert_users_one }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }

  // --- ROUTE POUR LIRE LES TÂCHES (maintenant authentifiée implicitement) ---
  if (url.pathname === "/api/get-tasks") {
    try {
      const GET_TASKS_QUERY = `query GetActiveTasks { tasks(where: {status: {_eq: "active"}}) { id, title, description, reward } }`;
      
      const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '');
      if (!accessToken) {
        // Nhost/Hasura par défaut n'autorise pas les requêtes non authentifiées (rôle 'public')
        // On doit donc vérifier si on a un token.
        // On pourrait aussi changer la permission sur Hasura pour autoriser le rôle 'public'.
        return new Response(JSON.stringify({ error: 'Authentification requise' }), { status: 401 });
      }

      const response = await nhost.graphql.request(GET_TASKS_QUERY, {}, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (response.error) throw new Error(response.error.errors[0].message);
      
      return new Response(JSON.stringify(response.data.tasks), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }

  // Pour toutes les autres URL, on renvoie la page React
  return new Response(reactAppHtml, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

console.log("Démarrage du serveur...");
Deno.serve(handler);
