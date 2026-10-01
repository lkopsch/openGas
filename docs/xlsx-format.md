# Contrato de exportação XLSX — openGas

Formato `opengas.database`, versão `1`. A exportação inclui todos os perfis e um snapshot consistente das três tabelas. É uma transferência dos registros do banco, sem as preferências de tema do navegador. A primeira linha de cada aba contém nomes de campos; não mudar esses nomes durante a importação.

## Abas

| Aba | Conteúdo |
|---|---|
| metadata | Pares chave/valor: formato, versão, data da exportação e contagens por tabela |
| usuarios | Todos os campos da tabela usuarios |
| abastecimentos | Todos os campos da tabela abastecimentos, incluindo impostos e tanque_cheio |
| despesas | Todos os campos da tabela despesas, incluindo detalhes em JSON |
| campos_nulos | tabela, id e campo para cada valor SQL NULL |
| schema | Tipos SQLite e indicação de campos obrigatórios, chave primária e coluna gerada |

## Regras para o importador Android

1. Validar metadata.format e metadata.version, abas e campos antes de alterar o banco. Versão desconhecida deve ser rejeitada.
2. Ler IDs e user_id como texto; preservar os valores para manter relações entre perfis e registros.
3. Datas e timestamps são texto ISO, não datas Excel. Valores monetários, litros e km são células numéricas, sem R$ no conteúdo. tanque_cheio usa os inteiros 0 e 1.
4. Restaurar NULL somente quando a combinação tabela/id/campo estiver em campos_nulos. Célula vazia sem essa indicação representa texto vazio. Não converter zero em NULL.
5. Interpretar despesas.detalhes como JSON. Preservar chaves desconhecidas, incluindo texto OCR.
6. Importar usuarios primeiro; abastecimentos e despesas depois. Não inserir abastecimentos.valor_total: a coluna é gerada pelo SQLite a partir de litros e preço. Comparar o total recalculado com o exportado.
7. Validar números, datas, categorias, combustíveis, duplicação de IDs, chaves estrangeiras e contagens antes de concluir. Usar uma transação: qualquer falha desfaz a importação inteira.
8. Para banco de destino com dados, oferecer uma política explícita para IDs existentes (substituir/mesclar). Não duplicar registros silenciosamente.

O XLSX tem limite de 32.767 caracteres por célula. Se um campo exceder o limite, a exportação retorna erro, preservando o banco sem truncar o conteúdo.

O importador Android ainda deve ser implementado; este contrato e os testes de leitura do XLSX servem como referência.
