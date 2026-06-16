# nandaverse

Controle financeiro pessoal — React + Vite + Supabase.

---

## Como subir do zero

### 1. Supabase
1. Entre em supabase.com → crie um novo projeto
2. Vá em **SQL Editor** e cole o conteúdo de `supabase_schema.sql` → Run
3. Vá em **Settings → API** e copie:
   - Project URL
   - anon/public key

### 2. Projeto local
```bash
# Clone o repo
git clone https://github.com/seu-usuario/nandaverse
cd nandaverse

# Instale dependências
npm install

# Configure o .env
cp .env.example .env
# Edite .env com sua URL e chave do Supabase

# Rode localmente
npm run dev
```

### 3. Vercel
1. Entre em vercel.com → New Project → importe o repo `nandaverse`
2. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL` → sua URL do Supabase
   - `VITE_SUPABASE_ANON_KEY` → sua chave anon
3. Deploy!

---

## Estrutura
```
src/
  lib/supabase.js     → cliente Supabase
  styles/global.css   → visual dark
  App.jsx             → app completo
  main.jsx            → entry point
```
