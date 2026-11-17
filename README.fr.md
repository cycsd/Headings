# Headings

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md)

Un plugin pour regarder un document Markdown sous différents angles.
Une note est une carte mentale : les titres, listes et autres sections qu'elle contient déjà sont redessinés en une seule image de la structure entière, pour saisir d'un coup d'œil les points clés et la forme de la note.

Une fois que vous voyez ce qu'il faut corriger, vous le faites directement sur la carte : replier les branches qui ne vous intéressent pas, double-cliquer sur un nœud pour en changer le texte, faire glisser une section entière sous un autre chapitre. Chaque changement est écrit dans la note, plus besoin de monter et descendre dans l'éditeur pour couper-coller.
Il y a aussi un ensemble de commandes d'éditeur pour aller à un titre, le copier ou le déplacer, ou remettre d'aplomb des niveaux de titre qui ont dérivé, sans ouvrir la vue.


## Vue Headings

<!-- Captures à ajouter : doc/img/headings_view_mindmap.png (carte mentale complète), doc/img/headings_view_drag.gif (glissement avec aperçu de la destination), doc/img/headings_view_edit.gif (édition dans le nœud). Script dans doc/demo/recording-script.md. -->

Dessine la note ouverte sous forme d'image. Repliez, modifiez et faites glisser sur l'image, et les changements sont écrits dans le fichier.

Ouvrez-la depuis l'icône du ruban ou la commande **Ouvrir la vue Headings**.
La vue montre la note ouverte à cet instant et se met à jour quand vous changez de note ou que le fichier change.

### Dispositions

Il y a trois dispositions, que l'on change depuis l'en-tête de la vue :

- Carte mentale : le titre de la note au milieu, les titres poussant vers la gauche et la droite. Molette pour déplacer, pincement ou Ctrl+molette pour zoomer.
- Tableau arborescent : les titres en cellules imbriquées, un niveau plus profond à chaque colonne vers la droite.
- Plan : une liste indentée avec des lignes de branche.

La disposition par défaut pour l'ordinateur et pour le mobile se règle dans les réglages.
Pour fixer la disposition d'une note en particulier, ajoutez-lui la propriété `headings-layout` avec `mindmap`, `tree-table` ou `outline`. La carte mentale peut ne pousser que vers la droite : cochez **Carte mentale : droite uniquement** dans le menu des dispositions, activez-le par défaut dans les réglages ou ajoutez `headings-mindmap-direction: right` à la note.

### Nœuds

Chaque titre est un nœud, et les sections sous le titre (paragraphes, listes, citations, callouts, code, tableaux, maths, HTML, propriétés, notes de bas de page) vont à l'intérieur.
Une rangée d'icônes sur le nœud affiche ou masque chaque type de section ; les types affichés par défaut se choisissent dans les réglages.

Si vous voulez qu'un type de section devienne des nœuds à part entière (par exemple chaque élément de liste comme nœud enfant), cochez le type dans les réglages ou ajoutez la propriété `headings-nodes` à la note. Le menu de l'en-tête permet aussi de le basculer ponctuellement.

Les propriétés de la note (frontmatter) apparaissent en panneau de propriétés sur le nœud racine.
Les cases à cocher dans un nœud se cochent directement, et le changement est écrit dans le fichier.

### Navigation

Le fil d'Ariane en haut de la vue montre le chemin jusqu'au nœud sélectionné. Cliquez sur un élément pour lister les frères de ce niveau et sauter vers l'un d'eux.

Il y a plusieurs façons de replier et déplier : cliquer sur la poignée à la fourche d'une branche ; avec un nœud sélectionné, `Space` replie ou déplie ses enfants et `Shift+Space` tout le sous-arbre ; ou choisir une profondeur dans le menu de l'en-tête. **Déplier d'un niveau** et **Replier d'un niveau** sont aussi des commandes, on peut donc leur affecter des raccourcis.

Faites un clic droit sur un nœud ou cliquez sur `…` pour ouvrir le menu du nœud :

- Replier les autres nœuds
- Centrer sur ce nœud : n'affiche que ce sous-arbre ; pour revenir, cliquez sur le fil d'Ariane
- Déplier / Replier ce sous-arbre
- Localiser dans le fichier Markdown : place le curseur de l'éditeur sur la ligne dont vient ce nœud

Les flèches déplacent la sélection entre les nœuds visibles.

Le bouton de recherche de l'en-tête, la commande **Rechercher des nœuds** ou `Ctrl/Cmd+F` quand la vue a le focus ouvrent une barre de recherche au-dessus du fil d'Ariane. Elle compare le titre et le contenu de chaque nœud : séparez plusieurs mots par des espaces pour les exiger tous, la casse est ignorée et les guillemets gardent une expression entière. La portée est l'arbre affiché, donc après **Centrer sur ce nœud** seul ce sous-arbre est parcouru ; la barre affiche alors une pastille « dans … », et un clic dessus revient au fichier entier.

Le bouton entonnoir de la barre bascule entre deux modes, et le dernier choix est mémorisé :

