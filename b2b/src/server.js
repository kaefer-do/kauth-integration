/**
 * K-Auth Demo — Servidor Express (Node.js)
 *
 * Demonstração do fluxo de autenticação OAuth 2.0 com PKCE usando o K-Auth.
 *
 * Fluxo geral:
 *   1. Usuário acessa /login
 *   2. Servidor gera o PKCE e redireciona para o K-Auth
 *   3. K-Auth autentica o usuário e redireciona de volta para /callback
 *   4. Servidor troca o "code" pelos tokens via chamada backend→backend
 *   5. Tokens ficam salvos na sessão do servidor (nunca expostos ao browser)
 *
 * Dependências:
 *   express         — framework HTTP
 *   express-session — armazenamento de sessão server-side
 *   crypto          — geração de valores aleatórios seguros (nativo do Node.js)
 */

const express = require("express");
const session = require("express-session");
const crypto = require("crypto");

// ==========================================
// CONFIGURAÇÕES
// ==========================================

const PORT = 3015;

/**
 * CLIENT_ID: Identificador da sua aplicação cadastrada no K-Auth.
 * Obtenha no painel do K-Auth ao registrar um novo cliente.
 */
const CLIENT_ID = "k-auth";

/**
 * REDIRECT_URI: URL para onde o K-Auth vai redirecionar após a autenticação.
 * IMPORTANTE: deve ser cadastrada EXATAMENTE igual no painel do K-Auth.
 */
const REDIRECT_URI = "https://test.dev.local/callback";

/**
 * KAUTH_FRONTEND_URL: URL da tela de login do K-Auth (acessada pelo browser do usuário).
 */
const KAUTH_FRONTEND_URL = "https://kauth.dev.local/auth/authorize";

/**
 * KAUTH_BACKEND_URL: URL da API do K-Auth para troca de tokens (chamada servidor→servidor).
 * Nunca é exposta ao browser.
 */
const KAUTH_BACKEND_URL = "https://api-kauth.dev.local/auth/token";

/**
 * KAUTH_REFRESH_URL: URL da API do K-Auth para renovação de tokens (chamada servidor→servidor).
 * Nunca é exposta ao browser.
 */
const KAUTH_REFRESH_URL = "https://api-kauth.dev.local/auth/refresh";

/**
 * KAUTH_REVOKE_URL: URL da API do K-Auth para revogar o refresh token (chamada servidor→servidor).
 * Usada no logout para invalidar o token na base de dados do K-Auth.
 */
const KAUTH_REVOKE_URL = "https://api-kauth.dev.local/auth/logout";

/**
 * KAUTH_LOGOUT_URL: URL da tela de logout do K-Auth (acessada pelo browser do usuário).
 * Limpa os cookies de SSO do K-Auth no navegador.
 */
const KAUTH_LOGOUT_URL = "https://kauth.dev.local/logout";

// ==========================================
// HELPERS
// ==========================================

/**
 * log(step, data)
 * Imprime no console um bloco formatado com o nome da etapa e os dados relevantes.
 * Útil para depurar o fluxo de autenticação em desenvolvimento.
 *
 * @param {string} step - Nome da etapa (ex: "PKCE Gerado", "Token recebido")
 * @param {any}    data - Objeto ou string com os dados a imprimir
 */
const log = (step, data) =>
  console.log(`\n[K-Auth] === ${step} ===\n`, data, "\n");

/**
 * page(title, body)
 * Gera uma página HTML completa com estilo consistente para todas as rotas.
 * Evita repetição de marcação e mantém o visual uniforme.
 *
 * @param {string} title - Título da aba do browser
 * @param {string} body  - Conteúdo HTML interno do card
 * @returns {string}     - HTML completo da página
 */
