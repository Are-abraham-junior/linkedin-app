/**
 * app.js — Point d'entrée Phusion Passenger (cPanel)
 * 
 * Passenger charge ce fichier automatiquement.
 * Il importe le serveur Express compilé depuis dist/.
 */
import "dotenv/config";
import "./dist/server/src/index.js";
