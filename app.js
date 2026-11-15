import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, set, onValue, update, remove, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

// ID de Usuário (Simulando Login)
let userId = localStorage.getItem('zeniro_uid');
if (!userId) {
    userId = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('zeniro_uid', userId);
}

// Elementos da UI
const myName = document.getElementById('my-name');
const myAvatar = document.getElementById('my-avatar');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const profileModal = document.getElementById('profile-modal');
const serverModal = document.getElementById('server-modal');
const serverNameInput = document.getElementById('server-name-input');
const serverList = document.getElementById('server-list');
const currentServerName = document.getElementById('current-server-name');

// Variáveis de Estado
let currentServerId = 'global';
let userProfile = { name: 'Usuário', avatar: 'https://via.placeholder.com/32', font: "'Inter', sans-serif", bio: '' };
let editingServerId = null;

// --- PERFIL ---
const userRef = ref(db, 'users/' + userId);
onValue(userRef, (snapshot) => {
    if (snapshot.exists()) {
        userProfile = snapshot.val();
        myName.innerText = userProfile.name;
        myName.style.fontFamily = userProfile.font;
        myAvatar.src = userProfile.avatar;
        // Preencher modal
        document.getElementById('edit-name').value = userProfile.name;
        document.getElementById('edit-bio').value = userProfile.bio || '';
        document.getElementById('edit-font').value = userProfile.font;
    } else {
        set(userRef, userProfile);
    }
});

document.getElementById('edit-profile-btn').addEventListener('click', () => profileModal.classList.remove('hidden'));
document.querySelector('.close-modal').addEventListener('click', () => profileModal.classList.add('hidden'));

// Converter Avatar para Base64
let newAvatarBase64 = null;
document.getElementById('edit-avatar').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => { newAvatarBase64 = event.target.result; };
        reader.readAsDataURL(file);
    }
});

document.getElementById('save-profile').addEventListener('click', () => {
    update(userRef, {
        name: document.getElementById('edit-name').value || userProfile.name,
        bio: document.getElementById('edit-bio').value,
        font: document.getElementById('edit-font').value,
        avatar: newAvatarBase64 || userProfile.avatar
    });
    newAvatarBase64 = null;
    profileModal.classList.add('hidden');
});

// --- SERVIDORES (CRUD) ---
const serversRef = ref(db, 'servers');
onValue(serversRef, (snapshot) => {
    serverList.innerHTML = '';
    if (snapshot.exists()) {
        const servers = snapshot.val();
        for (const id in servers) {
            const s = servers[id];
            // Só mostra se for dono ou público
            const div = document.createElement('div');
            div.className = `server-icon ${currentServerId === id ? 'active' : ''}`;
            div.innerHTML = `<span>${s.name.substring(0, 2).toUpperCase()}</span>`;
            div.onclick = () => switchServer(id, s.name);
            serverList.appendChild(div);
        }
    }
});

document.getElementById('create-server-btn').addEventListener('click', () => {
    editingServerId = null;
    document.getElementById('server-modal-title').innerText = 'Criar Servidor';
    serverNameInput.value = '';
    document.getElementById('delete-server-btn').classList.add('hidden');
    serverModal.classList.remove('hidden');
});

document.getElementById('edit-server-btn').addEventListener('click', () => {
    if (currentServerId === 'global') return;
    editingServerId = currentServerId;
    document.getElementById('server-modal-title').innerText = 'Editar Servidor';
    serverNameInput.value = currentServerName.innerText;
    document.getElementById('delete-server-btn').classList.remove('hidden');
    serverModal.classList.remove('hidden');
});

document.querySelector('.close-server-modal').addEventListener('click', () => serverModal.classList.add('hidden'));

document.getElementById('save-server-btn').addEventListener('click', () => {
    const name = serverNameInput.value.trim();
    if (!name) return;

    if (editingServerId) {
        update(ref(db, 'servers/' + editingServerId), { name });
    } else {
        const newRef = push(serversRef);
        set(newRef, { name, owner: userId });
    }
    serverModal.classList.add('hidden');
});

