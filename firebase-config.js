/* =============================================
   DADO CRÍTICO — firebase-config.js
   Firestore + Auth
   ============================================= */

import { initializeApp }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, addDoc, collection } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "AIzaSyDpnITPmxQnPEcRXroWfHbt4xt4CYTFDU0",
  authDomain:        "dado-critico.firebaseapp.com",
  projectId:         "dado-critico",
  storageBucket:     "dado-critico.firebasestorage.app",
  messagingSenderId: "100190883244",
  appId:             "1:100190883244:web:ee6a67dd9120638d1a7e09"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

export { db, auth };

// Expõe para scripts não-modulares (script.js do formulário)
window.__dc_db         = db;
window.__dc_addDoc     = addDoc;
window.__dc_collection = collection;
