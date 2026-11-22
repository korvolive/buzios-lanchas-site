#!/usr/bin/env bash
# Compressão (gzip) e cache das fotos no servidor da HostGator (2026-11-05, site mais rápido no celular).
# O .htaccess do servidor pode ter regras do cPanel (ex.: redirecionamentos), então NUNCA é trocado inteiro:
# baixa o que está lá, troca só o bloco entre as marcas "buzios-velocidade" e manda de volta junto com o site.
# Se não conseguir ler o arquivo do servidor (erro que não seja "não existe"), não mexe no .htaccess.
set -u
rm -f .htaccess
curl -sS --fail --ssl-reqd -o .htaccess.servidor --user "$FTP_USERNAME:$FTP_PASSWORD" "ftp://$FTP_SERVER/.htaccess" 2>/dev/null
st=$?
if [ $st -ne 0 ] && [ $st -ne 78 ]; then
  # certificado com outro nome (servidor compartilhado): continua criptografado, só sem conferir o nome. Senha nunca vai sem TLS (revisão 22/11)
  curl -sS --fail --ssl-reqd -k -o .htaccess.servidor --user "$FTP_USERNAME:$FTP_PASSWORD" "ftp://$FTP_SERVER/.htaccess" 2>/dev/null
  st=$?
  [ $st -eq 0 ] && echo "htaccess: TLS sem conferir o nome do certificado"
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
# Proteção contra abrir o site/painel dentro de outro site (clickjacking) e outros reforços (revisão de segurança 22/11)
Header always set X-Frame-Options "SAMEORIGIN"
Header always set Content-Security-Policy "frame-ancestors 'self'; base-uri 'self'; object-src 'none'"
Header always set X-Content-Type-Options "nosniff"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
# HTML sempre conferido no servidor: o Safari guardava a página de pagamento antiga e o cliente não via mudança publicada (María, 2026-11-14)
<FilesMatch "\.html?$">
Header set Cache-Control "no-cache, must-revalidate"
</FilesMatch>
</IfModule>
<IfModule mod_rewrite.c>
RewriteEngine On
# Arquivos internos que ficaram no servidor de envios antigos (código das funções, configurações): não ficam públicos (revisão 22/11)
RewriteRule ^(supabase|scripts|graphify-out|\.claude|\.github|node_modules)(/|$) - [R=404,L]
RewriteRule ^(CLAUDE|SEGURANCA|README)\.md$ - [R=404,L]
# Sempre HTTPS (questionário de segurança do Asaas, 2026-11-13): http://... vai para https://www...
RewriteCond %{HTTPS} off
RewriteCond %{HTTP:X-Forwarded-Proto} !https
RewriteCond %{HTTP_HOST} (^|\.)lanchaembuzios\.com\.br$ [NC]
RewriteRule ^ https://www.lanchaembuzios.com.br%{REQUEST_URI} [R=301,L,NE]
# Bordazul (2026-11-16): bordazul.com.br aponta para esta mesma pasta. O início do Bordazul vem da pasta bordazul/
# e o site de Búzios inteiro (vitrine, conta, pagamento) aparece em bordazul.com.br/buzios/, com a marca trocada pelo marca.js.
RewriteCond %{HTTP_HOST} (^|\.)bordazul\.com\.br$ [NC]
RewriteCond %{HTTPS} off
RewriteCond %{HTTP:X-Forwarded-Proto} !https
RewriteRule ^ https://www.bordazul.com.br%{REQUEST_URI} [R=301,L,NE]
RewriteCond %{HTTP_HOST} ^bordazul\.com\.br$ [NC]
RewriteRule ^ https://www.bordazul.com.br%{REQUEST_URI} [R=301,L,NE]
RewriteCond %{HTTP_HOST} (^|\.)bordazul\.com\.br$ [NC]
RewriteRule ^(buzios|en|es|anunciar)$ /$1/ [R=301,L]
RewriteCond %{HTTP_HOST} (^|\.)bordazul\.com\.br$ [NC]
RewriteCond %{THE_REQUEST} !\s/buzios[/?\s]
RewriteCond %{DOCUMENT_ROOT}/bordazul/$1 -f [OR]
RewriteCond %{DOCUMENT_ROOT}/bordazul/$1index.html -f
RewriteRule ^(.*)$ bordazul/$1 [L]
RewriteCond %{HTTP_HOST} (^|\.)bordazul\.com\.br$ [NC]
RewriteRule ^buzios/(.*)$ $1 [L]
RewriteCond %{HTTP_HOST} (^|\.)bordazul\.com\.br$ [NC]
RewriteRule ^(rj|regiao|petrussia)(/|$) / [R=302,L]
# Botão do WhatsApp: link com "?" codificado (/pagar/%3Fp%3D...) ou link curto (/pagar/p49-...) abre a página de pagamento
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^pagar/(\?.*|p[0-9]+-[0-9A-Za-z-]+)$ pagar/index.html [L]
</IfModule>
# END buzios-velocidade
BLOCO
rm -f .htaccess.servidor
echo ".htaccess pronto ($(wc -l < .htaccess) linhas, $(grep -c 'buzios-velocidade' .htaccess) marcas)"
