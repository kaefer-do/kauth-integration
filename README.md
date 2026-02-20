# K-Auth Integration Guide

Este repositório é um guia prático de integração com o **K-Auth**, demonstrando dois fluxos diferentes de autenticação OAuth 2.0 com PKCE:

| Exemplo | Pasta | Stack | Onde ficam os tokens |
|---------|-------|-------|----------------------|
| Backend-to-Backend | `b2b/` | Node.js + Express | Sessão server-side (nunca expostos ao browser) |
| SPA (Client-Side) | `spa/` | Vanilla JS + Vite | `sessionStorage` do browser |

---

## Exemplos

### 1. Backend-to-Backend (`b2b/`)

Servidor Express que implementa o fluxo completo no backend:

1. Gera o par PKCE e redireciona o usuário para a tela de login do K-Auth.
2. Recebe o `authorization_code` no callback.
3. Troca o código pelo token via chamada **servidor → K-Auth** (nunca pelo browser).
4. Salva os tokens na sessão do servidor.
5. Suporta **refresh** e **revogação** do refresh token no logout.

> Os tokens nunca saem do servidor — ideal para aplicações que precisam de máxima segurança.

### 2. SPA Client-Side (`spa/`)

Aplicação Single Page Application que roda 100% no browser:

1. Gera o par PKCE no browser (Web Crypto API).
2. Redireciona o usuário para o K-Auth.
3. Recebe o `authorization_code` e envia diretamente ao K-Auth para troca de tokens.
4. Salva os tokens no `sessionStorage`.

> Mais simples de implantar, mas os tokens ficam expostos no browser — adequado para aplicações públicas sem backend próprio.

---

## Estrutura do Projeto

```
/ (root)
├── package.json    # scripts e workspaces (npm install único)
├── b2b/            # exemplo backend-to-backend (Express, porta 3014)
│   ├── package.json
│   └── src/
│       └── server.js
└── spa/            # exemplo SPA client-side (Vite, porta 3015)
    ├── package.json
    └── main.js
```

---

## Como testar

### Instalação única (raiz do projeto)

```bash
npm install
```

O comando instalará as dependências dos dois projetos automaticamente via [npm workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces).

### Rodar os exemplos

```bash
# Inicia o servidor backend-to-backend (http://localhost:3014)
npm run b2b

# Inicia a SPA client-side (https://localhost:3015)
npm run spa
```

### Rodar cada exemplo individualmente (alternativa)

```bash
cd b2b && npm run dev
cd spa && npm run dev
```

---

> **Observação:** Ajuste `CLIENT_ID`, `REDIRECT_URI` e as URLs do K-Auth (`KAUTH_FRONTEND_URL`, `KAUTH_BACKEND_URL` etc.) nos arquivos de configuração conforme o seu ambiente antes de rodar.

## Sobre o K-Auth

O K-Auth é uma plataforma de autenticação OAuth compatível com PKCE. Os exemplos aqui demonstram como iniciar o fluxo de autorização, trocar códigos por tokens e renovar/revogar tokens — tanto via backend-to-backend quanto diretamente pelo browser.

---

Sinta-se à vontade para explorar os dois exemplos e adaptar ao seu projeto.
