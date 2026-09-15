/**
 * app.js — Point d'entrée Phusion Passenger (cPanel)
 * 
 * Passenger charge ce fichier automatiquement.
 * Il importe d'abord env.js (chargement synchrone du .env absolu),
 * puis le serveur Express compilé depuis dist/.
 */
import "./env.js";
import "./dist/server/src/index.js";
