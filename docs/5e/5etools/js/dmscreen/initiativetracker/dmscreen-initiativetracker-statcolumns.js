import {InitiativeTrackerDataSerializerBase} from "./dmscreen-initiativetracker-util.js";

export const GROUP_BASE_STATS = "baseStats";
export const GROUP_SAVES = "saves";
export const GROUP_ABILITY_BONUS = "abilityBonus";
export const GROUP_ABILITY_SCORE = "abilityScore";
export const GROUP_SKILL = "skill";
export const GROUP_CHECKBOX = "checkbox";
export const GROUP_CUSTOM = "custom";

export const IS_PLAYER_VISIBLE_NONE = 0;
export const IS_PLAYER_VISIBLE_ALL = 1;
export const IS_PLAYER_VISIBLE_PLAYER_UNITS_ONLY = 2;

/** @abstract */
class _InitiativeTrackerStatColumnBase {
	/** Functions as an ID for the column type. */
	static get POPULATE_WITH () { throw new Error("Unimplemented!"); }

	/** UI group the column type belongs to. */
	static GROUP;

	static NAME;
	static ABV_DEFAULT = "";

	constructor (
		{
			id,
			isEditable,
			isPlayerVisible,
			populateWithPrevious,
			abbreviation,
		},
	) {
		this._id = id;
		this._isEditable = isEditable;
		this._isPlayerVisible = isPlayerVisible;
		this._populateWithPrevious = populateWithPrevious ?? null;
		this._abbreviation = abbreviation ?? this.constructor.ABV_DEFAULT;
	}

	get id () { return this._id; }
	get abbreviation () { return this._abbreviation; }
	get isEditable () { return this._isEditable; }
	get populateWithPrevious () { return this._populateWithPrevious; }

	isCheckbox () { return false; }

	/**
	 * @return `undefined` if the column should not auto-set at the start of the turn, or, a value the column should
	 *         be auto-set to at the start of the turn.
	 */
	getAutoTurnStartValue () { return undefined; }

	/** @abstract */
	getInitialCellValue (mon) { throw new Error("Unimplemented!"); }

	_getAsData () {
		return {
			id: this._id,
			isEditable: this._isEditable,
			isPlayerVisible: this._isPlayerVisible,
			populateWith: this.constructor.POPULATE_WITH,
			populateWithPrevious: this._populateWithPrevious,
			abbreviation: this._abbreviation,
		};
	}

	getAsStateData () {
		return this._getAsData();
	}

	getAsCollectionRowStateData () {
		const data = this._getAsData();
		const out = {
			id: data.id,
			entity: {
				...data,
			},
		};
		delete out.entity.id;
		return out;
	}
}

class InitiativeTrackerStatColumn_HpFormula extends _InitiativeTrackerStatColumnBase {
	static get POPULATE_WITH () { return "hpFormula"; }
	static GROUP = GROUP_BASE_STATS;
	static NAME = "HP Formula";

	getInitialCellValue (mon) { return (mon.hp || {}).formula; }
}

class InitiativeTrackerStatColumn_ArmorClass extends _InitiativeTrackerStatColumnBase {
	static get POPULATE_WITH () { return "armorClass"; }
	static GROUP = GROUP_BASE_STATS;
	static NAME = "Armor Class";
	static ABV_DEFAULT = "AC";

	getInitialCellValue (mon) { return mon.ac[0] ? (mon.ac[0].ac || mon.ac[0]) : null; }
}

class InitiativeTrackerStatColumn_PassivePerception extends _InitiativeTrackerStatColumnBase {
	static get POPULATE_WITH () { return "passivePerception"; }
	static GROUP = GROUP_BASE_STATS;
	static NAME = "Passive Perception";
	static ABV_DEFAULT = "PP";

	getInitialCellValue (mon) { return mon.passive; }
}

class InitiativeTrackerStatColumn_Speed extends _InitiativeTrackerStatColumnBase {
	static get POPULATE_WITH () { return "speed"; }
	static GROUP = GROUP_BASE_STATS;
	static NAME = "Speed";
	static ABV_DEFAULT = "SPD";

	getInitialCellValue (mon) {
		return Math.max(0, ...Object.values(mon.speed || {})
			.map(it => it.number ? it.number : it)
			.filter(it => typeof it === "number"));
	}
}

class InitiativeTrackerStatColumn_SpellDc extends _InitiativeTrackerStatColumnBase {
	static get POPULATE_WITH () { return "spellDc"; }
	static GROUP = GROUP_BASE_STATS;
	static NAME = "Spell DC";
	static ABV_DEFAULT = "DC";

