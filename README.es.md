# Headings

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md)

Un plugin para mirar un documento Markdown desde distintos ángulos.
Una nota es un mapa mental: los encabezados, listas y demás secciones que ya tiene se vuelven a dibujar como una sola imagen de toda la estructura, para que captes de un vistazo los puntos clave y la forma de la nota.

Cuando ves qué hay que arreglar, lo haces sobre el mapa: contraes las ramas que no te interesan, haces doble clic en un nodo para cambiar su texto, arrastras una sección entera bajo otro capítulo. Cada cambio se escribe en la nota, así que no hace falta subir y bajar por el editor cortando y pegando.
También hay un conjunto de comandos del editor para ir a un encabezado, copiarlo o moverlo, o para enderezar niveles de encabezado que se han descolocado, sin abrir la vista.


## Vista Headings

<!-- Capturas pendientes: doc/img/headings_view_mindmap.png (mapa mental completo), doc/img/headings_view_drag.gif (arrastre con vista previa del destino), doc/img/headings_view_edit.gif (edición dentro del nodo). Guion en doc/demo/recording-script.md. -->

Dibuja la nota que tienes abierta como una imagen. Contrae, edita y arrastra sobre la imagen, y los cambios se escriben en el archivo.

Ábrela con el icono de la cinta o el comando **Abrir la vista Headings**.
La vista muestra la nota que está abierta en ese momento y se actualiza al cambiar de nota o cuando cambia el archivo.

### Diseños

Hay tres diseños, que se cambian desde la cabecera de la vista:

- Mapa mental: el título de la nota en el centro y los encabezados creciendo hacia la izquierda y la derecha. Desplaza para mover, pellizca o Ctrl+rueda para hacer zoom.
- Tabla de árbol: los encabezados como celdas anidadas, un nivel más profundo por cada columna hacia la derecha.
- Esquema: una lista con sangría y líneas de rama.

El diseño predeterminado para escritorio y para móvil se elige en los ajustes.
Para fijar el diseño de una nota concreta, añádele la propiedad `headings-layout` con `mindmap`, `tree-table` u `outline`. El mapa mental puede crecer solo hacia la derecha: marca **Mapa mental: solo derecha** en el menú de diseño, actívalo por defecto en los ajustes o añade `headings-mindmap-direction: right` a la nota.

### Nodos

Cada encabezado es un nodo, y las secciones que hay debajo del encabezado (párrafos, listas, citas, callouts, código, tablas, matemáticas, HTML, propiedades, notas al pie) van dentro de él.
Una fila de iconos en el nodo muestra u oculta cada tipo de sección; qué tipos se muestran por defecto se elige en los ajustes.

Si quieres que un tipo de sección se convierta en nodos propios (por ejemplo, cada elemento de lista como nodo hijo), marca el tipo en los ajustes o añade la propiedad `headings-nodes` a la nota. El menú de la cabecera también lo activa de forma puntual.

Las propiedades de la nota (frontmatter) aparecen como un panel de propiedades en el nodo raíz.
Las casillas dentro de un nodo se pueden marcar directamente y el cambio se escribe en el archivo.

### Navegación

Las migas de pan de la parte superior muestran la ruta hasta el nodo seleccionado. Haz clic en una para listar los hermanos de ese nivel y saltar a uno.

Hay varias formas de contraer y expandir: haz clic en el tirador donde se bifurca la rama; con un nodo seleccionado, `Space` contrae o expande sus hijos y `Shift+Space` todo el subárbol; o elige una profundidad en el menú de la cabecera. **Expandir un nivel** y **Contraer un nivel** también son comandos, así que puedes asignarles atajos.

Haz clic derecho en un nodo o pulsa `…` para abrir el menú del nodo:

- Contraer los demás nodos
- Enfocar este nodo: muestra solo este subárbol; para volver, haz clic en las migas de pan
- Expandir / Contraer este subárbol
- Localizar en el archivo Markdown: coloca el cursor del editor en la línea de la que viene este nodo

Las teclas de flecha mueven la selección entre los nodos visibles.

El botón de búsqueda de la cabecera, el comando **Buscar nodos** o `Ctrl/Cmd+F` con la vista enfocada abren una barra de búsqueda encima de las migas de pan. Compara el título y el contenido de cada nodo: separa varias palabras con espacios para exigirlas todas, no distingue mayúsculas y las comillas mantienen una frase junta. El ámbito es el árbol que se está dibujando, así que tras **Enfocar este nodo** solo se busca en ese subárbol; la barra muestra entonces una etiqueta «en …» y al pulsarla vuelves al archivo completo.