const page = (title, body) => `
<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title} - K-Auth Demo</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f0f2f5; margin: 0; padding: 40px 20px; color: #1a1a2e; }
  .card { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  h1 { margin-top: 0; }
  pre { background: #f6f8fa; padding: 16px; border-radius: 8px; white-space: pre-wrap; word-wrap: break-word; font-size: 13px; border: 1px solid #e1e4e8; overflow-x: auto; }
  .btn { display: inline-block; padding: 10px 20px; border-radius: 6px; text-decoration: none; color: #fff; font-weight: 500; margin-right: 10px; margin-top: 8px; transition: opacity .2s; }
  .btn:hover { opacity: 0.85; }
  .btn-primary { background: #0056b3; }
  .btn-success { background: #28a745; }
  .btn-danger { background: #dc3545; }
  .btn-login { background: #0056b3; font-size: 18px; padding: 14px 32px; }
  .tag { display: inline-block; background: #e6f7ff; color: #0056b3; padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-bottom: 12px; }
  .center { text-align: center; }
</style></head><body><div class="card">${body}</div></body></html>`;

// ==========================================
// CONFIGURAÇÃO DO EXPRESS
// ==========================================

const app = express();

/**
 * trust proxy: necessário para que req.secure funcione corretamente
 * quando a aplicação está atrás de um proxy reverso (nginx, traefik, etc.).
 */
app.set("trust proxy", 1);

/**
 * express-session: armazena dados entre requisições do mesmo usuário.
 * Usamos a sessão para guardar temporariamente o codeVerifier do PKCE
 * e os tokens após a autenticação.
 *
 * ATENÇÃO: em produção, substitua o store padrão (memória) por um
 * store persistente como connect-redis ou connect-pg-simple,
 * e use um secret forte via variável de ambiente.
 */
app.use(
  session({
    secret: "segredo-super-seguro-para-sessao-local",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true }, // secure: true é obrigatório com HTTPS
  }),
);

// ==========================================
// ROTA 1: HOME
// Exibe os tokens se o usuário estiver autenticado,
// ou um botão de login caso contrário.
// ==========================================
app.get("/", (req, res) => {
  if (req.session.tokens) {
    res.send(
      page(
        "Home",
        `
      <span class="tag">AUTENTICADO</span>
      <h1>Bem-vindo!</h1>
      <p>O login via K-Auth foi concluído. Abaixo estão os tokens salvos na sessão:</p>
      <pre>${JSON.stringify(req.session.tokens, null, 2)}</pre>
      <div>
        <a href="/refresh" class="btn btn-primary">🔄 Testar Refresh Token</a>
        <a href="/logout" class="btn btn-danger">Sair</a>
      </div>
    `,
      ),
    );
  } else {
    res.send(
      page(
        "Login",
        `
      <div class="center">
        <h1>K-Auth Demo</h1>
        <p>Aplicação de exemplo para testar o fluxo OAuth com PKCE.</p>
        <a href="/login" class="btn btn-login">Entrar com K-Auth →</a>
      </div>
    `,
      ),
    );
  }
});

