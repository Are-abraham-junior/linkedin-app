// app.js — Point d'entrée Passenger (cPanel / LWS)
// Passenger cherche ce fichier comme point d'entrée de l'application Node.js

const { fork } = require("child_process");
const path = require("path");

// Charger les variables d'environnement
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Lancer le serveur TypeScript via tsx
const child = fork(
  path.join(__dirname, "node_modules", ".bin", "tsx"),
  [path.join(__dirname, "server", "src", "index.ts")],
  {
    env: { ...process.env },
    stdio: "inherit",
  }
);

child.on("error", (err) => {
  console.error("Erreur lancement serveur:", err);
  process.exit(1);
});

child.on("exit", (code) => {
  console.log(`Serveur arrêté avec le code: ${code}`);
  process.exit(code || 0);
});
