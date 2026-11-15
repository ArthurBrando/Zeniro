import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, set, onValue, update, remove, get, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

let userId = localStorage.getItem('zeniro_uid') || 'user_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('zeniro_uid', userId);

// --- ELEMENTOS GLOBAIS ---
const $ = id => document.getElementById(id);
let currentServerId = 'global';
let userProfile = { name: 'Usuário', avatar: '', banner: '', font: "'Inter', sans-serif", bio: '' };
let replyingTo = null;
let localStream = null;
let peerConnection = null;

// ==========================================
// 1. SIDEBAR E NAVEGAÇÃO MOBILE
// ==========================================
$('mobile-menu-btn').addEventListener('click', () => {
    $('server-sidebar').classList.add('open');
    $('channel-sidebar').classList.add('open');
    $('sidebar-backdrop').classList.remove('hidden');
    setTimeout(() => $('sidebar-backdrop').classList.add('show'), 10);
    $('mobile-menu-btn').classList.add('hide'); // Some com o botão
});

$('sidebar-backdrop').addEventListener('click', () => {
    $('server-sidebar').classList.remove('open');
    $('channel-sidebar').classList.remove('open');
    $('sidebar-backdrop').classList.remove('show');
    setTimeout(() => $('sidebar-backdrop').classList.add('hidden'), 300);
    $('mobile-menu-btn').classList.remove('hide'); // Volta o botão
});

// ==========================================
// 2. PERFIL (PREVIEW EM TEMPO REAL)
// ==========================================
window.updatePreview = () => {
    const name = $('edit-name').value || 'Seu Nome';
    const bio = $('edit-bio').value || 'Sua bio...';
    const font = $('edit-font').value;
    const avatar = $('edit-avatar-url').value || userProfile.avatar || 'zenirobg.png';
    const banner = $('edit-banner-url').value || userProfile.banner || '#5865F2';

    $('preview-name').innerText = name;
    $('preview-name').style.fontFamily = font;
    $('preview-bio').innerText = bio;
    $('preview-avatar').src = avatar;
    $('preview-banner').style.backgroundImage = banner.startsWith('http') || banner.startsWith('data:') ? `url(${banner})` : 'none';
    $('preview-banner').style.backgroundColor = banner.startsWith('#') ? banner : '#5865F2';
};

const userRef = ref(db, 'users/' + userId);
onValue(userRef, (snapshot) => {
    if (snapshot.exists()) {
        userProfile = snapshot.val();
        $('my-name').innerText = userProfile.name;
        $('my-name').style.fontFamily = userProfile.font;
        $('my-avatar').src = userProfile.avatar || 'zenirobg.png';
        
        // Preencher inputs
        $('edit-name').value = userProfile.name;
        $('edit-bio').value = userProfile.bio || '';
        $('edit-font').value = userProfile.font;
        $('edit-avatar-url').value = userProfile.avatar || '';
        $('edit-banner-url').value = userProfile.banner || '';
        updatePreview();
    } else {
        set(userRef, userProfile);
    }
});

$('edit-profile-btn').addEventListener('click', () => $('profile-modal').classList.remove('hidden'));
document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => $('profile-modal').classList.add('hidden')));

// Upload Base64 no Perfil
let newAvatarBase64 = null;
$('edit-avatar-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => { 
            newAvatarBase64 = ev.target.result; 
            $('preview-avatar').src = newAvatarBase64; 
        };
        reader.readAsDataURL(file);
    }
});

$('save-profile').addEventListener('click', () => {
    update(userRef, {
        name: $('edit-name').value,
        bio: $('edit-bio').value,
        font: $('edit-font').value,
        avatar: newAvatarBase64 || $('edit-avatar-url').value,
        banner: $('edit-banner-url').value
    });
    newAvatarBase64 = null;
    $('profile-modal').classList.add('hidden');
});

// ==========================================
// 3. SERVIDORES (LOCAIS E PÚBLICOS + BUSCA)
// ==========================================
const serversRef = ref(db, 'servers');
const serverList = $('server-list');

