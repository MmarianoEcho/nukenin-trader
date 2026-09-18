# Nukenin Trading Co.

Dashboard local para monitoramento de oportunidades no mercado de TCG.

## Executar localmente

Copie `.env.example` para `.env.local`, preencha o token completo do CardTrader e inicie o servidor:

```powershell
node server.mjs
```

## Acesso inicial

O protótipo contém uma única credencial local compartilhada. A senha não está gravada em texto puro no código; a autenticação é deliberadamente apenas local para esta fase e não substitui autenticação de produção.

## Dados

- CardTrader: token protegido no servidor local; somente endpoints de leitura para jogos, expansões, blueprints e ofertas do marketplace.
- MYP Cards: conector de referência brasileira por nome exato; ao configurar `MYP_API_TOKEN`, carrega preço mínimo, médio, máximo, estoque, imagem e link do produto. A fonte não disponibiliza vendedores individuais pela API documentada.

O painel lê somente dados da CardTrader nesta fase. A regra de normalização está em `docs/adr/0001-normalizacao-e-score-de-oportunidade.md`.
