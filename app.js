import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, set, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Suas chaves do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyASxTiAzWJ3TNJ8OZLxNiNR85dbAl68t-U",
  authDomain: "zeniro.firebaseapp.com",
  databaseURL: "https://zeniro-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "zeniro",
  storageBucket: "zeniro.firebasestorage.app",
  messagingSenderId: "82254521841",
  appId: "1:82254521841:web:36a0726dd15fa3698a5050"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ID de usuário local (Para não precisar de login complexo agora)
// Em um projeto real, use Firebase Auth (Email/Senha ou Google)
let userId = localStorage.getItem('zeniro_user_id');
if (!userId) {
    userId = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('zeniro_user_id', userId);
}

// Elementos da UI
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const profileModal = document.getElementById('profile-modal');
const editProfileBtn = document.getElementById('edit-profile-btn');
const closeModal = document.getElementById('close-modal');
const saveProfileBtn = document.getElementById('save-profile');

let userAvatarBase64 = "https://via.placeholder.com/40";
let userFont = "'Roboto', sans-serif";
let userName = "Usuário Zeniro";

// --- SISTEMA DE CHAT ---
const messagesRef = ref(db, 'chats/geral');

// Escutar mensagens novas
onChildAdded(messagesRef, (snapshot) => {
    const data = snapshot.val();
    const div = document.createElement('div');
    div.classList.add('message');
    div.innerHTML = `
        <img src="${data.avatar}" alt="Avatar">
        <div class="message-content">
            <div class="message-header">
                <span style="font-family: ${data.font}">${data.name}</span>
                <small>${new Date(data.timestamp).toLocaleTimeString()}</small>
            </div>
            <div class="message-text">${data.text}</div>
        </div>
    `;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

// Enviar mensagem
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    push(messagesRef, {
        userId: userId,
        name: userName,
        avatar: userAvatarBase64,
        font: userFont,
        text: text,
        timestamp: Date.now()
    });

    messageInput.value = '';
}

// --- SISTEMA DE PERFIL ---
const userRef = ref(db, 'users/' + userId);

// Carregar perfil ao iniciar
onValue(userRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        userName = data.name || userName;
        userAvatarBase64 = data.avatar || userAvatarBase64;
        userFont = data.font || userFont;
        
        document.getElementById('my-name').innerText = userName;
        document.getElementById('my-name').style.fontFamily = userFont;
        document.getElementById('my-avatar').src = userAvatarBase64;
    } else {
        // Se não existir, cria perfil padrão
        set(userRef, {
            name: userName,
            avatar: userAvatarBase64,
            font: userFont,
            bio: "",
            link: ""
        });
    }
});

// Abrir Modal
editProfileBtn.addEventListener('click', () => profileModal.classList.remove('hidden'));
closeModal.addEventListener('click', () => profileModal.classList.add('hidden'));

// Converter imagem para Base64
document.getElementById('edit-avatar').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            userAvatarBase64 = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// Salvar Perfil
saveProfileBtn.addEventListener('click', () => {
    const newName = document.getElementById('edit-name').value || userName;
    const newBio = document.getElementById('edit-bio').value;
    const newLink = document.getElementById('edit-link').value;
    const newFont = document.getElementById('edit-font').value;

    set(userRef, {
        name: newName,
        avatar: userAvatarBase64,
        font: newFont,
        bio: newBio,
        link: newLink
    });

    profileModal.classList.add('hidden');
});
