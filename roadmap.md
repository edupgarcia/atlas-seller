# Roadmap

- [x] Diagnosticar por que a tela de pedidos (vw_gross_profit_consolidated) não carrega dados do seller logado
- [ ] Bloqueado: substituir o valor do segredo `ATLAS_SUPABASE_SERVICE_ROLE` pela chave service_role real (hoje contém a chave anon, e a RLS esconde todos os pedidos)
- [ ] Bloqueado (no Supabase externo): revogar SELECT público na tabela `sellers` — hashes de senha estão legíveis com a chave pública
- [x] OAuth Amazon: app gera state assinado (HMAC) a partir da sessão; removido seller_id vindo do navegador
- [x] Criar ATLAS_OAUTH_STATE_SECRET (mesmo valor no app, na Vercel e nos secrets da amazon-auth)
- [x] amazon-auth v3 publicado no Supabase
- [ ] Bloqueado (usuário): autorizar uma vez na Amazon (Seller Central) para a função gravar amazon_seller_id
- [ ] Bloqueado (usuário): gerar nova client_secret no painel de desenvolvedor da Amazon (a anterior foi exposta no arquivo enviado) e atualizá-la na função amazon-auth
- [x] Remover o botão "Conectar Amazon" do rodapé do menu lateral (permanece em Configurações)
- [ ] Bloqueado (Temu): app Temu em aprovação; depois criar a função temu-auth com TEMU_APP_KEY, TEMU_APP_SECRET e ATLAS_OAUTH_STATE_SECRET
- [ ] Conferir os endereços oficiais da Temu (AUTH_URL / API) na documentação antes de confiar no fluxo atual
- [x] Mercado Livre: botão em Configurações + state assinado + código da função mercadolivre-auth
- [x] Mercado Livre: redirect URI configurado no app ML (3759065602842274) e função ml-oauth-callback criada com secrets
- [ ] Bloqueado (usuário): publicar ml-oauth-callback_v7.ts (redireciona para a página /conexao-concluida do Atlas) e publicar o app
- [ ] Controle de acesso e usuários (convite, status, beta/licensed, planos, admin, auditoria) — análise apresentada, aguardando aprovação e SQL no Supabase externo
