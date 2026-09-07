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
		settingName: "Settings #1",
		settingDescription: "It's a secret",
		settingPlaceholder: "Enter your secret",
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
		settingName: "設定 #1",
		settingDescription: "這是一個祕密",
		settingPlaceholder: "輸入你的祕密",
	},
	"zh-cn": {
		commandGoToHeading: "前往标题", commandCopyHeading: "复制标题", commandAlignHeadingLevel: "对齐标题层级", commandInsertUnderHeading: "将标题插入到另一标题下", commandMoveHeading: "移动标题", commandMoveCurrentBlock: "将当前区块移至标题下", commandMoveSelectedText: "将选中文本移至标题下", commandSelectHeadingContent: "选择标题内容",
		placeholderChooseHeadingToMove: "选择要移动的标题", placeholderChooseMoveDestination: "选择移动目标标题", placeholderChooseHeadingToAlign: "选择要对齐的标题", placeholderChooseAlignmentTarget: "选择对齐目标标题", placeholderChooseInsertionTarget: "选择要插入到其下的标题",
		instructionEnter: "Enter：", instructionCopyAndSelect: "复制标题并选择文本", instructionClick: "点击：", instructionInsertMarker: "插入标题标记", instructionModifierClick: "Ctrl/Cmd + 点击：", instructionCopy: "复制标题", settingName: "设置 #1", settingDescription: "这是一个秘密", settingPlaceholder: "输入你的秘密",
	},
	"ja": {
		commandGoToHeading: "見出しへ移動", commandCopyHeading: "見出しをコピー", commandAlignHeadingLevel: "見出しレベルを整列", commandInsertUnderHeading: "別の見出しの下に見出しを挿入", commandMoveHeading: "見出しを移動", commandMoveCurrentBlock: "現在のブロックを見出しの下へ移動", commandMoveSelectedText: "選択テキストを見出しの下へ移動", commandSelectHeadingContent: "見出しの内容を選択",
		placeholderChooseHeadingToMove: "移動する見出しを選択", placeholderChooseMoveDestination: "移動先の見出しを選択", placeholderChooseHeadingToAlign: "整列する見出しを選択", placeholderChooseAlignmentTarget: "整列先の見出しを選択", placeholderChooseInsertionTarget: "挿入先の見出しを選択",
		instructionEnter: "Enter：", instructionCopyAndSelect: "見出しをコピーしてテキストを選択", instructionClick: "クリック：", instructionInsertMarker: "見出し記号を挿入", instructionModifierClick: "Ctrl/Cmd + クリック：", instructionCopy: "見出しをコピー", settingName: "設定 #1", settingDescription: "秘密です", settingPlaceholder: "秘密を入力",
	},
	"ko": {
		commandGoToHeading: "제목으로 이동", commandCopyHeading: "제목 복사", commandAlignHeadingLevel: "제목 수준 정렬", commandInsertUnderHeading: "다른 제목 아래에 제목 삽입", commandMoveHeading: "제목 이동", commandMoveCurrentBlock: "현재 블록을 제목 아래로 이동", commandMoveSelectedText: "선택한 텍스트를 제목 아래로 이동", commandSelectHeadingContent: "제목 내용 선택",
		placeholderChooseHeadingToMove: "이동할 제목 선택", placeholderChooseMoveDestination: "이동할 대상 제목 선택", placeholderChooseHeadingToAlign: "정렬할 제목 선택", placeholderChooseAlignmentTarget: "정렬 기준 제목 선택", placeholderChooseInsertionTarget: "삽입할 대상 제목 선택",
		instructionEnter: "Enter:", instructionCopyAndSelect: "제목을 복사하고 텍스트 선택", instructionClick: "클릭:", instructionInsertMarker: "제목 표식 삽입", instructionModifierClick: "Ctrl/Cmd + 클릭:", instructionCopy: "제목 복사", settingName: "설정 #1", settingDescription: "비밀입니다", settingPlaceholder: "비밀 입력",
	},
	"es": {
		commandGoToHeading: "Ir al encabezado", commandCopyHeading: "Copiar encabezado", commandAlignHeadingLevel: "Alinear nivel del encabezado", commandInsertUnderHeading: "Insertar encabezado bajo otro encabezado", commandMoveHeading: "Mover encabezado", commandMoveCurrentBlock: "Mover bloque actual bajo un encabezado", commandMoveSelectedText: "Mover texto seleccionado bajo un encabezado", commandSelectHeadingContent: "Seleccionar contenido del encabezado",
		placeholderChooseHeadingToMove: "Elige el encabezado que deseas mover", placeholderChooseMoveDestination: "Elige el encabezado de destino", placeholderChooseHeadingToAlign: "Elige el encabezado que deseas alinear", placeholderChooseAlignmentTarget: "Elige el encabezado de referencia", placeholderChooseInsertionTarget: "Elige el encabezado bajo el que insertar",
		instructionEnter: "Enter:", instructionCopyAndSelect: "Copiar encabezado y seleccionar texto", instructionClick: "Clic:", instructionInsertMarker: "Insertar marcador de encabezado", instructionModifierClick: "Ctrl/Cmd + clic:", instructionCopy: "Copiar encabezado", settingName: "Configuración #1", settingDescription: "Es un secreto", settingPlaceholder: "Introduce tu secreto",
	},
	"fr": {
		commandGoToHeading: "Aller au titre", commandCopyHeading: "Copier le titre", commandAlignHeadingLevel: "Aligner le niveau du titre", commandInsertUnderHeading: "Insérer un titre sous un autre titre", commandMoveHeading: "Déplacer le titre", commandMoveCurrentBlock: "Déplacer le bloc actuel sous un titre", commandMoveSelectedText: "Déplacer le texte sélectionné sous un titre", commandSelectHeadingContent: "Sélectionner le contenu du titre",
		placeholderChooseHeadingToMove: "Choisissez le titre à déplacer", placeholderChooseMoveDestination: "Choisissez le titre de destination", placeholderChooseHeadingToAlign: "Choisissez le titre à aligner", placeholderChooseAlignmentTarget: "Choisissez le titre de référence", placeholderChooseInsertionTarget: "Choisissez le titre sous lequel insérer",
		instructionEnter: "Entrée :", instructionCopyAndSelect: "Copier le titre et sélectionner le texte", instructionClick: "Clic :", instructionInsertMarker: "Insérer le marqueur de titre", instructionModifierClick: "Ctrl/Cmd + clic :", instructionCopy: "Copier le titre", settingName: "Paramètres #1", settingDescription: "C'est un secret", settingPlaceholder: "Saisissez votre secret",
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