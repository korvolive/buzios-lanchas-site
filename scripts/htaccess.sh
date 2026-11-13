#!/usr/bin/env bash
# Compressão (gzip) e cache das fotos no servidor da HostGator (2026-11-05, site mais rápido no celular).
# O .htaccess do servidor pode ter regras do cPanel (ex.: redirecionamentos), então NUNCA é trocado inteiro:
# baixa o que está lá, troca só o bloco entre as marcas "buzios-velocidade" e manda de volta junto com o site.
# Se não conseguir ler o arquivo do servidor (erro que não seja "não existe"), não mexe no .htaccess.
set -u
rm -f .htaccess
curl -sS --fail --ssl-reqd -o .htaccess.servidor --user "$FTP_USERNAME:$FTP_PASSWORD" "ftp://$FTP_SERVER/.htaccess" 2>/dev/null
st=$?
if [ $st -ne 0 ]; then
  curl -sS --fail -o .htaccess.servidor --user "$FTP_USERNAME:$FTP_PASSWORD" "ftp://$FTP_SERVER/.htaccess" 2>/dev/null
  st=$?
fi
if [ $st -eq 78 ]; then
  : > .htaccess.servidor   # o servidor ainda não tem .htaccess
elif [ $st -ne 0 ]; then
  echo "não consegui ler o .htaccess do servidor (curl $st): paro o deploy para não apagar o .htaccess de lá"
  rm -f .htaccess.servidor
  exit 1
fi
sed '/^# BEGIN buzios-velocidade$/,/^# END buzios-velocidade$/d' .htaccess.servidor > .htaccess
cat >> .htaccess <<'BLOCO'
# BEGIN buzios-velocidade
<IfModule mod_mime.c>
AddType image/webp .webp
</IfModule>
<IfModule mod_deflate.c>
AddOutputFilterByType DEFLATE text/html text/css text/plain text/xml application/javascript text/javascript application/json application/xml application/manifest+json image/svg+xml
</IfModule>
<IfModule mod_expires.c>
ExpiresActive On
ExpiresByType image/webp "access plus 7 days"
ExpiresByType image/jpeg "access plus 7 days"
ExpiresByType image/png "access plus 7 days"
ExpiresByType video/mp4 "access plus 7 days"
</IfModule>
<IfModule mod_headers.c>
Header always set Strict-Transport-Security "max-age=31536000" env=HTTPS
</IfModule>
<IfModule mod_rewrite.c>
RewriteEngine On
# Sempre HTTPS (questionário de segurança do Asaas, 2026-11-13): http://... vai para https://www...
RewriteCond %{HTTPS} off
RewriteCond %{HTTP:X-Forwarded-Proto} !https
RewriteCond %{HTTP_HOST} (^|\.)lanchaembuzios\.com\.br$ [NC]
RewriteRule ^ https://www.lanchaembuzios.com.br%{REQUEST_URI} [R=301,L,NE]
# Botão do WhatsApp: link com "?" codificado (/pagar/%3Fp%3D...) ou link curto (/pagar/p49-...) abre a página de pagamento
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^pagar/(\?.*|p[0-9]+-[0-9A-Za-z-]+)$ pagar/index.html [L]
</IfModule>
# END buzios-velocidade
BLOCO
rm -f .htaccess.servidor
echo ".htaccess pronto ($(wc -l < .htaccess) linhas, $(grep -c 'buzios-velocidade' .htaccess) marcas)"
