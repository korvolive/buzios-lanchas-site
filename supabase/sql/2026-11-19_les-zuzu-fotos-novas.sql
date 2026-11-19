-- publicar: auto
-- Les Zuzu: galeria com as fotos novas no mar de Búzios (aprovadas pelo Rodrigo em 19/11/2026). Idempotente.
update fotos set lista = '[
 {"f":"lz-05","a":"A Les Zuzu no mar de Búzios, vista de lado","p":"center 50%"},
 {"f":"lz-06","a":"Casco azul-marinho e branco e plataforma de popa","p":"center 50%"},
 {"f":"lz-07","a":"Popa com solário e plataforma de banho","p":"center 50%"},
 {"f":"lz-08","a":"Lateral da lancha com toldo azul","p":"center 50%"},
 {"f":"lz-09","a":"Cockpit com toldo e posto de comando","p":"center 50%"},
 {"f":"lz-01","a":"A Les Zuzu ancorada em frente à praia","p":"center 62%"}
]'::jsonb, atualizado_em = now()
where lancha = 'les-zuzu';