// Escutar apenas servidores que o usuário é membro
const userServersRef = ref(db, 'users/' + userId + '/servers');
onValue(userServersRef, (snapshot) => {
    const myServers = snapshot.val() || {};
    serverList.innerHTML = '';
    
    // Adiciona servidores
    for (const id in myServers) {
        if (myServers[id] === true) {
            get(ref(db, 'servers/' + id)).then(snap => {
                if (snap.exists()) {
                    const s = snap.val();
                    const div = document.createElement('div');
                    div.className = `server-icon ${currentServerId === id ? 'active' : ''}`;
                    div.innerHTML = `<span>${s.name.substring(0, 2).toUpperCase()}</span>`;
                    div.onclick = () => switchServer(id, s.name);
                    serverList.appendChild(div);
                }
            });
        }
    }
});

// Criar Servidor
$('create-server-btn').addEventListener('click', () => {
    const name = prompt("Nome do Servidor:");
    if (!name) return;
    const isPublic = confirm("Este servidor será Público? (OK = Sim, Cancelar = Privado)");
    
    const newRef = push(serversRef);
    const serverId = newRef.key;
    
    // Salva o servidor
    set(newRef, { name, owner: userId, isPublic });
    // Adiciona o usuário como membro
    set(ref(db, `users/${userId}/servers/${serverId}`), true);
    
    switchServer(serverId, name);
});

// Buscar Servidores Públicos
$('search-server-btn').addEventListener('click', () => $('search-server-modal').classList.remove('hidden'));
document.querySelector('.close-search-modal').addEventListener('click', () => $('search-server-modal').classList.add('hidden'));

$('search-server-input').addEventListener('input', async (e) => {
    const term = e.target.value.toLowerCase();
    if (term.length < 2) return $('search-results').innerHTML = '';
    
    $('search-results').innerHTML = 'Buscando...';
    const snapshot = await get(serversRef);
    $('search-results').innerHTML = '';
    
    if (snapshot.exists()) {
        const servers = snapshot.val();
        for (const id in servers) {
            const s = servers[id];
            if (s.isPublic && s.name.toLowerCase().includes(term)) {
                // Verifica se já é membro
                const memberSnap = await get(ref(db, `users/${userId}/servers/${id}`));
                const isMember = memberSnap.exists();

                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.innerHTML = `
                    <div>
                        <strong>${s.name}</strong>
                        <p>${s.isPublic ? 'Público' : 'Privado'}</p>
                    </div>
                    <button class="${isMember ? 'danger-btn' : 'primary-btn'}">${isMember ? 'Sair' : 'Entrar'}</button>
                `;
                div.querySelector('button').onclick = () => {
                    if (isMember) {
                        remove(ref(db, `users/${userId}/servers/${id}`));
                    } else {
                        set(ref(db, `users/${userId}/servers/${id}`), true);
                    }
                    $('search-server-modal').classList.add('hidden');
                    if (currentServerId === id && isMember) switchServer('global', 'Início');
                };
                $('search-results').appendChild(div);
            }
        }
    }
});

function switchServer(id, name) {
    currentServerId = id;
    $('current-server-name').innerText = name;
    $('edit-server-btn').classList.toggle('hidden', id === 'global');
    
    // Fecha menu mobile
    $('sidebar-backdrop').click();
    
    loadMessages();
}

// ==========================================
// 4. CHAT, EMOJIS, GIFS E RESPOSTAS
// ==========================================

// Emojis
const emojiData = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻','💀','☠️','👽','👾','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾'];
$('emoji-btn').addEventListener('click', () => {
    const list = $('emoji-list');
    if (list.innerHTML === '') {
        emojiData.forEach(e => {
            const span = document.createElement('span');
            span.innerText = e;
            span.onclick = () => { $('message-input').value += e; };
            list.appendChild(span);
        });
    }
    $('emoji-picker').classList.toggle('hidden');
    $('gif-picker').classList.add('hidden');
});

// API de GIFs (Tenor)
const TENOR_API_KEY = 'LIVDSRZULELA'; // Chave pública para testes
$('gif-btn').addEventListener('click', () => {
    $('gif-picker').classList.toggle('hidden');
    $('emoji-picker').classList.add('hidden');
});

