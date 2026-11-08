import { moment } from "obsidian";

const translations = {
	"en": {
		commandGoToHeading: "Go to heading",
		commandCopyHeading: "Copy heading",
		commandAlignHeadingLevel: "Align heading level",
		commandInsertUnderHeading: "Insert heading under another heading",
		commandMoveHeading: "Move heading",
		commandMoveCurrentBlock: "Move current block under heading",
		commandMoveSelectedText: "Move selected text under heading",
		commandSelectHeadingContent: "Select heading content",
		placeholderChooseHeadingToMove: "Choose a heading to move",
		placeholderChooseMoveDestination: "Choose a destination heading",
		placeholderChooseHeadingToAlign: "Choose a heading to align",
		placeholderChooseAlignmentTarget: "Choose a target heading for alignment",
		placeholderChooseInsertionTarget: "Choose a heading to insert under",
		instructionEnter: "Enter:",
		instructionCopyAndSelect: "Copy heading and select text",
		instructionClick: "Click:",
		instructionInsertMarker: "Insert heading marker",
		instructionModifierClick: "Ctrl/Cmd + Click:",
		instructionCopy: "Copy heading",
		settingListAsNodeName: "Show lists as nodes",
		settingListAsNodeDescription: "In the tree table view, show list items and their nested lists as tree nodes instead of heading content.",
	},
	"zh-tw": {
		commandGoToHeading: "前往標題",
		commandCopyHeading: "複製標題",
		commandAlignHeadingLevel: "對齊標題階層",
		commandInsertUnderHeading: "將標題插入另一標題下",
		commandMoveHeading: "移動標題",
		commandMoveCurrentBlock: "將目前區塊移至標題下",
		commandMoveSelectedText: "將選取文字移至標題下",
		commandSelectHeadingContent: "選取標題內容",
		placeholderChooseHeadingToMove: "選擇想要移動的標題",
		placeholderChooseMoveDestination: "選擇要移動到的標題位置",
		placeholderChooseHeadingToAlign: "選擇想要對齊的標題",
		placeholderChooseAlignmentTarget: "選擇要對齊的標題位置",
		placeholderChooseInsertionTarget: "選擇要插入的標題位置",
		instructionEnter: "Enter：",
		instructionCopyAndSelect: "複製標題並選取文字",
		instructionClick: "點擊：",
		instructionInsertMarker: "插入標題符號",
		instructionModifierClick: "Ctrl/Cmd + 點擊：",
		instructionCopy: "複製標題",
		settingListAsNodeName: "將清單顯示為節點",
		settingListAsNodeDescription: "在樹狀表格檢視中，將清單項目及其子清單顯示為樹狀節點，而不是標題底下的內容。",
	},
	"zh-cn": {
		commandGoToHeading: "前往标题", commandCopyHeading: "复制标题", commandAlignHeadingLevel: "对齐标题层级", commandInsertUnderHeading: "将标题插入到另一标题下", commandMoveHeading: "移动标题", commandMoveCurrentBlock: "将当前区块移至标题下", commandMoveSelectedText: "将选中文本移至标题下", commandSelectHeadingContent: "选择标题内容",
		placeholderChooseHeadingToMove: "选择要移动的标题", placeholderChooseMoveDestination: "选择移动目标标题", placeholderChooseHeadingToAlign: "选择要对齐的标题", placeholderChooseAlignmentTarget: "选择对齐目标标题", placeholderChooseInsertionTarget: "选择要插入到其下的标题",
		instructionEnter: "Enter：", instructionCopyAndSelect: "复制标题并选择文本", instructionClick: "点击：", instructionInsertMarker: "插入标题标记", instructionModifierClick: "Ctrl/Cmd + 点击：", instructionCopy: "复制标题", settingListAsNodeName: "将列表显示为节点", settingListAsNodeDescription: "在树状表格视图中，将列表项及其子列表显示为树状节点，而不是标题下的内容。",
	},
	"ja": {
		commandGoToHeading: "見出しへ移動", commandCopyHeading: "見出しをコピー", commandAlignHeadingLevel: "見出しレベルを整列", commandInsertUnderHeading: "別の見出しの下に見出しを挿入", commandMoveHeading: "見出しを移動", commandMoveCurrentBlock: "現在のブロックを見出しの下へ移動", commandMoveSelectedText: "選択テキストを見出しの下へ移動", commandSelectHeadingContent: "見出しの内容を選択",
		placeholderChooseHeadingToMove: "移動する見出しを選択", placeholderChooseMoveDestination: "移動先の見出しを選択", placeholderChooseHeadingToAlign: "整列する見出しを選択", placeholderChooseAlignmentTarget: "整列先の見出しを選択", placeholderChooseInsertionTarget: "挿入先の見出しを選択",
		instructionEnter: "Enter：", instructionCopyAndSelect: "見出しをコピーしてテキストを選択", instructionClick: "クリック：", instructionInsertMarker: "見出し記号を挿入", instructionModifierClick: "Ctrl/Cmd + クリック：", instructionCopy: "見出しをコピー", settingListAsNodeName: "リストをノードとして表示", settingListAsNodeDescription: "ツリーテーブル表示で、リスト項目とその子リストを見出しの内容ではなくツリーのノードとして表示します。",
	},
	"ko": {
		commandGoToHeading: "제목으로 이동", commandCopyHeading: "제목 복사", commandAlignHeadingLevel: "제목 수준 정렬", commandInsertUnderHeading: "다른 제목 아래에 제목 삽입", commandMoveHeading: "제목 이동", commandMoveCurrentBlock: "현재 블록을 제목 아래로 이동", commandMoveSelectedText: "선택한 텍스트를 제목 아래로 이동", commandSelectHeadingContent: "제목 내용 선택",
		placeholderChooseHeadingToMove: "이동할 제목 선택", placeholderChooseMoveDestination: "이동할 대상 제목 선택", placeholderChooseHeadingToAlign: "정렬할 제목 선택", placeholderChooseAlignmentTarget: "정렬 기준 제목 선택", placeholderChooseInsertionTarget: "삽입할 대상 제목 선택",
		instructionEnter: "Enter:", instructionCopyAndSelect: "제목을 복사하고 텍스트 선택", instructionClick: "클릭:", instructionInsertMarker: "제목 표식 삽입", instructionModifierClick: "Ctrl/Cmd + 클릭:", instructionCopy: "제목 복사", settingListAsNodeName: "목록을 노드로 표시", settingListAsNodeDescription: "트리 테이블 보기에서 목록 항목과 하위 목록을 제목의 내용이 아닌 트리 노드로 표시합니다.",
	},
	"es": {
		commandGoToHeading: "Ir al encabezado", commandCopyHeading: "Copiar encabezado", commandAlignHeadingLevel: "Alinear nivel del encabezado", commandInsertUnderHeading: "Insertar encabezado bajo otro encabezado", commandMoveHeading: "Mover encabezado", commandMoveCurrentBlock: "Mover bloque actual bajo un encabezado", commandMoveSelectedText: "Mover texto seleccionado bajo un encabezado", commandSelectHeadingContent: "Seleccionar contenido del encabezado",
		placeholderChooseHeadingToMove: "Elige el encabezado que deseas mover", placeholderChooseMoveDestination: "Elige el encabezado de destino", placeholderChooseHeadingToAlign: "Elige el encabezado que deseas alinear", placeholderChooseAlignmentTarget: "Elige el encabezado de referencia", placeholderChooseInsertionTarget: "Elige el encabezado bajo el que insertar",
		instructionEnter: "Enter:", instructionCopyAndSelect: "Copiar encabezado y seleccionar texto", instructionClick: "Clic:", instructionInsertMarker: "Insertar marcador de encabezado", instructionModifierClick: "Ctrl/Cmd + clic:", instructionCopy: "Copiar encabezado", settingListAsNodeName: "Mostrar listas como nodos", settingListAsNodeDescription: "En la vista de tabla de árbol, muestra los elementos de lista y sus listas anidadas como nodos del árbol en lugar de contenido del encabezado.",
	},
	"fr": {
		commandGoToHeading: "Aller au titre", commandCopyHeading: "Copier le titre", commandAlignHeadingLevel: "Aligner le niveau du titre", commandInsertUnderHeading: "Insérer un titre sous un autre titre", commandMoveHeading: "Déplacer le titre", commandMoveCurrentBlock: "Déplacer le bloc actuel sous un titre", commandMoveSelectedText: "Déplacer le texte sélectionné sous un titre", commandSelectHeadingContent: "Sélectionner le contenu du titre",
		placeholderChooseHeadingToMove: "Choisissez le titre à déplacer", placeholderChooseMoveDestination: "Choisissez le titre de destination", placeholderChooseHeadingToAlign: "Choisissez le titre à aligner", placeholderChooseAlignmentTarget: "Choisissez le titre de référence", placeholderChooseInsertionTarget: "Choisissez le titre sous lequel insérer",
		instructionEnter: "Entrée :", instructionCopyAndSelect: "Copier le titre et sélectionner le texte", instructionClick: "Clic :", instructionInsertMarker: "Insérer le marqueur de titre", instructionModifierClick: "Ctrl/Cmd + clic :", instructionCopy: "Copier le titre", settingListAsNodeName: "Afficher les listes comme nœuds", settingListAsNodeDescription: "Dans la vue tableau arborescent, affiche les éléments de liste et leurs listes imbriquées comme nœuds de l'arbre plutôt que comme contenu du titre.",
	},
} as const;

type TranslationKey = keyof typeof translations.en;
type SupportedLocale = keyof typeof translations;

function getLocale(): SupportedLocale {
	const locale = moment.locale().toLowerCase();
	return locale in translations ? locale as SupportedLocale : "en";
}

export function t(key: TranslationKey): string {
	return translations[getLocale()][key];
}