	getInitialCellValue (mon) {
		return Math.max(
			0,
			...(mon.spellcasting || [])
				.filter(it => it.headerEntries)
				.map(it => {
					return it.headerEntries
						.map(it => {
							const found = [0];
							it
								.replace(/DC (\d+)/g, (...m) => found.push(Number(m[1])))
								.replace(/{@dc (\d+)}/g, (...m) => found.push(Number(m[1])));
							return Math.max(...found);
						})
						.filter(Boolean);
				})
				.flat(),
		);
	}
}

class InitiativeTrackerStatColumn_LegendaryActions extends _InitiativeTrackerStatColumnBase {
	static get POPULATE_WITH () { return "legendaryActions"; }
	static GROUP = GROUP_BASE_STATS;
	static NAME = "Legendary Actions";
	static ABV_DEFAULT = "LA";

	getInitialCellValue (mon) { return mon.legendaryActions || mon.legendary ? 3 : null; }
}

class InitiativeTrackerStatColumn_Save extends _InitiativeTrackerStatColumnBase {
	static _ATT;

	static get POPULATE_WITH () { return `${this._ATT}Save`; }
	static GROUP = GROUP_SAVES;
	static get NAME () { return `${Parser.attAbvToFull(this._ATT)} Save`; }
	static get ABV_DEFAULT () { return this._ATT.toUpperCase(); }

	getInitialCellValue (mon) { return mon.save?.[this.constructor._ATT] ? mon.save[this.constructor._ATT] : Parser.getAbilityModifier(mon[this.constructor._ATT]); }
}

class InitiativeTrackerStatColumn_AbilityBonus extends _InitiativeTrackerStatColumnBase {
	static _ATT;

	static get POPULATE_WITH () { return `${this._ATT}Bonus`; }
	static GROUP = GROUP_ABILITY_BONUS;
	static get NAME () { return `${Parser.attAbvToFull(this._ATT)} Bonus`; }
	static get ABV_DEFAULT () { return this._ATT.toUpperCase(); }

	getInitialCellValue (mon) { return Parser.getAbilityModifier(mon[this.constructor._ATT]); }
}

class InitiativeTrackerStatColumn_AbilityScore extends _InitiativeTrackerStatColumnBase {
	static _ATT;

	static get POPULATE_WITH () { return `${this._ATT}Score`; }
	static GROUP = GROUP_ABILITY_SCORE;
	static get NAME () { return `${Parser.attAbvToFull(this._ATT)} Score`; }
	static get ABV_DEFAULT () { return this._ATT.toUpperCase(); }

	getInitialCellValue (mon) { return mon[this.constructor._ATT]; }
}

class InitiativeTrackerStatColumn_Skill extends _InitiativeTrackerStatColumnBase {
	static _SKILL;

	static get POPULATE_WITH () { return this._SKILL.toCamelCase(); }
	static GROUP = GROUP_SKILL;
	static get NAME () { return this._SKILL.toTitleCase(); }
	static get ABV_DEFAULT () { return Parser.skillToShort(this._SKILL).toUpperCase(); }

	getInitialCellValue (mon) {
		return mon.skill?.[this.constructor._SKILL]
			? mon.skill[this.constructor._SKILL]
			: Parser.getAbilityModifier(mon[Parser.skillToAbilityAbv(this.constructor._SKILL)]);
	}
}

class _InitiativeTrackerStatColumnCheckboxBase extends _InitiativeTrackerStatColumnBase {
	static GROUP = GROUP_CHECKBOX;

	static _AUTO_VALUE = undefined;

	getInitialCellValue (mon) { return false; }

	isCheckbox () { return true; }

	getAutoTurnStartValue () { return this.constructor._AUTO_VALUE; }
}

class InitiativeTrackerStatColumn_CheckboxAutoLow extends _InitiativeTrackerStatColumnCheckboxBase {
	static get POPULATE_WITH () { return "cbAutoLow"; }
	static NAME = "Checkbox; clears at start of turn";

	static _AUTO_VALUE = false;
}

class InitiativeTrackerStatColumn_Checkbox extends _InitiativeTrackerStatColumnCheckboxBase {
	static get POPULATE_WITH () { return "cbNeutral"; }
	static NAME = "Checkbox";
}

class InitiativeTrackerStatColumn_CheckboxAutoHigh extends _InitiativeTrackerStatColumnCheckboxBase {
	static get POPULATE_WITH () { return "cbAutoHigh"; }
	static NAME = "Checkbox; ticks at start of turn";

	static _AUTO_VALUE = true;

	getInitialCellValue (mon) { return true; }
}

export class InitiativeTrackerStatColumn_Custom extends _InitiativeTrackerStatColumnBase {
	static get POPULATE_WITH () { return ""; }
	static GROUP = GROUP_CUSTOM;
	static NAME = "(Custom)";

	getInitialCellValue (mon) { return ""; }
}

