# Frontend — Domus

Next.js 16 (App Router) + React 19 + Tailwind 4 + **shadcn/ui** (estilo
`radix-nova`, primitivas Radix, íconos Lucide). La configuración está en
`components.json`; los componentes instalados viven en `src/components/ui/`.

## 1. shadcn/ui es obligatorio

**Nunca** escribas un `<button>`, `<input>`, `<select>`, `<table>` o un `div`
con borde-y-sombra a mano si existe el componente de shadcn. Siempre:

| Necesitás… | Usá |
|---|---|
| Botón, link con forma de botón | `Button` (`asChild` para envolver un `Link`) |
| Contenedor con título | `Card` + `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` / `CardFooter` |
| Campo de formulario | `Field` + `FieldLabel` + `Input` / `Select` / `Switch` (+ `FieldDescription`, `FieldError`) |
| Agrupar campos verticalmente | `FieldGroup` |
| Dropdown | `Select` + `SelectTrigger` + `SelectValue` + `SelectContent` + `SelectItem` |
| Tabla de datos | `Table` + `TableHeader` / `TableRow` / `TableHead` / `TableBody` / `TableCell` |
| Estado (activo, vencido, pendiente) | `Badge` con `variant` |
| Error, aviso | `Alert` + `AlertDescription` |
| Cargando | `Skeleton` con la forma del contenido, nunca texto "Cargando…" |
| Panel lateral / menú mobile | `Sheet` (la sidebar ya lo hace sola) |
| Confirmar algo destructivo | `AlertDialog` (no `Dialog`) |
| Navegación principal | `Sidebar*` de `src/components/ui/sidebar.tsx` |

Si falta un componente, se instala con el CLI (no se copia de internet):

```bash
npx shadcn@latest add <componente>
```

Se **pueden** modificar los archivos de `src/components/ui/` — son nuestros —
pero solo para extender (agregar una `variant`, arreglar un lint), nunca para
cambiar su API. `Badge` ya tiene `success` y `warning` agregadas así.

## 2. Tokens: una sola fuente de verdad

Los colores viven en `src/app/globals.css`, en `:root`, con los **nombres
semánticos de shadcn**. El design system Domus (paleta cálida, clara) está
mapeado ahí. **No existen tokens paralelos**: no hay `--color-ink`,
`--color-surface` ni nada "de Domus" fuera de los nombres de shadcn.

| Token | Valor | Para qué |
|---|---|---|
| `background` | `#f7f6f3` | Lienzo de la página |
| `foreground` | `#1b1917` | Texto principal |
| `card` / `popover` | `#ffffff` | Superficies elevadas |
| `primary` | `oklch(0.52 0.11 254)` (azul Domus) | **El único acento.** Botón principal, links, focus |
| `primary-foreground` | `#ffffff` | Texto sobre primary |
| `secondary` / `muted` | `#fbfaf8` | Superficie secundaria, fondos de inputs |
| `secondary-foreground` | `#4a463f` | Texto secundario |
| `muted-foreground` | `#7a746b` | Texto atenuado, labels, descripciones |
| `accent` | `oklch(0.95 0.02 254)` (azul suave) | Item activo del menú, hover, chips |
| `accent-foreground` | azul Domus | Texto sobre accent |
| `destructive` | `oklch(0.53 0.16 25)` | Error, inactivo, borrar |
| `success` | `oklch(0.52 0.11 155)` | Activo, cobrado, resuelto |
| `warning` | `oklch(0.62 0.12 72)` | Pendiente, vencido, atención |
| `border` / `input` | `#e6e3dd` | Líneas |
| `ring` | azul Domus | Anillo de focus |
| `radius` | `0.625rem` | Base de todos los redondeados |

### Cómo se usan

```tsx
// BIEN — clases semánticas de Tailwind que salen de los tokens
<p className="text-muted-foreground">…</p>
<div className="bg-card border-border">…</div>
<Badge variant="success">Activo</Badge>
<span className="text-destructive">…</span>

// MAL — nunca
<p className="text-gray-500">…</p>          // paleta de Tailwind
<div className="bg-[#f7f6f3]">…</div>        // hex hardcodeado
<div className="bg-white text-black">…</div> // colores literales
<div className="bg-blue-600">…</div>         // "casi" el primary
```

