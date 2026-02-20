// ==========================================
// CONFIGURAÇÕES DO K-AUTH
// ==========================================
const CLIENT_ID = "spa-test"; // Cadastre esse ID no K-Auth
const REDIRECT_URI = "https://localhost:3015/callback"; // URL padrão do Vite
const KAUTH_FRONTEND_URL = "https://kauth.ripbr.com.br/auth/authorize";
const KAUTH_BACKEND_URL = "https://api-kauth.ripbr.com.br/auth/token";

const appDiv = document.getElementById("app");

// ==========================================
// FUNÇÕES CRIPTOGRÁFICAS (Web Crypto API)
// ==========================================
function generateRandomString(length = 43) {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array, (dec) => ("0" + dec.toString(16)).padStart(2, "0"))
    .join("")
    .substring(0, length);
}

async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ==========================================
// LÓGICA PRINCIPAL (ROTEAMENTO SPA)
// ==========================================
async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  const error = urlParams.get("error");

  // Cenário 1: Erro no login
  if (error) {
    appDiv.innerHTML = `<h1>Erro: ${error}</h1><button id="loginBtn">Tentar Novamente</button>`;
    document.getElementById("loginBtn").addEventListener("click", login);
    return;
  }

  // Cenário 2: Retornou do K-Auth com o Authorization Code
  if (code) {
    appDiv.innerHTML = `<h1>Trocando código por token... ⏳</h1>`;
    await exchangeCodeForToken(code);
    return;
  }

  // Cenário 3: Já tem token salvo (Usuário logado)
  const savedTokens = sessionStorage.getItem("kauth_tokens");
  if (savedTokens) {
    renderDashboard(JSON.parse(savedTokens));
    return;
  }

  // Cenário 4: Não logado
  appDiv.innerHTML = `
    <h1>K-Auth Demo (SPA)</h1>
    <p>Exemplo de login 100% Client-Side sem backend.</p>
    <button id="loginBtn">Entrar com K-Auth</button>
  `;
  document.getElementById("loginBtn").addEventListener("click", login);
}

// ==========================================
// AÇÃO: INICIAR O LOGIN
// ==========================================
async function login() {
  const codeVerifier = generateRandomString();
  sessionStorage.setItem("pkce_verifier", codeVerifier);

  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const authUrl = new URL(KAUTH_FRONTEND_URL);
  authUrl.searchParams.append("client_id", CLIENT_ID);
  authUrl.searchParams.append("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.append("code_challenge", codeChallenge);
  authUrl.searchParams.append("code_challenge_method", "S256");

  window.location.href = authUrl.toString();
}

// ==========================================
// AÇÃO: TROCAR CÓDIGO POR TOKEN
// ==========================================
async function exchangeCodeForToken(code) {
  const codeVerifier = sessionStorage.getItem("pkce_verifier");

  if (!codeVerifier) {
    appDiv.innerHTML = `<h1>Erro</h1><p>Code Verifier não encontrado. O fluxo foi interrompido.</p>`;
    return;
  }

  try {
    const response = await fetch(KAUTH_BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        code: code,
        codeVerifier: codeVerifier,
      }),
    });

    const data = await response.json();

    if (!response.ok) throw new Error(JSON.stringify(data));

    sessionStorage.setItem("kauth_tokens", JSON.stringify(data.data));
    sessionStorage.removeItem("pkce_verifier"); // Limpa a chave temporária

    // Limpa a URL (tira o ?code=xxx) sem recarregar a página
    window.history.replaceState({}, document.title, window.location.pathname);

    renderDashboard(data.data);
  } catch (err) {
    appDiv.innerHTML = `<h1>Erro ao buscar Token</h1><pre>${err.message}</pre>`;
  }
}

// ==========================================
// AÇÃO: TELA LOGADA E LOGOUT
// ==========================================
function renderDashboard(tokens) {
  appDiv.innerHTML = `
    <h2>Autenticado com Sucesso! ✅</h2>
    <p>O seu navegador se comunicou diretamente com o K-Auth.</p>
    <pre>${JSON.stringify(tokens, null, 2)}</pre>
    <button class="btn-danger" id="logoutBtn">Sair (Limpar Sessão)</button>
  `;

  document.getElementById("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("kauth_tokens");
    // Para um logout real (SSO), redirecionamos para o K-Auth
    window.location.href = `https://kauth.ripbr.com.br/logout?redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  });
}

// Inicia a aplicação
init();
