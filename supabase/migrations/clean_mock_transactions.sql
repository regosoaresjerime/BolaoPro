-- Este script limpa as transações de teste criadas em modo de simulação (mock).
-- As transações mockadas começam com 'OR-' (ex: OR-1234567) geradas pelo Math.random().
-- Transações reais do PagBank também podem começar com 'ORDE_' ou outras variações.
-- Se houver certeza de que TODAS as transações atuais na base de dados são de testes, 
-- o script limpa a tabela de transações.

-- Limpa as transações simuladas pelo backend (mockadas)
DELETE FROM public.transactions 
WHERE pagbank_order_id LIKE 'OR-%' OR pagbank_order_id IS NULL;

-- Também limpa os picks (palpites) atrelados a transações pendentes ou de teste, se desejar:
-- (Opcional, descomente se quiser limpar os palpites de quem testou)
-- DELETE FROM public.user_picks WHERE ...