El botón de embudo de la barra cambia entre dos modos y recuerda la última elección:

- Buscar (predeterminado): el árbol completo sigue visible y los nodos que coinciden se marcan con el color de resaltado de búsqueda (el mismo que usa Ctrl+F en el editor), y la coincidencia actual con un tono más fuerte. `Enter` / `Shift+Enter` saltan entre coincidencias y las centran, expandiendo de paso las ramas contraídas. Todo lo demás funciona igual.
- Filtrar: solo quedan los nodos que coinciden y sus ancestros, los ancestros que solo están de paso se atenúan y el estado de contracción se ignora de momento. Es una lente para mirar, no para editar: añadir, eliminar, arrastrar, `Space` y los elementos de menú relacionados con contraer quedan desactivados mientras filtras; seleccionar, las flechas, editar un nodo, marcar casillas, localizar y enfocar siguen funcionando.

`Esc` cierra la barra y el árbol vuelve a como estaba.

### Edición

Haz doble clic en un nodo, pulsa `F2` o elige **Editar** en el menú del nodo, y el nodo se convierte en el editor de Obsidian con el Markdown de ese nodo.
Listas, enlaces, etiquetas y formato se comportan exactamente como en una nota, porque es el mismo editor.

`Ctrl/Cmd+Enter` o un clic fuera del nodo lo escribe en el archivo.
No se intercepta ninguna otra tecla: `Enter` sigue continuando la lista, `Esc` sigue quitando la selección.

Con un nodo seleccionado (sin estar editando):

- `Enter` añade un hermano detrás
- `Tab` añade un hijo
- `Delete` elimina el nodo y todo lo que hay debajo, tras pedir confirmación
- `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` deshacer y rehacer

Después de añadir o eliminar, los niveles de encabezado y la sangría de las listas se ajustan solos.

### Arrastrar y soltar

Mantén pulsada la barra de título de un nodo para arrastrarlo.
Mientras arrastras, un marcador muestra dónde caerá y los demás nodos le hacen sitio.

- Suelta en el centro de un nodo para convertirlo en su último hijo
- Suelta cerca del borde superior o inferior para insertarlo antes o después de ese nodo
- `Esc` cancela

Solo aparecen destinos válidos: los encabezados van junto a encabezados, los elementos de lista junto a elementos de lista.
Tras soltar, los niveles de encabezado y la sangría se ajustan al nuevo padre.

### Teclado

| Tecla | Acción |
|---|---|
| `↑` `↓` `←` `→` | Mover la selección |
| `Space` / `Shift+Space` | Contraer o expandir los hijos / todo el subárbol |
| `Enter` / `Tab` | Añadir un hermano / un hijo |
| `F2` o doble clic | Editar el nodo |
| `Ctrl/Cmd+Enter` | Terminar la edición y escribir |
| `Delete` | Eliminar el nodo y sus descendientes |
| `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` | Deshacer, rehacer |
| `Esc` al arrastrar | Cancelar el arrastre |
| `Ctrl/Cmd+F` | Abrir la búsqueda |

### Ajustes

- Qué tipos de sección se muestran como nodos y qué contenido se muestra por defecto, cada grupo con un interruptor para activar todo
- Diseño predeterminado en escritorio y en móvil, ancho máximo del nodo, altura máxima del contenido del nodo y si al abrir un archivo se expande solo hasta cierta profundidad
- Si el borde y el fondo del nodo toman el color de la rama, y el ancho y la altura máxima del editor dentro del nodo
- Recordar el estado de la vista por archivo: la próxima vez que se abra el mismo archivo vuelven los nodos contraídos, el nodo enfocado, la profundidad de expansión y el contenido mostrado (activado por defecto, hasta 200 archivos), con un botón para borrar todos los estados recordados

> [!note]
> En móvil el diseño predeterminado es el esquema. Arrastrar y soltar necesita ratón o lápiz; arrastrar con un dedo desplaza la vista.

> [!note]
> Si el archivo cambia en otro sitio mientras editas un nodo, esa edición no se escribe.
> Aparece un aviso y tu texto se copia al portapapeles para que no se pierda.

## Comandos

Un conjunto de comandos para trabajar con los encabezados directamente en el editor, sin abrir la vista. Todos empiezan listando los encabezados de la nota actual para que elijas uno.

