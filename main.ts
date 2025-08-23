import { serve } from "https://deno.land/std@0.140.0/http/server.ts";
import { NhostClient } from 'https://esm.sh/@nhost/nhost-js@3';

// --- CONFIGURATION ---
const NHOST_BACKEND_URL = Deno.env.get("NHOST_BACKEND_URL")!;
const nhost = new NhostClient({ backendUrl: NHOST_BACKEND_URL });
// --- FIN CONFIGURATION ---


// ===== NOTRE INTERFACE REACT COMPLÈTE =====
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
      const NHOST_BACKEND_URL = "${NHOST_BACKEND_URL}";
      
      const { useState, useEffect } = React;
      const { NhostClient } = window.NhostJs; // Le nom est NhostJs quand chargé comme ça
      const nhost = new NhostClient({ backendUrl: NHOST_BACKEND_URL });

      function App() {
          const [webApp, setWebApp] = useState(null);
          const [tasks, setTasks] = useState([]);
          const [loading, setLoading] = useState(true);
          const [error, setError] = useState(null);
          
          useEffect(() => {
              const app = window.Telegram?.WebApp;
              app.ready();
              app.expand();
              setWebApp(app);
              
              async function fetchData() {
                  try {
                      const response = await fetch('/api/get-tasks');
                      if (!response.ok) {
                          throw new Error('La réponse du réseau n\'était pas bonne.');
                      }
                      const data = await response.json();
                      setTasks(data || []);
                  } catch (err) {
                      setError(err.message);
                  } finally {
                      setLoading(false);
                  }
              }
              fetchData();
          }, []);

          return (
            <div className="p-4 max-w-lg mx-auto">
              <h1 className="text-3xl font-bold text-blue-400 text-center">BoostClicsBot</h1>
              {webApp && <p className="mt-4 text-lg text-center">Bienvenue, <span className="font-bold">{webApp.initDataUnsafe?.user?.first_name || 'Utilisateur'}</span> !</p>}
              <div className="mt-8 p-6 bg-gray-800 rounded-xl text-center">
                  <p className="text-xl text-gray-300">Mon Solde</p>
                  <p className="text-5xl font-bold mt-2">0 <span className="text-2xl text-gray-400">Points</span></p>
              </div>
              <div className="mt-8 text-left">
                  <h2 className="text-2xl font-semibold mb-4">Tâches Disponibles</h2>
                  <div className="space-y-4">
                      {loading && <p className="p-4 bg-gray-800 rounded-lg animate-pulse">Chargement...</p>}
                      {error && <p className="p-4 bg-red-500 text-white rounded-lg">{error}</p>}
                      {!loading && !error && tasks.map(task => (
                          <div key={task.id} className="p-4 bg-gray-800 rounded-lg flex justify-between items-center">
                              <div>
                                  <h3 className="font-bold text-lg">{task.title}</h3>
                                  <p className="text-sm text-gray-400">{task.description}</p>
                              </div>
                              <button className="bg-blue-500 text-white font-bold py-2 px-4 rounded-lg">+{task.reward}</button>
                          </div>
                      ))}
                      {!loading && !error && tasks.length === 0 && <p className="p-4 bg-gray-800 rounded-lg text-center">Aucune tâche.</p>}
                  </div>
              </div>
            </div>
          );
      }

      const container = document.getElementById('root');
      const root = ReactDOM.createRoot(container);
      root.render(<App />);
    </script>
</body>
</html>
`;

// ===== NOTRE SERVEUR BACKEND =====
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

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
      if (response.error) throw new Error(response.error.errors[0].message);
      return new Response(JSON.stringify(response.data.tasks), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Pour toutes les autres URL, on renvoie la page React
  return new Response(reactAppHtml, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

console.log("Démarrage du serveur...");
Deno.serve(handler);
