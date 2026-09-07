# Headings

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md)

Organisez rapidement le plan et les sections de vos notes Markdown dans Obsidian. Ce plugin permet de naviguer, copier, selectionner, deplacer, inserer et aligner les titres. Il est utile pour restructurer de longues notes, reorganiser des sections ou conserver une hierarchie de titres coherente.

## Commandes

### Aller au titre
Parcourez tous les titres de la note actuelle et placez le curseur sur le titre choisi.

### Copier le titre
Parcourez les titres de la note actuelle. Apres en avoir choisi un, vous pouvez le copier ou inserer son marqueur a la position actuelle du curseur.

### Aligner le niveau du titre
Deplacez un titre et tout son contenu apres le titre choisi et avant le prochain titre de niveau superieur. Le titre deplace adopte le niveau du titre choisi, et ses sous-titres sont ajustes de la meme facon.

> Cette operation modifie la hierarchie des titres afin d'aligner leur niveau.

Exemple : alignez H5 sur H3. Le plugin trouve le prochain titre superieur a H3 (H2), deplace H5 et son contenu avant ce H2, puis change H5 au meme niveau que H3.

Avant :
```markdown
## H2
### H3
#### H4
## H2
##### H5
###### H6
```

Apres :
```markdown
## H2
### H3
#### H4
### H5
#### H6
## H2
```

> Obsidian ne prend en charge que les titres de niveau 1 a 6. Si un ajustement depasse le niveau 6, le titre est affiche au niveau 6.

Exemple : alignez H3 ✌️ sur H4.
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

Apres :
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

### Inserer un titre sous un autre titre
Deplacez un titre et tout son contenu sous le titre choisi et avant son prochain titre de niveau superieur. Son niveau est ajuste afin de conserver une relation parent-enfant correcte.

> Vous ne pouvez pas inserer un titre sous l'un de ses propres descendants ni sous son parent actuel, car il appartient deja a ce parent.

> S'il existe une difference de niveau entre le titre deplace et le titre cible, le niveau est ajuste pour conserver une hierarchie valide.

Exemple : inserez H4 sous H2 ☝️.

Avant :
```markdown
## H2 ☝️
### H3
## H2
#### H4
```

Sans ajuster son niveau, H4 deviendrait un enfant de H3, et non un enfant direct de H2 ☝️ :
```markdown
## H2 ☝️
### H3
#### H4 ❌
## H2
```

Pour conserver la structure voulue, H4 est passe au niveau 3 :
```markdown
## H2 ☝️
### H3
### H4 ⭕
## H2
```

> Obsidian ne prend en charge que les titres de niveau 1 a 6. Si un ajustement depasse le niveau 6, le titre est affiche au niveau 6.

Exemple : inserez H3 ✌️ sous H4.
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

Apres :
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

### Deplacer le titre
Deplacez le titre choisi et tout son contenu apres un autre titre choisi et avant la prochaine section enfant de ce titre. Cette commande ne modifie pas les niveaux de titres.

> Cette operation ne change que la position et conserve la hierarchie existante.

Exemple : en deplacant H1 vers H2, le plugin trouve le titre suivant, H3, et deplace H1 et son contenu H2 avant H3.

Avant :
```markdown
## H2
### H3
# H1
## H2
```

Apres :
```markdown
## H2
# H1
## H2
### H3
```

Cette commande peut aussi reordonner des titres du meme niveau.
```markdown
## H2
### H3
#### H4 ☝️
#### H4 ✌️
```

Apres avoir deplace H4 ✌️ vers H3 :
```markdown
## H2
### H3
#### H4 ✌️
#### H4 ☝️
```

### Deplacer le bloc actuel sous un titre
Deplacez le bloc contenant le curseur sous le titre choisi.

### Deplacer le texte selectionne sous un titre
Deplacez le texte selectionne sous le titre choisi.

### Selectionner le contenu du titre
Selectionnez tout le contenu sous le titre choisi.