### Ir al encabezado
Explora todos los encabezados de la nota actual y mueve el cursor al encabezado seleccionado.

### Copiar encabezado
Explora los encabezados de la nota actual. Tras seleccionar uno, puedes copiarlo o insertar su marcador en la posicion actual del cursor.

### Alinear nivel del encabezado
Mueve un encabezado y todo su contenido despues del encabezado seleccionado y antes del siguiente encabezado de nivel superior. El encabezado movido se ajusta al mismo nivel que el seleccionado, y sus descendientes se ajustan en la misma medida.

> [!important]
> Esta operacion modifica la jerarquia de encabezados para alinear el nivel.

Ejemplo: alinear H5 con H3. El plugin busca el siguiente encabezado superior a H3 (H2), mueve H5 y su contenido antes de ese H2, y cambia H5 al mismo nivel que H3.

Antes:
```markdown
## H2
### H3
#### H4
## H2
##### H5
###### H6
```

Despues:
```markdown
## H2
### H3
#### H4
### H5
#### H6
## H2
```

> [!caution]
> Obsidian solo admite encabezados de nivel 1 a 6. Si un ajuste supera el nivel 6, el encabezado se muestra en el nivel 6.

Ejemplo: alinear H3 ✌️ con H4.
```markdown
## H2
### H3
#### H4
##### H5
## H2
### H3 ✌️
#### H4 ✌️
##### H5 ✌️
###### H6 ✌️
```

Despues:
```markdown
## H2
### H3
#### H4
##### H5
#### H3 ✌️
##### H4 ✌️
###### H5 ✌️
###### H6 ✌️
## H2
```

### Insertar encabezado bajo otro encabezado
Mueve un encabezado y todo su contenido bajo el encabezado seleccionado y antes de su siguiente encabezado de nivel superior. El nivel se ajusta para conservar la relacion padre-hijo correcta.

> [!important]
> No se puede insertar un encabezado bajo uno de sus propios descendientes ni bajo su padre actual, porque ya pertenece a ese padre.

> [!important]
> Si existe una diferencia de nivel entre el encabezado movido y el destino, se ajusta el nivel para mantener una jerarquia valida.

Ejemplo: insertar H4 bajo H2 ☝️.

Antes:
```markdown
## H2 ☝️
### H3
## H2
#### H4
```

Sin ajustar el nivel, H4 seria hijo de H3 y no hijo directo de H2 ☝️:
```markdown
## H2 ☝️
### H3
#### H4 ❌
## H2
```

Para conservar la estructura, H4 cambia al nivel 3:
```markdown
## H2 ☝️
### H3
### H4 ⭕
## H2
```

> [!caution]
> Obsidian solo admite encabezados de nivel 1 a 6. Si un ajuste supera el nivel 6, el encabezado se muestra en el nivel 6.

Ejemplo: insertar H3 ✌️ bajo H4.
```markdown
## H2
### H3
#### H4
##### H5
## H2
### H3 ✌️
#### H4 ✌️
##### H5 ✌️
###### H6 ✌️
```

Despues:
```markdown
## H2
### H3
#### H4
##### H5
##### H3 ✌️
###### H4 ✌️
###### H5 ✌️
###### H6 ✌️
## H2
```

### Mover encabezado
Mueve el encabezado seleccionado y todo su contenido despues de otro encabezado elegido y antes de la siguiente seccion hija de ese encabezado. Este comando no cambia los niveles de encabezado.

> [!important]
> Esta operacion solo cambia la posicion; conserva la jerarquia existente.

Ejemplo: al mover H1 a H2, el plugin busca el siguiente encabezado, H3, y mueve H1 y su contenido H2 antes de H3.

Antes:
```markdown
## H2
### H3
# H1
## H2
```

Despues:
```markdown
## H2
# H1
## H2
### H3
```

Tambien permite reordenar encabezados del mismo nivel.
```markdown
## H2
### H3
#### H4 ☝️
#### H4 ✌️
```

Despues de mover H4 ✌️ a H3:
```markdown
## H2
### H3
#### H4 ✌️
#### H4 ☝️
```

### Mover bloque actual bajo un encabezado
Mueve el bloque que contiene el cursor bajo el encabezado seleccionado.

### Mover texto seleccionado bajo un encabezado
Mueve el texto seleccionado bajo el encabezado elegido.

### Seleccionar contenido del encabezado
Selecciona todo el contenido bajo el encabezado seleccionado.