Regla práctica: si escribís un color que no es uno de los tokens de la tabla,
está mal. Si un color nuevo hace falta de verdad, se agrega **una vez** en
`:root` + `@theme inline` de `globals.css` y se documenta acá.

### Lo que NO se hace

- **No hay modo oscuro** y no se agrega. El producto es light a propósito.
  Ignorá cualquier guía de shadcn que sugiera `dark` por defecto.
- **Un solo acento.** No se introducen violetas, naranjas ni degradés. Los
  estados usan `success` / `warning` / `destructive`, nada más.
- **Sin sombras fuertes ni glassmorphism.** Las cards ya traen su `ring-1`.
- **Sin radios ad-hoc** (`rounded-[14px]`). Usá `rounded-lg`, `rounded-xl`,
  etc., que salen de `--radius`.

## 3. Tipografía

**IBM Plex Sans** vía `next/font` (`src/app/layout.tsx`), aplicada en `<html>`.
En `globals.css` la fuente está declarada con el nombre **literal** dentro de
`@theme inline` — no con `var()`, porque Tailwind 4 resuelve `@theme inline`
en tiempo de parseo y la variable de `next/font` recién existe en runtime.

Escala: títulos de página `text-2xl font-bold tracking-tight`; títulos de card
los pone `CardTitle`; labels de sección en mayúsculas
`text-xs font-semibold tracking-widest text-muted-foreground uppercase`;
números en tablas y KPIs con `tabular-nums`.

## 4. Responsive: mobile primero

Todo lo que se construye tiene que verse bien a **375px** y a **1440px**.
shadcn resuelve la mitad; la otra mitad es disciplina con los grids.

- **Layout del panel**: `SidebarProvider` + `AppSidebar` + `SidebarInset`. En
  desktop la sidebar es fija; en mobile (`< 768px`) se vuelve un `Sheet` que
  abre el `SidebarTrigger` del header. No hay que hacer nada más.
- **Grids**: siempre una columna por defecto y se abren con breakpoints.
  `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`. Nunca `grid-cols-3` a secas.
- **Formularios**: campos en `Field` dentro de un grid que colapsa. Los
  botones de submit `w-full sm:w-auto`.
- **Tablas**: `Table` ya trae `overflow-x-auto`; envolvela en una `Card` con
  `overflow-hidden py-0`. Si la tabla tiene muchas columnas, considerá
  ocultar las secundarias en mobile (`hidden md:table-cell`).
- **Headers de página**: `flex flex-wrap items-end justify-between gap-3`
  para que el botón de acción baje de línea en pantallas chicas.
- **Padding del `main`**: ya está en el layout (`px-4 sm:px-6 lg:px-8`). No
  agregues padding lateral en las páginas.
- **Verificá en el navegador** a 375px antes de dar algo por terminado.

## 5. Arquitectura del frontend

```
src/
├── app/
│   ├── login/            pública
│   └── (panel)/          protegida: layout con sidebar + SesionProvider
├── components/
│   ├── ui/               shadcn — instalados por CLI
│   ├── app-sidebar.tsx   navegación
│   ├── session.tsx       SesionProvider / useSesion
│   └── <feature>-form.tsx, etc.
├── services/             UNA función por endpoint, usan lib/api.ts
├── lib/api.ts            el único fetch del proyecto (credentials: include)
├── types/                espejan lo que devuelve el backend
├── hooks/                use-mobile y los que vengan
└── proxy.ts              guard de rutas por cookie
```

- Los componentes llaman a `services/`, nunca a `fetch`. Los services llaman a
  `api()`. Nadie más.
- Errores de API: `ApiError` con `.status` y `.message` ya legible. Se
  muestran con `<Alert variant="destructive">`.
- Formularios: estado local con `useState`, campos como string, conversión al
  enviar. Sin librería de forms por ahora.
- `'use client'` solo donde hay estado o efectos. Los layouts son server
  components.

## 6. Antes de dar por terminado un cambio de UI

```bash
pnpm typecheck && pnpm lint && pnpm build
```

Y una pasada visual a 375px y a desktop. Si tocaste colores, `grep` de
`text-gray`, `bg-white`, `#` en `src/` fuera de `globals.css` tiene que dar cero.
