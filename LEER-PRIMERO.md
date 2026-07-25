# 🏙️ PLAY DITCOIN — paquete listo para el público

Todo el juego vive en **un solo archivo HTML**. No necesita instalación, ni base de datos, ni servidor
para jugar. Funciona en móvil y en escritorio.

```
PLAY-DITCOIN-PUBLIC/
├── index.html          ← EL JUEGO (versión solo). Ábrelo y ya. Esto es lo que publicas.
├── online/             ← OPCIONAL: solo si quieres contador en vivo + otros jugadores
│   ├── server.js
│   ├── package.json
│   └── public/index.html
└── LEER-PRIMERO.md     ← este archivo
```

---

## 1. Probarlo ahora mismo (0 pasos)

Haz doble clic en **`index.html`**. Se abre en el navegador y funciona completo:
comprar propiedades, cobrar renta, tienda, rangos, airdrop, racha diaria. Todo se guarda
en el navegador del jugador.

---

## 2. Publicarlo en internet — **GRATIS, sin Railway**

### Opción A · Netlify Drop — la más rápida (30 segundos, sin cuenta, sin comandos)

1. Entra a **https://app.netlify.com/drop**
2. Arrastra la carpeta que contiene `index.html`.
3. Te da una URL pública tipo `https://algo-random.netlify.app` — **ya está online**.
4. (Opcional) Crea cuenta gratis para conservar la URL y ponerle tu dominio.

> Es la que recomiendo para empezar. Cero configuración.

### Opción B · Cloudflare Pages — la más rápida sirviendo (CDN mundial)

1. **https://pages.cloudflare.com** → *Create a project* → *Direct Upload*.
2. Sube la carpeta con `index.html`.
3. URL gratis `https://tu-proyecto.pages.dev`, con red global y ancho de banda ilimitado.

### Opción C · Vercel — si prefieres su panel

1. **https://vercel.com/new** → arrastra la carpeta (o conecta un repo de GitHub).
2. Framework: **Other**. Publica.

### Opción D · GitHub Pages — si ya usas GitHub

1. Sube `index.html` a un repo.
2. *Settings → Pages → Source: main / root*. Queda en `https://tuusuario.github.io/turepo`.

### Opción E · itch.io — si lo quieres frente a jugadores, no a cripto-gente

1. **https://itch.io/game/new** → *Kind of project:* **HTML**.
2. Sube un `.zip` que contenga `index.html` y marca *This file will be played in the browser*.
3. itch.io tiene público de juegos ya hecho — buen sitio para conseguir los primeros usuarios.

> ⚠️ **Phantom (pagos con SOL) solo funciona en `https://`**, nunca abriendo el archivo local.
> Cualquiera de las opciones de arriba te da https automático.

---

## 3. Modo online (opcional) — sin Railway

El juego **no necesita** esto: sin servidor el contador muestra `🟢 1 online` (tú) y todo lo demás
funciona igual. Actívalo solo cuando quieras que los jugadores se vean entre sí.

### Render.com (gratis, admite WebSockets)

1. Sube la carpeta `online/` a un repo de GitHub.
2. **https://render.com** → *New* → *Web Service* → conecta el repo.
3. Configura:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. Te da `https://tu-app.onrender.com` — ahí ya corre el juego **con** multijugador.

> El plan gratis de Render duerme el servicio tras 15 min sin visitas; la primera carga después
> tarda ~30 s. Para producción real, su plan pago más barato lo evita.

### Alternativas equivalentes
- **Fly.io** — `fly launch` + `fly deploy` (buen plan gratis, WebSockets sí).
- **Koyeb** / **Glitch** — también gratis y soportan WebSockets.

### Conectar la versión estática al servidor
Si publicaste `index.html` en Netlify y el servidor en Render, abre `index.html` y en la línea de arriba pon:

```js
window.DITCOIN_SERVER = { ws:"wss://tu-app.onrender.com", base:"https://tu-app.onrender.com" };
```

---

## 4. Cómo se juega (para tu marketing)

**En una frase:** compras propiedades, ellas te pagan renta sola, con la renta compras más,
y mientras más tengas más alto tu rango y más grande tu airdrop.

1. Entras y te regalan **350 CP** — alcanza para tu primera casa **ya**.
2. Tocas un cartel 🪧 **FOR SALE** y compras.
3. La casa acumula renta (se ve una **moneda dorada flotando** encima). La tocas y cobras.
4. Con eso compras la siguiente. Cada propiedad sube tu **rango**:
   🎓 Student → 💼 Professional → 📈 Investor → 🏢 Entrepreneur → 🚀 Mogul → 🪐 Visionary

> **El juego está en inglés** (para público internacional). Esta guía está en español porque es para ti.
5. Más propiedades = **más airdrop** 🎁 y más ventaja sobre los demás.

**Ganchos de retención ya integrados:**
- La renta **sigue generándose aunque cierres el juego** (hasta 2 h) → razón para volver.
- **Racha diaria de 7 días** con recompensas que suben (150 CP → 4.000 CP + 💎).
- La renta **se desborda** si no la cobras → urgencia sana.
- **Escasez real**: parcelas limitadas en el mapa, ropa y monturas con cupo (🔥 5/12 left).
- **Probador**: te pruebas cualquier cosa de la tienda antes de comprarla.
- **Perfil de otros**: tocas a alguien y ves su rango, propiedades, medallas y outfit → FOMO.

---

## 5. Cómo hacerlo rentable (lo legal y sostenible)

✅ **Lo que SÍ puedes vender** (entregas valor real a cambio):
- **Cosméticos** — monturas, auras, ropa, gorros. Es el modelo de Fortnite/kintara: no dan ventaja,
  dan estatus. Es el 90 % de los ingresos de estos juegos.
- **VIP / pase de temporada** — suscripción con cosmético exclusivo mensual y racha protegida.
- **Escasez cosmética** — ediciones limitadas numeradas ("5 de 12"), que ya está en el código.
- **Propiedades premium** — mansiones y villas de lujo compradas con SOL.

❌ **Lo que NO debes hacer nunca**: pagar rendimientos en dinero real con el dinero de los nuevos
jugadores. Eso es un esquema Ponzi, es ilegal y te deja responsable personalmente. La renta y los
dividendos del juego son **moneda del juego**, y el airdrop lo financias tú de tu bolsillo como regalo.
Esa línea ya está respetada en el código.

**Orden recomendado para monetizar:**
1. Publica gratis y consigue jugadores (Netlify/itch.io + tu cuenta de X).
2. Cuando haya gente jugando a diario, activa los pagos con SOL (`SOL_CONFIG.live = true`
   dentro de `index.html`, con tu wallet ya configurada).
3. Solo entonces piensa en el token — con tokenomics de verdad, no antes.

---

## 6. Errores conocidos / pendientes

- Quedan sistemas viejos del prototipo estilo Clash (ejército, muros, guerra de pueblos) que ya no
  son el centro del juego. No estorban, pero conviene retirarlos o separarlos del todo.
- El multijugador no guarda nada en servidor todavía: cada jugador guarda en **su** navegador.
  Para cuentas de verdad hace falta base de datos (siguiente paso natural).
