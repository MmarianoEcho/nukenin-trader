# Nukenin Trader

Painel interno para uma equipe acompanhar o mercado de TCG a partir de fontes de catálogo e preços. A primeira fonte é a CardTrader, com conectores adicionais previstos para consolidar as referências de mercado.

## Language

**Fonte de mercado**:
Uma origem externa de catálogo, preços e métricas do mercado de TCG, normalizada pelo Nukenin Trader.
_Avoid_: API, fornecedor

**Marketplace**:
Fonte de mercado que exibe ofertas independentes de lojas ou pessoas para negociação.
_Avoid_: Loja, vitrine

**Oferta**:
Anúncio ativo de um SKU em um marketplace, com preço, quantidade e atributos de negociação quando fornecidos.
_Avoid_: Preço, produto

**Produto**:
Uma carta colecionável ou item selado negociável no mercado de TCG.
_Avoid_: Item, ativo

**SKU**:
Uma variante negociável de um produto, definida por condição, idioma e acabamento.
_Avoid_: Produto, carta

**SKU canônico**:
A identidade de comparação entre fontes, definida por jogo, coleção, número do colecionador, idioma, condição e acabamento.
_Avoid_: Correspondência por nome, produto genérico

**Watchlist**:
Conjunto persistente de produtos que a equipe escolheu acompanhar.
_Avoid_: Favoritos, lista de desejos

**Preço de mercado**:
O valor de referência fornecido por uma fonte de mercado, acompanhado de sua origem e liquidez quando disponíveis.
_Avoid_: Valor, cotação

**Preço normal**:
Referência calculada para comparar um SKU às ofertas ativas equivalentes em múltiplos marketplaces e ao seu histórico quando disponível.
_Avoid_: Preço justo, preço padrão

**Snapshot diário**:
Registro da mediana das ofertas equivalentes de um SKU canônico em um dia do mercado.
_Avoid_: Preço atual, cotação instantânea

**Queda diária**:
Redução percentual entre a mediana do dia atual e a mediana do dia anterior de um SKU canônico.
_Avoid_: Promoção, oscilação

**Alerta de queda**:
SKU canônico cuja queda diária supera 10%, listado da maior para a menor redução.
_Avoid_: Oportunidade garantida, recomendação de investimento

**Histórico compartilhado**:
Registro da equipe de produtos visualizados, Watchlist e snapshots diários, disponível a todos os membros autorizados.
_Avoid_: Cache do navegador, histórico pessoal

**Preço líquido**:
Valor econômico de uma oferta após descontar as taxas fornecidas pelo marketplace.
_Avoid_: Preço anunciado, faturamento

**Oportunidade**:
Produto cujo preço de mercado atual se distancia materialmente do preço normal conforme a regra de análise definida pela equipe.
_Avoid_: Promoção, arbitragem garantida

**Oportunidade de compra**:
SKU com preço líquido abaixo do preço normal e score de oportunidade suficiente para merecer acompanhamento.
_Avoid_: Sinal de venda, garantia de lucro

**Score de oportunidade**:
Indicador de confiança que combina o desvio do preço líquido contra a mediana, o número de ofertas e a liquidez disponível.
_Avoid_: Recomendação de investimento, garantia de lucro

**Oportunidade confirmada**:
Oportunidade de compra com score igual ou superior a 75; scores entre 45 e 74 ficam em observação.
_Avoid_: Sinal garantido, recomendação financeira

**Acesso da equipe**:
A única identidade autenticada compartilhada pela equipe para entrar no painel interno.
_Avoid_: Usuário final, conta individual