document.getElementById('delete-server-btn').addEventListener('click', () => {
    if (editingServerId) {
        remove(ref(db, 'servers/' + editingServerId));
        switchServer('global', 'Início');
        serverModal.classList.add('hidden');
    }
});

// Alternar Servidor
function switchServer(id, name) {
    currentServerId = id;
    currentServerName.innerText = name;
    document.getElementById('edit-server-btn').classList.toggle('hidden', id === 'global');
    
    // Atualizar ícones ativos
    document.querySelectorAll('.server-icon').forEach(el => el.classList.remove('active'));
    if (id === 'global') document.querySelector('[data-server="global"]').classList.add('active');
    
    loadMessages();
}

// --- CHAT ---
function loadMessages() {
    messagesContainer.innerHTML = '';
    const chatRef = ref(db, `messages/${currentServerId}/geral`);
    onChildAdded(chatRef, (snapshot) => {
        const data = snapshot.val();
        const div = document.createElement('div');
        div.className = 'message';
        div.innerHTML = `
            <img src="${data.avatar}" alt="Avatar">
            <div class="msg-content">
                <div class="msg-header">
                    <span style="font-family: ${data.font}">${data.name}</span>
                    <small>${new Date(data.timestamp).toLocaleTimeString()}</small>
                </div>
                <div class="msg-text">${data.text}</div>
            </div>
        `;
        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

document.getElementById('send-btn').addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;
    push(ref(db, `messages/${currentServerId}/geral`), {
        userId, name: userProfile.name, avatar: userProfile.avatar, font: userProfile.font, text, timestamp: Date.now()
    });
    messageInput.value = '';
}

// Inicialização do Chat
loadMessages();

// --- WEBRTC (CALL E VÍDEO) ---
let localStream;
let peerConnection;
const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Cria a conexão P2P
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(servers);
    
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            push(ref(db, `calls/${userId}/candidates`), event.candidate.toJSON());
        }
    };

    peerConnection.ontrack = (event) => {
        document.getElementById('remote-video').srcObject = event.streams[0];
        document.getElementById('video-call-container').classList.remove('hidden');
    };

    if (localStream) {
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    }
}

// Iniciar Chamada (Áudio/Vídeo)
async function startCall(video = false) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
        document.getElementById('local-video').srcObject = localStream;
        document.getElementById('video-call-container').classList.remove('hidden');
        
        createPeerConnection();

        // Cria a Oferta
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Envia a oferta para o Firebase (Neste exemplo, para a sala 'global')
        set(ref(db, `calls/global/offer`), { offer, caller: userId });
        
    } catch (err) {
        console.error("Erro ao acessar mídia:", err);
    }
}

// Escutar Ofertas (Para quem recebe a chamada)
onValue(ref(db, 'calls/global/offer'), async (snapshot) => {
    const data = snapshot.val();
    if (data && data.caller !== userId && !peerConnection) {
        createPeerConnection();
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        
        // Cria a Resposta
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        set(ref(db, `calls/global/answer`), { answer, answerer: userId });
        
        // Pega mídia do receptor
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        document.getElementById('local-video').srcObject = localStream;
        document.getElementById('video-call-container').classList.remove('hidden');
    }
});

// Escutar Respostas (Para quem iniciou a chamada)
onValue(ref(db, 'calls/global/answer'), async (snapshot) => {
    const data = snapshot.val();
    if (data && data.answerer !== userId && peerConnection && !peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
});

// Escutar ICE Candidates
onChildAdded(ref(db, `calls/${userId}/candidates`), async (snapshot) => {
    const candidate = snapshot.val();
    if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
});

// Botões de Chamada
document.getElementById('start-audio-call').addEventListener('click', () => startCall(false));
document.getElementById('start-video-call').addEventListener('click', () => startCall(true));

// Encerrar Chamada
document.getElementById('end-call').addEventListener('click', () => {
    if (peerConnection) peerConnection.close();
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    document.getElementById('video-call-container').classList.add('hidden');
    // Limpar do Firebase
    remove(ref(db, 'calls/global/offer'));
    remove(ref(db, 'calls/global/answer'));
    peerConnection = null;
});
