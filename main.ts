import { serve } from "https://deno.land/std@0.140.0/http/server.ts";

// Notre page HTML de test, très simple.
const htmlPage = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>BoostClicsBot - Test</title>
    <style>
        body { font-family: sans-serif; background-color: #222; color: white; text-align: center; padding-top: 50px; }
        button { padding: 10px 20px; font-size: 16px; cursor: pointer; }
        #response { margin-top: 20px; font-weight: bold; }
    </style>
</head>
<body>
    <h1>Bienvenue sur BoostClicsBot !</h1>
    <p>Plateforme : Deno Deploy</p>
    <button onclick="testApi()">Tester la connexion API</button>
    <p id="response"></p>

    <script>
        function testApi() {
            const responseDiv = document.getElementById('response');
            responseDiv.innerText = "Appel en cours...";
            fetch('/api/test')
                .then(res => res.json())
                .then(data => {
                    responseDiv.innerText = data.message;
                    responseDiv.style.color = 'lightgreen';
                })
                .catch(err => {
                    responseDiv.innerText = 'Erreur: ' + err;
                    responseDiv.style.color = 'red';
                });
        }
    </script>
</body>
</html>
`;

// Notre fonction serveur qui gère toutes les requêtes.
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Si quelqu'un appelle notre route d'API de test
  if (url.pathname === "/api/test") {
    const data = { message: "L'API backend fonctionne !" };
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  }
  
  // Pour toutes les autres URL, on renvoie la page HTML.
  return new Response(htmlPage, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// On démarre le serveur.
serve(handler);