export class InitiativeTrackerStatColumnDataSerializer extends InitiativeTrackerDataSerializerBase {
	static _FIELD_MAPPINGS = {
		"id": "id",
		"isEditable": "e",
		"isPlayerVisible": "v",
		"populateWith": "p",
		"populateWithPrevious": "po",
		"abbreviation": "a",
	};
}

export class InitiativeTrackerStatColumnFactory {
	static _COL_CLS_LOOKUP = {};

	static _initLookup () {
		[
			InitiativeTrackerStatColumn_HpFormula,
			InitiativeTrackerStatColumn_ArmorClass,
			InitiativeTrackerStatColumn_PassivePerception,
			InitiativeTrackerStatColumn_Speed,
			InitiativeTrackerStatColumn_SpellDc,
			InitiativeTrackerStatColumn_LegendaryActions,
		].forEach(Cls => this._initLookup_addCls(Cls));

		Parser.ABIL_ABVS
			.forEach(abv => {
				this._initLookup_addCls(class extends InitiativeTrackerStatColumn_Save { static _ATT = abv; });
			});

		Parser.ABIL_ABVS
			.forEach(abv => {
				this._initLookup_addCls(class extends InitiativeTrackerStatColumn_AbilityBonus { static _ATT = abv; });
			});

		Parser.ABIL_ABVS
			.forEach(abv => {
				this._initLookup_addCls(class extends InitiativeTrackerStatColumn_AbilityScore { static _ATT = abv; });
			});

		Object.keys(Parser.SKILL_TO_ATB_ABV)
			.sort(SortUtil.ascSort)
			.forEach(skill => {
				this._initLookup_addCls(class extends InitiativeTrackerStatColumn_Skill { static _SKILL = skill; });
			});

		[
			InitiativeTrackerStatColumn_CheckboxAutoLow,
			InitiativeTrackerStatColumn_Checkbox,
			InitiativeTrackerStatColumn_CheckboxAutoHigh,
		].forEach(Cls => this._initLookup_addCls(Cls));
	}

	static _initLookup_addCls (Cls) { this._COL_CLS_LOOKUP[Cls.POPULATE_WITH] = Cls; }

	/* -------------------------------------------- */

	static getGroupedByUi () {
		const out = [
			[InitiativeTrackerStatColumn_Custom],
		];

		let groupPrev = GROUP_CUSTOM;
		Object.values(this._COL_CLS_LOOKUP)
			.forEach(Cls => {
				if (groupPrev !== Cls.GROUP) out.push([]);
				out.last().push(Cls);
				groupPrev = Cls.GROUP;
			});

		return out;
	}

	/* -------------------------------------------- */

	/**
	 * @param dataSerial
	 * @param data
	 * @return {_InitiativeTrackerStatColumnBase}
	 */
	static fromStateData ({dataSerial, data}) {
		if (dataSerial && data) throw new Error(`Only one of "dataSerial" and "data" may be provided!`);

		data = data ?? InitiativeTrackerStatColumnDataSerializer.fromSerial(dataSerial);

		const Cls = this._COL_CLS_LOOKUP[data.populateWith] ?? InitiativeTrackerStatColumn_Custom;
		return new Cls(data);
	}

	/**
	 * @param colName
	 * @return {_InitiativeTrackerStatColumnBase}
	 */
	static fromEncounterAdvancedColName ({colName}) {
		colName = colName.toLowerCase().trim();
		const Cls = Object.values(this._COL_CLS_LOOKUP)
			.find(Cls => Cls.ABV_DEFAULT.toLowerCase() === colName)
			|| InitiativeTrackerStatColumn_Custom;

		return new Cls({
			id: CryptUtil.uid(),
			isEditable: true,
			isPlayerVisible: IS_PLAYER_VISIBLE_PLAYER_UNITS_ONLY,
			populateWithPrevious: null,
			abbreviation: colName,
		});
	}

	/**
	 * @param populateWith
	 * @param populateWithPrevious
	 * @return {_InitiativeTrackerStatColumnBase}
	 */
	static fromPopulateWith ({populateWith, populateWithPrevious}) {
		const Cls = this._COL_CLS_LOOKUP[populateWith] ?? InitiativeTrackerStatColumn_Custom;
		return new Cls({populateWithPrevious});
	}

	/**
	 * @param data
	 * @return {_InitiativeTrackerStatColumnBase}
	 */
	static fromCollectionRowStateData ({data}) {
		const flat = {id: data.id, ...data.entity};
		return this.fromStateData({data: flat});
	}

	/**
	 * @return {_InitiativeTrackerStatColumnBase}
	 */
	static fromNew () {
		return new InitiativeTrackerStatColumn_Custom({
			id: CryptUtil.uid(),
			isEditable: true,
			isPlayerVisible: IS_PLAYER_VISIBLE_NONE,
		});
	}
}

InitiativeTrackerStatColumnFactory._initLookup();