// ==========================================
// ROTA 2: INICIAR LOGIN
// Gera o par PKCE (verifier + challenge) e redireciona o usuário
// para a tela de login do K-Auth.
//
// O PKCE (Proof Key for Code Exchange) protege o fluxo contra
// interceptação do authorization code. Funciona assim:
//   - codeVerifier: segredo aleatório gerado aqui e salvo na sessão
//   - codeChallenge: hash SHA-256 do verifier, enviado ao K-Auth
//   No callback, o K-Auth valida que o verifier bate com o challenge.
// ==========================================
app.get("/login", (req, res) => {
  // 1. Gera o Code Verifier — segredo aleatório mantido no servidor
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  req.session.codeVerifier = codeVerifier;

  // 2. Gera o Code Challenge — hash público do verifier, enviado na URL
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  log("PKCE Gerado", { codeVerifier, codeChallenge });

  // 3. Monta a URL de autorização do K-Auth com todos os parâmetros necessários
  const authUrl = new URL(KAUTH_FRONTEND_URL);
  authUrl.searchParams.append("client_id", CLIENT_ID);
  authUrl.searchParams.append("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.append("code_challenge", codeChallenge);
  authUrl.searchParams.append("code_challenge_method", "S256");

  // 4. Gera o "state" — valor aleatório para proteção contra ataques CSRF.
  //    Salvamos na sessão e verificamos no callback se o mesmo valor voltou.
  const state = crypto.randomBytes(16).toString("hex");
  req.session.state = state;
  authUrl.searchParams.append("state", state);

  // 5. Redireciona o usuário para a tela de login do K-Auth
  log("Redirecionando para K-Auth", { url: authUrl.toString() });
  res.redirect(authUrl.toString());
});

// ==========================================
// ROTA 3: CALLBACK
// Rota para onde o K-Auth redireciona o usuário após a autenticação.
// Recebe o "authorization code" e o troca pelos tokens via chamada
// direta do servidor ao K-Auth (nunca pelo browser).
// ==========================================
app.get("/callback", async (req, res) => {
  const { code, state, error } = req.query;
  log("Callback recebido", {
    code: code ? `${code.substring(0, 12)}...` : null,
    state,
    error: error || null,
  });

  // Se o K-Auth retornou um erro (ex: usuário cancelou o login)
  if (error) {
    return res
      .status(400)
      .send(
        page(
          "Erro",
          `<h1>❌ Erro no Login</h1><p>${error}</p><a href="/" class="btn btn-primary">Voltar</a>`,
        ),
      );
  }

  // Valida o "state" para garantir que a resposta veio do fluxo que iniciamos
  if (state !== req.session.state) {
    return res
      .status(400)
      .send(
        page(
          "Erro",
          `<h1>❌ State Inválido</h1><p>Possível ataque CSRF. O state recebido não confere com o da sessão.</p><a href="/" class="btn btn-primary">Voltar</a>`,
        ),
      );
  }

  try {
    // 6. Troca o authorization code pelo access token.
    //    Essa chamada é feita diretamente do servidor ao K-Auth (backend→backend),
    //    nunca pelo browser. O codeVerifier prova que somos quem iniciou o fluxo.
    const tokenBody = {
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      code: code,
      codeVerifier: req.session.codeVerifier, // Recuperado da sessão — prova do PKCE
    };
    log("Enviando para token exchange", {
      url: KAUTH_BACKEND_URL,
      body: tokenBody,
    });

    const response = await fetch(KAUTH_BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokenBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      log("Erro na troca de token", {
        status: response.status,
        error: errorData,
      });
      return res
        .status(response.status)
        .send(
          page(
            "Erro",
            `<h1>❌ Erro na Troca de Token</h1><pre>${JSON.stringify(errorData, null, 2)}</pre><a href="/" class="btn btn-primary">Voltar</a>`,
          ),
        );
    }

    const data = await response.json();
    log("Token recebido com sucesso", { keys: Object.keys(data.data || {}) });
    console.log(data.data);

    // 7. Salva os tokens na sessão do servidor.
    //    O K-Auth retorna o padrão: { status: "success", data: { accessToken, refreshToken, ... } }
    req.session.tokens = data.data;

    // 8. Remove os dados temporários do PKCE da sessão — não são mais necessários
    delete req.session.codeVerifier;
    delete req.session.state;

    res.redirect("/");
  } catch (err) {
    log("ERRO na chamada ao K-Auth", err.message);
    res
      .status(500)
      .send(
        page(
          "Erro",
          `<h1>❌ Erro Interno</h1><p>${err.message}</p><a href="/" class="btn btn-primary">Voltar</a>`,
        ),
      );
  }
});

// ==========================================
// ROTA 4: REFRESH TOKEN
// Usa o refreshToken salvo na sessão para obter um novo accessToken
// sem precisar que o usuário faça login novamente.
//
// NOTA: atualmente o endpoint do K-Auth lê o refreshToken via Cookie.
// Quando isso for corrigido no backend, basta trocar para enviar no body.
// ==========================================
app.get("/refresh", async (req, res) => {
  // Verifica se existe uma sessão ativa com refresh token disponível
  if (!req.session.tokens || !req.session.tokens.refreshToken) {
    return res
      .status(401)
      .send(
        page(
          "Erro",
          `<h1>⚠️ Sem Refresh Token</h1><p>Nenhum refresh token encontrado na sessão. Faça login primeiro.</p><a href="/" class="btn btn-primary">Voltar</a>`,
        ),
      );
  }

  try {
    log("Enviando refresh token", {
      refreshToken: `${req.session.tokens.refreshToken.substring(0, 20)}...`,
    });

    const response = await fetch(KAUTH_REFRESH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // TODO: o backend do K-Auth atualmente lê o refreshToken via Cookie.
        //       Quando for corrigido, remova o Cookie e descomente o body abaixo.
        Cookie: `refreshToken=${req.session.tokens.refreshToken}`,
      },
      // body: JSON.stringify({ refreshToken: req.session.tokens.refreshToken }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      log("Erro no refresh", { status: response.status, error: errorData });
      return res
        .status(response.status)
        .send(
          page(
            "Erro",
            `<h1>❌ Erro no Refresh</h1><pre>${JSON.stringify(errorData, null, 2)}</pre><a href="/" class="btn btn-primary">Voltar</a>`,
          ),
        );
    }

    const data = await response.json();
    log("Refresh concluído", { keys: Object.keys(data.data || {}) });

    // Atualiza a sessão com os novos tokens recebidos
    req.session.tokens = data.data;

    res.send(
      page(
        "Refresh",
        `
      <span class="tag">REFRESH OK</span>
      <h1>Token Atualizado!</h1>
      <p>Veja que a string do accessToken mudou:</p>
      <pre>${JSON.stringify(data.data, null, 2)}</pre>
      <div>
        <a href="/" class="btn btn-success">⬅️ Voltar para Home</a>
      </div>
    `,
      ),
    );
  } catch (err) {
    log("ERRO no refresh", err.message);
    res
      .status(500)
      .send(
        page(
          "Erro",
          `<h1>❌ Erro Interno</h1><p>${err.message}</p><a href="/" class="btn btn-primary">Voltar</a>`,
        ),
      );
  }
});