$('gif-search').addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const query = e.target.value;
        const url = `https://tenor.googleapis.com/v2/search?q=${query}&key=${TENOR_API_KEY}&limit=12`;
        const res = await fetch(url);
        const data = await res.json();
        
        $('gif-list').innerHTML = '';
        data.results.forEach(gif => {
            const img = document.createElement('img');
            img.src = gif.media_formats.tinygif.url;
            img.onclick = () => sendMessage(gif.media_formats.gif.url, 'gif');
            $('gif-list').appendChild(img);
        });
    }
});

// Lógica de Upload de Imagem com Redimensionamento
$('plus-btn').addEventListener('click', () => $('image-upload').click());
$('image-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
            const canvas = $('resize-canvas');
            const ctx = canvas.getContext('2d');
            
            // Redimensiona para no máximo 800px
            let width = img.width;
            let height = img.height;
            const MAX_SIZE = 800;
            
            if (width > height && width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
            } else if (height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            // Comprime para JPEG com 70% de qualidade para não estourar o DB
            const base64Str = canvas.toDataURL('image/jpeg', 0.7);
            sendMessage(base64Str, 'image');
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
});

// LONG PRESS (Segurar para responder)
let pressTimer;
const contextMenu = $('context-menu');
let selectedMessageId = null;

function attachLongPress(element, msgId, senderName, msgText) {
    const startPress = (e) => {
        // Ignora se for scroll
        if (e.type === 'touchstart') {
            const touch = e.touches[0];
            element.dataset.startY = touch.clientY;
        }
        
        pressTimer = setTimeout(() => {
            // Previne o menu padrão do navegador
            if (e.type === 'touchstart') e.preventDefault(); 
            
            selectedMessageId = msgId;
            $('reply-name').innerText = senderName;
            $('reply-text').innerText = msgText;
            
            // Posicionar menu
            const rect = element.getBoundingClientRect();
            contextMenu.style.top = `${rect.top}px`;
            contextMenu.style.left = `${rect.left + 50}px`;
            contextMenu.classList.remove('hidden');
        }, 500);
    };

    const cancelPress = (e) => {
        if (e.type === 'touchmove') {
            const touch = e.touches[0];
            const startY = element.dataset.startY;
            if (Math.abs(touch.clientY - startY) > 10) clearTimeout(pressTimer); // Cancelou por scroll
        }
        clearTimeout(pressTimer);
    };

    element.addEventListener('mousedown', startPress);
    element.addEventListener('touchstart', startPress, {passive: false});
    element.addEventListener('mouseup', cancelPress);
    element.addEventListener('mouseleave', cancelPress);
    element.addEventListener('touchend', cancelPress);
    element.addEventListener('touchmove', cancelPress);
    element.addEventListener('contextmenu', (e) => e.preventDefault()); // Bloqueia menu nativo
}

$('ctx-reply').addEventListener('click', () => {
    replyingTo = selectedMessageId;
    $('reply-context').classList.remove('hidden');
    contextMenu.classList.add('hidden');
    $('message-input').focus();
});
$('cancel-reply').addEventListener('click', () => {
    replyingTo = null;
    $('reply-context').classList.add('hidden');
});

// Função de Enviar Mensagem
function sendMessage(content, type = 'text', replyData = null) {
    if (!content.trim() && type === 'text') return;
    
    push(ref(db, `messages/${currentServerId}/geral`), {
        userId, 
        name: userProfile.name, 
        avatar: userProfile.avatar || 'zenirobg.png', 
        font: userProfile.font, 
        text: type === 'text' ? content : '',
        media: type !== 'text' ? content : '',
        type: type,
        replyTo: replyingTo ? replyData : null,
        timestamp: Date.now()
    });
    
    $('message-input').value = '';
    $('emoji-picker').classList.add('hidden');
    $('gif-picker').classList.add('hidden');
    replyingTo = null;
    $('reply-context').classList.add('hidden');
}

