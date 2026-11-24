# Caminhão-pipa: monitoramento do nível de 3 compartimentos (IoT)

Projeto integrador de IoT. Um caminhão-pipa com 3 compartimentos tem o nível de água medido por sensores ultrassônicos (HC-SR04) simulados no Wokwi. O objetivo é verificar se os níveis estão corretos e detectar vazamentos.

## Arquitetura (Opção B, HTTPS direto)

ESP32 + 3x HC-SR04 (Wokwi) → HTTPS POST → Supabase Edge Function `truck` → tabela `truck_readings` (Supabase) → painel no Cloudflare Pages, que consulta a função por GET.

## Funcionamento

- **Coleta:** a cada 10 s. Cada sensor faz 5 medições e o ESP32 usa a média.
- **Validação:** distâncias fora de 2 a 100 cm são descartadas.
- **Conversão:** tempo de eco (us) → distância (cm) → nível (%) = (100 − distância) / 100.
- **Alertas:** nível < 20% (baixo), > 95% (transbordo) e queda de 5 pontos ou mais entre duas leituras do mesmo compartimento (vazamento). O LED acende em qualquer alerta.
- **API:** `POST` recebe as leituras (exige o header `x-api-key`); `GET ?device_id=caminhao01` devolve a última leitura de cada compartimento e o histórico.
- **Painel:** caminhão em SVG com o nível de cada compartimento, estado, histórico e aviso de "Dados desatualizados" após 30 s sem leitura.

## Estrutura

```
supabase/schema.sql                      tabela truck_readings
supabase/functions/truck/index.ts        API REST (Edge Function)
wokwi/main.py, diagram.json              firmware MicroPython e circuito
wokwi/config.example.py                  modelo de configuração (sem segredos)
frontend/index.html, config.js           painel web
```

## Como reproduzir

1. **Supabase:** rode `supabase/schema.sql` no SQL Editor.
2. **Edge Function:** crie o segredo `INGEST_KEY`, crie a função `truck` com o conteúdo de `supabase/functions/truck/index.ts` e desligue **Verify JWT**.
3. **Wokwi:** novo projeto MicroPython ESP32. Cole `wokwi/main.py` e `wokwi/diagram.json` e crie `config.py` a partir de `config.example.py`, com a URL da função e a `INGEST_KEY`.
4. **Painel:** ajuste `frontend/config.js` com a URL da função e envie `index.html` e `config.js` (soltos, na raiz) no Cloudflare Pages por Direct Upload.

## Segredos

A `INGEST_KEY` e o `wokwi/config.py` real **não** estão no repositório (ver `.gitignore`). A tabela não tem políticas públicas: só a Edge Function acessa o banco.

## Links

- Painel publicado: https://caminhao-iot.pages.dev/
- Projeto no Wokwi: https://wokwi.com/projects/481524915525838849

## Integrantes

- NOME: ERICK FREITAS
