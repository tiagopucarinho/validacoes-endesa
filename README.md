# App Validações ENDESA / INMARK

Esta aplicação corre localmente num computador/servidor e pode ser acedida por várias pessoas através da mesma rede.

## Como iniciar

1. Abrir uma janela de terminal nesta pasta.
2. Executar:

```powershell
"C:\Users\tiago.pucarinho\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.js
```

3. Abrir no navegador:

```text
http://127.0.0.1:8787
```

Para outros computadores na mesma rede, usar o IP do computador onde a aplicação está a correr:

```text
http://IP-DO-COMPUTADOR:8787
```

## Notas

- Os pedidos ficam guardados em `data/records.json`.
- Os ficheiros enviados ficam guardados em `uploads/`.
- As notificações estão preparadas como registo interno/simulação. Para envio real de e-mail é necessário configurar SMTP ou Microsoft Graph.
- Para uso em produção deve ser adicionada autenticação, HTTPS, cópias de segurança e regras RGPD.
