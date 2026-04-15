import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

const firebaseConfig = {
    databaseURL: "https://ambientedecor-adm-default-rtdb.firebaseio.com",
    apiKey: "AIzaSyCBl2FSqVoQvyIDVGgwamP3v_uHdgc4oxs",
    authDomain: "ambientedecor-adm.firebaseapp.com",
    projectId: "ambientedecor-adm",
    storageBucket: "ambientedecor-adm.firebasestorage.app",
    messagingSenderId: "419817961357",
    appId: "1:419817961357:web:939b4149d316fc3bc2afc4"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app, "https://ambientedecor-adm-default-rtdb.firebaseio.com/");
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { app, database, auth, provider, firebaseConfig };