// ==========================================
// ROTA 5: LOGOUT
// 1. Revoga o refresh token no backend do K-Auth (invalida na base de dados)
// 2. Destrói a sessão local do Node.js
// 3. Redireciona o browser do usuário para o K-Auth limpar os cookies de SSO
// ==========================================
app.get("/logout", async (req, res) => {
  // 1. Revoga o refresh token no backend do K-Auth — invalida o token na base de dados
  //    A chamada é feita servidor→servidor, igual ao fluxo de refresh.
  if (req.session.tokens?.refreshToken) {
    try {
      log("Revogando refresh token", {
        refreshToken: `${req.session.tokens.refreshToken.substring(0, 20)}...`,
      });

      await fetch(KAUTH_REVOKE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `refreshToken=${req.session.tokens.refreshToken}`,
        },
        // body: JSON.stringify({ refreshToken: req.session.tokens.refreshToken }),
      });
    } catch (err) {
      log("AVISO: falha ao revogar token no K-Auth", err.message);
    }
  }

  // 2. Destrói a sessão local do Node.js
  req.session.destroy();

  // 3. Redireciona o browser do usuário para o K-Auth limpar os cookies de SSO.
  //    O redirect_uri informa ao K-Auth para onde devolver o usuário após o logout.
  res.redirect(
    `${KAUTH_LOGOUT_URL}?redirect_uri=${REDIRECT_URI.replace("/callback", "/")}`,
  );
});

// ==========================================
// INICIALIZAÇÃO DO SERVIDOR
// ==========================================
app.listen(PORT, () => {
  console.log(`\n[K-Auth] Servidor rodando em http://localhost:${PORT}\n`);
});