$('send-btn').addEventListener('click', () => sendMessage($('message-input').value));
$('message-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage($('message-input').value); });

// Renderizar Mensagens
let loadedMessages = {};
function loadMessages() {
    $('messages-container').innerHTML = '<div class="empty-bg"><img src="zenirobg.png"></div>';
    const chatRef = ref(db, `messages/${currentServerId}/geral`);
    onChildAdded(chatRef, (snapshot) => {
        const data = snapshot.val();
        const msgId = snapshot.key;
        if (loadedMessages[msgId]) return; // Evita duplicação ao trocar de servidor
        loadedMessages[msgId] = true;

        const div = document.createElement('div');
        div.className = 'message';
        div.id = `msg-${msgId}`;
        
        let mediaHtml = '';
        if (data.type === 'image') {
            mediaHtml = `<img src="${data.media}" class="msg-image" onclick="openImage('${data.media}')">`;
        } else if (data.type === 'gif') {
            mediaHtml = `<img src="${data.media}" class="msg-image">`;
        }

        let replyHtml = '';
        if (data.replyTo) {
            replyHtml = `<div class="msg-reply-context">
                <strong>${data.replyTo.name}</strong>
                <div>${data.replyTo.text}</div>
            </div>`;
        }

        div.innerHTML = `
            <img class="avatar" src="${data.avatar}" alt="Avatar" onerror="this.src='zenirobg.png'">
            <div class="msg-content">
                <div class="msg-header">
                    <span style="font-family: ${data.font}">${data.name}</span>
                    <small>${new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
                </div>
                ${replyHtml}
                ${data.type === 'text' ? `<div class="msg-text">${data.text}</div>` : mediaHtml}
            </div>
        `;
        
        // Adiciona long press para responder
        attachLongPress(div, msgId, data.name, data.type === 'text' ? data.text : 'Imagem/GIF');

        $('messages-container').appendChild(div);
        $('messages-container').scrollTop = $('messages-container').scrollHeight;
    });
}

// Visualizador de Imagem Tela Cheia
window.openImage = (src) => {
    $('viewer-img').src = src;
    $('download-img-btn').href = src;
    $('image-viewer').classList.remove('hidden');
};

// ==========================================
// 5. WEBRTC E CONFIGURAÇÕES DE CHAMADA
// ==========================================
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

async function initCall(video = true) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
        $('local-video').srcObject = localStream;
        $('call-overlay').classList.remove('hidden');
        
        await populateDevices(); // Carrega lista de mics/cams

        peerConnection = new RTCPeerConnection(rtcConfig);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) push(ref(db, `calls/${currentServerId}/candidates`), event.candidate.toJSON());
        };

        peerConnection.ontrack = (event) => {
            $('remote-video').srcObject = event.streams[0];
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        set(ref(db, `calls/${currentServerId}/offer`), { offer, caller: userId });

    } catch (err) {
        alert("Erro ao acessar câmera/microfone: " + err.message);
    }
}

async function populateDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const micSelect = $('mic-select');
    const camSelect = $('camera-select');
    micSelect.innerHTML = ''; camSelect.innerHTML = '';

    devices.forEach(device => {
        if (device.kind === 'audioinput') {
            const opt = document.createElement('option');
            opt.value = device.deviceId; opt.text = device.label || 'Microfone Padrão';
            micSelect.appendChild(opt);
        }
        if (device.kind === 'videoinput') {
            const opt = document.createElement('option');
            opt.value = device.deviceId; opt.text = device.label || 'Câmera Padrão';
            camSelect.appendChild(opt);
        }
    });
}

// Configurações de Call UI
$('call-settings-btn').addEventListener('click', () => $('call-settings-panel').classList.toggle('hidden'));
$('close-call-settings').addEventListener('click', () => $('call-settings-panel').classList.add('hidden'));

// Receber Chamada
onValue(ref(db, `calls/${currentServerId}/offer`), async (snapshot) => {
    const data = snapshot.val();
    if (data && data.caller !== userId && !peerConnection) {
        $('call-overlay').classList.remove('hidden');
        peerConnection = new RTCPeerConnection(rtcConfig);
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) push(ref(db, `calls/${currentServerId}/candidates`), event.candidate.toJSON());
        };
        peerConnection.ontrack =
