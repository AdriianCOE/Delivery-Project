# Banners institucionais PratoBy

Peças universais para portfólio, capas, headers, redes sociais e apresentações.

## Arquivos

- `principal-1600x900.png` / `.svg` — peça principal universal 16:9.
- `apresentacao-1920x1080.png` / `.svg` — apresentação widescreen.
- `open-graph-1200x630.png` / `.svg` — compartilhamento e previews.
- `linkedin-cover-1584x396.png` / `.svg` — capa LinkedIn.
- `facebook-cover-1640x624.png` / `.svg` — capa Facebook.
- `instagram-feed-1080x1080.png` / `.svg` — post quadrado.
- `story-1080x1920.png` / `.svg` — stories/reels.
- `manifest.json` — metadados, paleta e relação dos arquivos.

## Identidade

- Logo usada: `public/icons/android-chrome-512x512.png`.
- Posicionamento: `Seu delivery online, sem comissão por pedido.`
- Paleta baseada no brand kit:
  - Laranja principal: `#F97316`
  - Laranja escuro: `#EA580C`
  - Creme: `#FFF7ED`
  - Creme premium: `#FFFBF5`
  - Texto escuro: `#111827`
  - Cinza secundário: `#4B5563`

## Regenerar

Na raiz do projeto:

```powershell
python scripts/generate_pratoby_brand_banners.py
```

Se estiver usando o runtime do Codex, use o Python apontado pelo ambiente local.
