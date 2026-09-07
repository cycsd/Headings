# Headings

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md)

Organiza rapidamente el esquema y las secciones de tus notas Markdown de Obsidian. Este complemento permite navegar, copiar, seleccionar, mover, insertar y alinear encabezados. Resulta util para reestructurar notas largas, reordenar secciones y mantener una jerarquia de encabezados coherente.

## Comandos

### Ir al encabezado
Explora todos los encabezados de la nota actual y mueve el cursor al encabezado seleccionado.

### Copiar encabezado
Explora los encabezados de la nota actual. Tras seleccionar uno, puedes copiarlo o insertar su marcador en la posicion actual del cursor.

### Alinear nivel del encabezado
Mueve un encabezado y todo su contenido despues del encabezado seleccionado y antes del siguiente encabezado de nivel superior. El encabezado movido se ajusta al mismo nivel que el seleccionado, y sus descendientes se ajustan en la misma medida.

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

> No se puede insertar un encabezado bajo uno de sus propios descendientes ni bajo su padre actual, porque ya pertenece a ese padre.

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