- Recherche (par défaut) : l'arbre entier reste affiché et les nœuds correspondants sont marqués de la couleur de surlignage de recherche (celle du Ctrl+F de l'éditeur), la correspondance courante dans une teinte plus soutenue. `Entrée` / `Maj+Entrée` sautent d'une correspondance à l'autre en la centrant, en dépliant au passage les branches repliées. Tout le reste fonctionne comme d'habitude.
- Filtre : seuls restent les nœuds correspondants et leurs ancêtres, les ancêtres qui ne font que mener à eux sont estompés et l'état de repli est ignoré pour le moment. C'est une loupe pour regarder, pas un plan de travail : ajouter, supprimer, glisser-déposer, `Space` et les entrées de menu liées au repli sont désactivés pendant le filtrage ; sélectionner, les flèches, modifier un nœud, cocher les cases, localiser et centrer restent disponibles.

`Échap` ferme la barre et l'arbre reprend son aspect d'avant.

### Édition

Double-cliquez sur un nœud, appuyez sur `F2` ou choisissez **Modifier** dans le menu du nœud : le nœud devient l'éditeur d'Obsidian, contenant le Markdown de ce nœud.
Listes, liens, tags et mise en forme se comportent exactement comme dans une note, puisque c'est le même éditeur.

`Ctrl/Cmd+Entrée` ou un clic hors du nœud l'écrit dans le fichier.
Aucune autre touche n'est interceptée : `Entrée` continue toujours la liste, `Échap` annule toujours la sélection.

Avec un nœud sélectionné (hors édition) :

- `Entrée` ajoute un frère à la suite
- `Tab` ajoute un enfant
- `Suppr` supprime le nœud et tout ce qu'il contient, après confirmation
- `Ctrl/Cmd+Z`, `Ctrl/Cmd+Maj+Z` annuler et rétablir

Après un ajout ou une suppression, les niveaux de titre et l'indentation des listes sont ajustés pour vous.

### Glisser-déposer

Maintenez la barre de titre d'un nœud pour le faire glisser.
Pendant le glissement, un repère montre où il atterrira et les autres nœuds lui font de la place.

- Déposez au milieu d'un nœud pour en faire le dernier enfant
- Déposez près du bord supérieur ou inférieur pour l'insérer avant ou après ce nœud
- `Échap` annule

Seules les destinations valides apparaissent : les titres vont à côté des titres, les éléments de liste à côté des éléments de liste.
Après le dépôt, les niveaux de titre et l'indentation sont ajustés au nouveau parent.

### Clavier

| Touche | Action |
|---|---|
| `↑` `↓` `←` `→` | Déplacer la sélection |
| `Space` / `Shift+Space` | Replier ou déplier les enfants / tout le sous-arbre |
| `Entrée` / `Tab` | Ajouter un frère / un enfant |
| `F2` ou double-clic | Modifier le nœud |
| `Ctrl/Cmd+Entrée` | Terminer l'édition et écrire |
| `Suppr` | Supprimer le nœud et ses descendants |
| `Ctrl/Cmd+Z`, `Ctrl/Cmd+Maj+Z` | Annuler, rétablir |
| `Échap` pendant un glissement | Annuler le glissement |
| `Ctrl/Cmd+F` | Ouvrir la recherche |

### Réglages

- Quels types de section sont affichés comme nœuds et quel contenu est affiché par défaut, chaque groupe avec un interrupteur « tout activer »
- Disposition par défaut sur ordinateur et sur mobile, largeur maximale des nœuds, hauteur maximale du contenu d'un nœud, et si l'ouverture d'un fichier ne déplie que jusqu'à une certaine profondeur
- Si la bordure et l'arrière-plan du nœud prennent la couleur de la branche, et la largeur et la hauteur maximale de l'éditeur dans le nœud
- Mémoriser l'état de la vue par fichier : à la prochaine ouverture du même fichier, les nœuds repliés, le nœud centré, la profondeur de dépliage et le contenu affiché reviennent (activé par défaut, jusqu'à 200 fichiers), avec un bouton pour effacer tous les états mémorisés

> [!note]
> Sur mobile la disposition par défaut est le plan. Le glisser-déposer nécessite une souris ou un stylet ; glisser avec un doigt déplace la vue.

> [!note]
> Si le fichier est modifié ailleurs pendant que vous éditez un nœud, cette modification n'est pas écrite.
> Un avis apparaît et votre texte est copié dans le presse-papiers, rien n'est perdu.

## Commandes

Un ensemble de commandes pour travailler sur les titres directement dans l'éditeur, sans ouvrir la vue. Chacune commence par lister les titres de la note courante pour que vous en choisissiez un.

### Aller au titre
Parcourez tous les titres de la note actuelle et placez le curseur sur le titre choisi.

### Copier le titre
Parcourez les titres de la note actuelle. Apres en avoir choisi un, vous pouvez le copier ou inserer son marqueur a la position actuelle du curseur.

### Aligner le niveau du titre
Deplacez un titre et tout son contenu apres le titre choisi et avant le prochain titre de niveau superieur. Le titre deplace adopte le niveau du titre choisi, et ses sous-titres sont ajustes de la meme facon.

> [!important]
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

> [!caution]
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

> [!important]
> Vous ne pouvez pas inserer un titre sous l'un de ses propres descendants ni sous son parent actuel, car il appartient deja a ce parent.

> [!important]
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

> [!caution]
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

> [!important]
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