# K-Auth Integration Guide

Este repositório serve como um guia de integração com o K-Auth, mostrando dois exemplos diferentes de uso:

1. **Backend to Backend (b2b)**
   - Demonstração de um servidor Node.js/Express que realiza o fluxo OAuth 2.0 com PKCE.
   - O código está na pasta `b2b`.

2. **SPA to Backend (spa)**
   - Exemplo de aplicação Single Page Application que consome um backend para autenticação via K-Auth.
   - O código está na pasta `spa`.

## Estrutura do Projeto

```
/ (root)
├── b2b/    # exemplo backend-to-backend (Express)
└── spa/    # exemplo SPA que conversa com backend
```

## Como testar

Em cada uma das pastas (`b2b` ou `spa`), basta executar os comandos:

```bash
npm install
npm run dev
```

Isso instalará as dependências e iniciará o servidor/cliente em modo de desenvolvimento.

> 📝 **Observação:** Ajuste as configurações (URLs, client_id etc.) conforme necessário para o seu ambiente K-Auth.

## Sobre o K-Auth

O K-Auth é uma plataforma de autenticação OAuth compatível com PKCE. Os exemplos aqui apresentados demonstram como iniciar o fluxo de autorização, trocar códigos por tokens e renovar/revogar tokens usando chamadas backend-to-backend, mantendo os tokens seguros no servidor.

---

Sinta-se à vontade para explorar os dois exemplos e adaptar ao seu projeto.
