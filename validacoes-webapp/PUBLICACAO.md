# Publicação permanente da app ENDESA / INMARK

A app já está preparada para correr num alojamento cloud e deixar de depender do computador local.

## Opção recomendada para primeira publicação: Azure App Service

### 1. Criar recursos no Azure

Criar um **App Service** para Node.js 20 ou superior.

Configuração sugerida:

- Runtime: Node.js 20+
- Sistema: Windows ou Linux
- Porta: definida automaticamente pelo Azure através da variável `PORT`
- Comando de arranque: `npm start`

### 2. Publicar estes ficheiros

Publicar a pasta `validacoes-webapp` inteira, incluindo:

- `server.js`
- `package.json`
- `public/`
- `data/`
- `uploads/`

### 3. Configurar persistência

Para piloto simples, a app guarda dados em ficheiros:

- `data/records.json`
- `uploads/`

No Azure App Service, confirmar que o armazenamento persistente está ativo.

Variáveis opcionais:

```text
DATA_DIR=/home/site/data
UPLOAD_DIR=/home/site/uploads
DB_FILE=/home/site/data/records.json
```

Em Windows App Service, usar caminhos equivalentes em `D:\home\site`.

### 4. Segurança mínima antes de uso real

Antes de usar com dados reais de clientes, adicionar:

- Login obrigatório para ENDESA e INMARK
- HTTPS ativo
- Cópias de segurança
- Política de retenção de dados
- Envio real de e-mails
- Base de dados e armazenamento de ficheiros próprios

## Próxima evolução recomendada

Para produção, substituir ficheiros locais por:

- Base de dados: Azure SQL ou PostgreSQL
- Ficheiros: Azure Blob Storage
- Login: Microsoft Entra ID
- E-mails: Microsoft Graph ou SMTP autenticado

## Importante: manter dados entre deploys

Para evitar perda de dados em cada publicação, **não guardar dados dentro da pasta publicada da aplicação**.

A app suporta estas variáveis de ambiente:

```text
DATA_DIR
UPLOAD_DIR
DB_FILE
```

No Azure App Service, configurar em **Environment variables / Application settings**.

### Se o App Service for Windows

Usar:

```text
DATA_DIR=D:\home\site\appdata\data
UPLOAD_DIR=D:\home\site\appdata\uploads
DB_FILE=D:\home\site\appdata\data\records.json
```

### Se o App Service for Linux

Usar:

```text
DATA_DIR=/home/site/appdata/data
UPLOAD_DIR=/home/site/appdata/uploads
DB_FILE=/home/site/appdata/data/records.json
```

Depois de configurar estas variáveis, reiniciar o App Service.

### Regra para futuros deploys

O pacote de publicação **não deve incluir**:

- `data/`
- `uploads/`

Essas pastas devem existir apenas na área persistente do Azure. Assim, novos deploys atualizam o código, mas não substituem registos nem anexos.
