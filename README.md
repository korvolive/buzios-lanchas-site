# Búzios Lanchas — site

Site de missbardot.com.br.

- `index.html`: página do site (o catálogo de lanchas fica no início do script, na lista `BOATS`).
- `img/`: fotos das lanchas (versão grande e miniatura `-t`).

Toda alteração salva na branch `main` é enviada automaticamente para a HostGator
pelo arquivo `.github/workflows/deploy.yml`, usando os segredos FTP_SERVER,
FTP_USERNAME e FTP_PASSWORD cadastrados no repositório.
